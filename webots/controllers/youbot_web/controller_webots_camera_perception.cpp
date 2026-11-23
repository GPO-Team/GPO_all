#include "controller_webots_camera_perception.h"

#include "controller_math.h"
#include "controller_io.h"
#include "controller_webots_object_naming.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {
constexpr int kMaxGridW = 320;
constexpr int kMaxGridH = 180;
constexpr int kMaxGridCells = kMaxGridW * kMaxGridH;
constexpr int kMaxDatasetClasses = 64;

unsigned char s_cell_fg[kMaxGridCells];
unsigned char s_cell_visited[kMaxGridCells];
int s_bfs_queue[kMaxGridCells];

ControllerWebotsCameraPerception s_latest_perception = {};
int s_has_latest_perception = 0;
ControllerWebotsTrackedTarget s_tracked_targets[MAX_CAMERA_TRACKED_TARGETS] = {};

int s_has_active_target = 0;
double s_active_target_x = 0.0;
double s_active_target_z = 0.0;

double s_arm_joints[5] = {0.0, 0.0, 0.0, 0.0, 0.0};
int s_has_arm_joints = 0;

struct DatasetClassEntry {
  int active;
  char name[96];
  int is_compact;
  int sample_count;
  double features[CAMERA_FEATURE_DIM];
};

DatasetClassEntry s_dataset[kMaxDatasetClasses] = {};
int s_dataset_loaded = 0;
int s_dataset_dirty_updates = 0;

struct PaletteSample {
  double rn;
  double gn;
  double bn;
  double luma;
};

int is_auto_generated_name(const char *name) {
  if (!name || name[0] == '\0') return 1;
  return std::strncmp(name, "learned_", 8) == 0 ||
         std::strncmp(name, "unregistered_", 13) == 0 ||
         std::strcmp(name, "unknown_object") == 0;
}

void build_dataset_path(char *out_path, size_t out_size) {
  const char *state_dir = std::getenv("WEB_STATE_DIR");
  if (state_dir && state_dir[0] != '\0') {
    std::snprintf(out_path, out_size, "%s/object_dataset.csv", state_dir);
  } else {
    std::snprintf(out_path, out_size, "object_dataset.csv");
  }
}

void save_dataset_to_file(void) {
  char path[512];
  build_dataset_path(path, sizeof(path));

  char tmp_path[520];
  std::snprintf(tmp_path, sizeof(tmp_path), "%s.tmp", path);

  FILE *f = std::fopen(tmp_path, "w");
  if (!f) return;

  std::fprintf(
      f,
      "name,is_compact,sample_count,rn,gn,bn,sat,luma,texture,aspect,horizon_ratio,width_m,height_m,solid_lidar,floor_contact\n");
  for (int i = 0; i < kMaxDatasetClasses; ++i) {
    if (!s_dataset[i].active) continue;
    const DatasetClassEntry &e = s_dataset[i];
    std::fprintf(
        f,
        "%s,%d,%d,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f\n",
        e.name,
        e.is_compact,
        e.sample_count,
        e.features[0],
        e.features[1],
        e.features[2],
        e.features[3],
        e.features[4],
        e.features[5],
        e.features[6],
        e.features[7],
        e.features[8],
        e.features[9],
        e.features[10],
        e.features[11]);
  }
  std::fclose(f);
  std::remove(path);
  if (replace_file(tmp_path, path) != 0) return;
  s_dataset_dirty_updates = 0;
}

void load_dataset_from_file(void) {
  if (s_dataset_loaded) return;
  s_dataset_loaded = 1;
  std::memset(s_dataset, 0, sizeof(s_dataset));

  char path[512];
  build_dataset_path(path, sizeof(path));
  FILE *f = std::fopen(path, "r");
  if (!f) return;

  char line[1024];
  int slot = 0;
  while (std::fgets(line, sizeof(line), f)) {
    if (line[0] == '#' || std::strncmp(line, "name,", 5) == 0) continue;
    DatasetClassEntry entry = {};
    const int parsed = std::sscanf(
        line,
        "%95[^,],%d,%d,%lf,%lf,%lf,%lf,%lf,%lf,%lf,%lf,%lf,%lf,%lf,%lf",
        entry.name,
        &entry.is_compact,
        &entry.sample_count,
        &entry.features[0],
        &entry.features[1],
        &entry.features[2],
        &entry.features[3],
        &entry.features[4],
        &entry.features[5],
        &entry.features[6],
        &entry.features[7],
        &entry.features[8],
        &entry.features[9],
        &entry.features[10],
        &entry.features[11]);
    if (parsed == 15 && entry.name[0] != '\0' && slot < kMaxDatasetClasses) {
      if (!entry.is_compact && entry.features[10] < 0.5 && entry.features[7] <= 0.01) {
        continue;
      }
      entry.active = 1;
      s_dataset[slot++] = entry;
    }
  }
  std::fclose(f);
}

double compute_feature_similarity(
    const double a[CAMERA_FEATURE_DIM], const double b[CAMERA_FEATURE_DIM]) {
  static const double kWeights[CAMERA_FEATURE_DIM] = {
      1.6, 1.6, 1.6,
      1.3, 0.9, 0.8,
      1.1, 0.8,
      1.5, 1.5,
      1.4, 0.6
  };
  double weighted_sq_diff = 0.0;
  double weight_sum = 0.0;
  for (int i = 0; i < CAMERA_FEATURE_DIM; ++i) {
    const double d = a[i] - b[i];
    weighted_sq_diff += kWeights[i] * d * d;
    weight_sum += kWeights[i];
  }
  const double rms = std::sqrt(weighted_sq_diff / std::max(weight_sum, 1e-6));
  return clamp_value(1.0 - rms * 1.45, 0.0, 1.0);
}

void classify_or_discover_object(
    ControllerWebotsDetectedObject *obj, int allow_new_discovery) {
  load_dataset_from_file();

  char resolved_webots_name[96] = {};
  const int has_world_coords =
      (hypot(obj->world_x, obj->world_z) > 1e-4) || obj->lidar_confirmed;
  const int has_webots_name =
      has_world_coords &&
      controller_webots_object_naming_resolve(
          obj->world_x,
          obj->world_z,
          1.85,
          nullptr,
          resolved_webots_name,
          sizeof(resolved_webots_name));

  if (has_webots_name) {
    for (int i = 0; i < kMaxDatasetClasses; ++i) {
      if (s_dataset[i].active &&
          std::strcmp(s_dataset[i].name, resolved_webots_name) == 0) {
        DatasetClassEntry &matched = s_dataset[i];
        const double sim = compute_feature_similarity(obj->features, matched.features);
        std::snprintf(obj->label, sizeof(obj->label), "%s", matched.name);
        obj->confidence = clamp_value(std::max(sim, 0.88), 0.85, 0.99);
        obj->score = obj->confidence;
        obj->type = matched.is_compact ? CAMERA_OBJECT_TARGET_BLUE : CAMERA_OBJECT_OBSTACLE;

        const double lr = 1.0 / (double)std::min(matched.sample_count + 1, 40);
        for (int k = 0; k < CAMERA_FEATURE_DIM; ++k) {
          matched.features[k] = (1.0 - lr) * matched.features[k] + lr * obj->features[k];
        }
        matched.sample_count += 1;
        if (++s_dataset_dirty_updates >= 10) {
          save_dataset_to_file();
        }
        return;
      }
    }
  }

  int best_idx = -1;
  double best_sim = 0.0;
  for (int i = 0; i < kMaxDatasetClasses; ++i) {
    if (!s_dataset[i].active) continue;
    const double sim = compute_feature_similarity(obj->features, s_dataset[i].features);
    if (sim > best_sim) {
      best_sim = sim;
      best_idx = i;
    }
  }

  if (best_idx >= 0 && best_sim >= 0.78) {
    DatasetClassEntry &matched = s_dataset[best_idx];
    const int matched_is_generic = is_auto_generated_name(matched.name);
    const int conflict_with_other_named_object =
        has_webots_name && !matched_is_generic &&
        std::strcmp(matched.name, resolved_webots_name) != 0;

    if (!conflict_with_other_named_object) {
      int renamed_now = 0;
      if (has_webots_name && matched_is_generic) {
        std::snprintf(matched.name, sizeof(matched.name), "%s", resolved_webots_name);
        renamed_now = 1;
      }

      std::snprintf(obj->label, sizeof(obj->label), "%s", matched.name);
      obj->confidence = clamp_value(best_sim, 0.78, 0.99);
      obj->score = obj->confidence;
      obj->type = matched.is_compact ? CAMERA_OBJECT_TARGET_BLUE : CAMERA_OBJECT_OBSTACLE;

      const double lr = 1.0 / (double)std::min(matched.sample_count + 1, 40);
      for (int k = 0; k < CAMERA_FEATURE_DIM; ++k) {
        matched.features[k] = (1.0 - lr) * matched.features[k] + lr * obj->features[k];
      }
      matched.sample_count += 1;
      if (renamed_now || ++s_dataset_dirty_updates >= 10) {
        save_dataset_to_file();
      }
      return;
    }
  }

  const int compact = (obj->low_profile_confirmed || obj->features[9] < 0.34) ? 1 : 0;
  obj->type = compact ? CAMERA_OBJECT_TARGET_BLUE : CAMERA_OBJECT_OBSTACLE;

  if (!allow_new_discovery) {
    if (has_webots_name) {
      std::snprintf(obj->label, sizeof(obj->label), "%s", resolved_webots_name);
    } else {
      std::snprintf(
          obj->label,
          sizeof(obj->label),
          "%s",
          compact ? "unregistered_compact" : "unregistered_structure");
    }
    obj->confidence = clamp_value(0.76 + 0.12 * obj->features[10], 0.76, 0.89);
    obj->score = obj->confidence;
    return;
  }

  int free_slot = -1;
  int same_kind_count = 0;
  for (int i = 0; i < kMaxDatasetClasses; ++i) {
    if (s_dataset[i].active) {
      if (s_dataset[i].is_compact == compact) ++same_kind_count;
    } else if (free_slot < 0) {
      free_slot = i;
    }
  }

  if (free_slot >= 0) {
    DatasetClassEntry &created = s_dataset[free_slot];
    std::memset(&created, 0, sizeof(created));
    created.active = 1;
    created.is_compact = compact;
    created.sample_count = 1;
    if (has_webots_name) {
      std::snprintf(created.name, sizeof(created.name), "%s", resolved_webots_name);
    } else {
      std::snprintf(
          created.name,
          sizeof(created.name),
          "%s_%d",
          compact ? "learned_compact" : "learned_structure",
          same_kind_count + 1);
    }
    std::memcpy(created.features, obj->features, sizeof(created.features));
    save_dataset_to_file();

    std::snprintf(obj->label, sizeof(obj->label), "%s", created.name);
    obj->confidence = 0.87;
    obj->score = 0.87;
  }
}

int is_manipulator_self_mask(int x, int y, int width, int height) {
  if (y >= height - 5) return 1;
  const double arm_yaw = s_has_arm_joints ? s_arm_joints[0] : 0.0;
  const double arm_reach = s_has_arm_joints
                               ? (fabs(s_arm_joints[1]) + fabs(s_arm_joints[2]))
                               : 0.6;
  const double right_start_ratio = clamp_value(0.92 - arm_reach * 0.03 + arm_yaw * 0.04, 0.82, 0.95);
  const double top_start_ratio = clamp_value(0.62 - arm_reach * 0.06, 0.42, 0.72);
  if (x >= (int)(width * right_start_ratio) && y >= (int)(height * top_start_ratio)) {
    return 1;
  }
  return 0;
}

int build_dominant_palette(
    const PaletteSample *raw,
    int raw_count,
    double chrom_tol,
    int max_clusters,
    PaletteSample *out_samples,
    int max_out) {
  if (!raw || raw_count <= 0 || !out_samples || max_out <= 0) return 0;

  unsigned char assigned[96] = {};
  const int safe_raw = std::min(raw_count, 96);
  int out_count = 0;

  for (int cluster = 0; cluster < max_clusters && out_count < max_out; ++cluster) {
    int best_anchor = -1;
    int best_support = 0;
    for (int i = 0; i < safe_raw; ++i) {
      if (assigned[i]) continue;
      int support = 0;
      for (int j = 0; j < safe_raw; ++j) {
        if (assigned[j]) continue;
        const double cd =
            fabs(raw[i].rn - raw[j].rn) +
            fabs(raw[i].gn - raw[j].gn) +
            fabs(raw[i].bn - raw[j].bn);
        if (cd < chrom_tol) ++support;
      }
      if (support > best_support) {
        best_support = support;
        best_anchor = i;
      }
    }

    if (best_anchor < 0 || best_support < 3) break;

    const PaletteSample &anchor = raw[best_anchor];
    for (int i = 0; i < safe_raw && out_count < max_out; ++i) {
      if (assigned[i]) continue;
      const double cd =
          fabs(raw[i].rn - anchor.rn) +
          fabs(raw[i].gn - anchor.gn) +
          fabs(raw[i].bn - anchor.bn);
      if (cd < chrom_tol * 1.25) {
        assigned[i] = 1;
        out_samples[out_count++] = raw[i];
      }
    }
  }
  return out_count;
}

int matches_palette(
    unsigned char r,
    unsigned char g,
    unsigned char b,
    double luma,
    const PaletteSample *samples,
    int sample_count,
    double chrom_tol,
    double luma_tol) {
  if (!samples || sample_count < 3) return 0;
  const double sum = (double)r + (double)g + (double)b;
  if (sum <= 15.0) return 0;
  const double rn = (double)r / sum;
  const double gn = (double)g / sum;
  const double bn = (double)b / sum;

  int hits = 0;
  for (int i = 0; i < sample_count; ++i) {
    const double cd =
        fabs(rn - samples[i].rn) +
        fabs(gn - samples[i].gn) +
        fabs(bn - samples[i].bn);
    if (cd < chrom_tol && fabs(luma - samples[i].luma) < luma_tol) {
      if (++hits >= 2) return 1;
    }
  }
  return 0;
}

double estimate_visual_range_m(
    int width,
    int height,
    double effective_fov,
    int min_x,
    int max_x,
    int min_y,
    int max_y) {
  const double safe_fov = clamp_value(effective_fov > 1e-6 ? effective_fov : 1.05, 0.45, 2.40);
  const double half_w = 0.5 * (double)width;
  const double half_h = 0.5 * (double)height;
  const double focal_px = half_w / tan(0.5 * safe_fov);
  const double camera_height_m = 0.327;

  if (max_y < height - 5 && max_y > (int)half_h + 2) {
    const double v_norm = ((double)max_y - half_h) / fmax(focal_px, 1.0);
    const double ray_depression = atan(v_norm);
    if (ray_depression > 0.03) {
      return clamp_value(camera_height_m / tan(ray_depression), 0.14, 4.50);
    }
  }

  const double bbox_w = (double)std::max(max_x - min_x + 1, 4);
  return clamp_value((0.40 * focal_px) / bbox_w, 0.14, 4.50);
}

void update_tracked_target_memory(
    const ControllerWebotsDetectedObject *obj, double now_time) {
  if (!obj || obj->occluded_by_lidar) return;
  if (!obj->low_profile_confirmed && obj->features[9] >= 0.34) return;

  int best_idx = -1;
  double best_dist = 0.40;
  for (int i = 0; i < MAX_CAMERA_TRACKED_TARGETS; ++i) {
    if (!s_tracked_targets[i].active) continue;
    const double d = hypot(
        s_tracked_targets[i].world_x - obj->world_x,
        s_tracked_targets[i].world_z - obj->world_z);
    if (d < best_dist) {
      best_dist = d;
      best_idx = i;
    }
  }

  if (best_idx < 0) {
    int oldest_idx = 0;
    double oldest_time = 1e18;
    for (int i = 0; i < MAX_CAMERA_TRACKED_TARGETS; ++i) {
      if (!s_tracked_targets[i].active) {
        best_idx = i;
        break;
      }
      if (s_tracked_targets[i].last_seen_time < oldest_time) {
        oldest_time = s_tracked_targets[i].last_seen_time;
        oldest_idx = i;
      }
    }
    if (best_idx < 0) best_idx = oldest_idx;

    std::memset(&s_tracked_targets[best_idx], 0, sizeof(ControllerWebotsTrackedTarget));
    s_tracked_targets[best_idx].active = 1;
    s_tracked_targets[best_idx].type = obj->type;
    std::snprintf(
        s_tracked_targets[best_idx].label,
        sizeof(s_tracked_targets[best_idx].label),
        "%s",
        obj->label);
    s_tracked_targets[best_idx].world_x = obj->world_x;
    s_tracked_targets[best_idx].world_z = obj->world_z;
    s_tracked_targets[best_idx].confidence = obj->confidence;
    s_tracked_targets[best_idx].seen_count = 1;
    s_tracked_targets[best_idx].lidar_confirmed = obj->lidar_confirmed;
    s_tracked_targets[best_idx].low_profile_confirmed = obj->low_profile_confirmed;
    s_tracked_targets[best_idx].last_seen_time = now_time;
    return;
  }

  ControllerWebotsTrackedTarget *slot = &s_tracked_targets[best_idx];
  const double alpha = obj->lidar_confirmed ? 0.35 : 0.22;
  slot->world_x = (1.0 - alpha) * slot->world_x + alpha * obj->world_x;
  slot->world_z = (1.0 - alpha) * slot->world_z + alpha * obj->world_z;
  slot->seen_count += 1;
  slot->lidar_confirmed = slot->lidar_confirmed || obj->lidar_confirmed;
  slot->low_profile_confirmed = slot->low_profile_confirmed || obj->low_profile_confirmed;
  slot->confidence = clamp_value(std::max(slot->confidence, obj->confidence) + 0.02, 0.0, 0.99);
  slot->last_seen_time = now_time;
}

int query_lidar_sector(
    const float *ranges,
    int resolution,
    double fov,
    double center_angle,
    double half_window,
    double min_trace_range,
    double max_trace_range,
    double *out_min_range,
    double *out_median_range) {
  if (!ranges || resolution <= 1 || fov <= 1e-6) return 0;

  double hits[181];
  int hit_count = 0;
  double min_hit = max_trace_range;

  for (int i = 0; i < resolution; ++i) {
    const double alpha = (double)i / (double)(resolution - 1);
    const double beam_angle = -0.5 * fov + alpha * fov;
    if (fabs(beam_angle - center_angle) > half_window) continue;

    const double r = (double)ranges[i];
    if (!controller_math_is_finite(r) || r < min_trace_range || r >= max_trace_range - 0.02) {
      continue;
    }
    if (r < min_hit) min_hit = r;
    if (hit_count < 181) {
      hits[hit_count++] = r;
    }
  }

  if (hit_count <= 0) return 0;
  std::sort(hits, hits + hit_count);
  if (out_min_range) *out_min_range = min_hit;
  if (out_median_range) *out_median_range = hits[hit_count / 2];
  return hit_count;
}
}

void controller_webots_camera_set_active_target(
    int active, double target_world_x, double target_world_z) {
  s_has_active_target = active ? 1 : 0;
  s_active_target_x = target_world_x;
  s_active_target_z = target_world_z;
}

void controller_webots_camera_set_manipulator_joints(const double joints[5]) {
  if (!joints) return;
  for (int i = 0; i < 5; ++i) s_arm_joints[i] = joints[i];
  s_has_arm_joints = 1;
}

int controller_webots_camera_rename_dataset_class(
    const char *old_name, const char *new_name) {
  if (!old_name || !new_name || !old_name[0] || !new_name[0]) return 0;
  load_dataset_from_file();
  for (int i = 0; i < kMaxDatasetClasses; ++i) {
    if (s_dataset[i].active && std::strcmp(s_dataset[i].name, old_name) == 0) {
      std::snprintf(s_dataset[i].name, sizeof(s_dataset[i].name), "%s", new_name);
      save_dataset_to_file();
      return 1;
    }
  }
  return 0;
}

int controller_webots_camera_perception_confirm_range(
    ControllerWebotsCameraPerception *perception, double measured_range) {
  if (!perception || !perception->visible) return 0;
  if (!controller_math_is_finite(measured_range) || measured_range <= 0.05) {
    return perception->fallback_range_m > 0.05 ? 1 : 0;
  }

  if (perception->fallback_range_m > 0.05) {
    if (fabs(perception->fallback_range_m - measured_range) <= 0.55) {
      perception->fallback_range_m = measured_range;
      perception->confidence_boost += 2;
    }
  } else {
    perception->fallback_range_m = measured_range;
    perception->confidence_boost += 1;
  }
  return 1;
}

int controller_webots_camera_perception_analyze(
    const unsigned char *image,
    int width,
    int height,
    double effective_fov,
    double min_obstacle_score,
    ControllerWebotsCameraPerception *perception) {
  (void)min_obstacle_score;
  if (!image || !perception || width <= 4 || height <= 4) return -1;
  memset(perception, 0, sizeof(*perception));
  load_dataset_from_file();

  PaletteSample raw_floor[96];
  int raw_floor_count = 0;
  const int floor_rows[2] = {height - 5, height - 10};
  for (int r_idx = 0; r_idx < 2; ++r_idx) {
    const int sy = floor_rows[r_idx];
    if (sy <= 0 || sy >= height) continue;
    for (int sx = 4; sx < width - 4; sx += 8) {
      if (is_manipulator_self_mask(sx, sy, width, height)) continue;
      const int idx = (sy * width + sx) * 4;
      const double b = image[idx + 0];
      const double g = image[idx + 1];
      const double r = image[idx + 2];
      const double sum = r + g + b;
      const double luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (sum > 15.0 && raw_floor_count < 96) {
        raw_floor[raw_floor_count++] =
            PaletteSample{r / sum, g / sum, b / sum, luma};
      }
    }
  }
  PaletteSample floor_samples[96];
  const int floor_sample_count =
      build_dominant_palette(raw_floor, raw_floor_count, 0.12, 4, floor_samples, 96);

  PaletteSample raw_sky[96];
  int raw_sky_count = 0;
  const int sky_rows[2] = {4, 10};
  for (int r_idx = 0; r_idx < 2; ++r_idx) {
    const int sy = sky_rows[r_idx];
    if (sy <= 0 || sy >= height) continue;
    for (int sx = 4; sx < width - 4; sx += 8) {
      const int idx = (sy * width + sx) * 4;
      const double b = image[idx + 0];
      const double g = image[idx + 1];
      const double r = image[idx + 2];
      const double sum = r + g + b;
      const double luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (sum > 15.0 && raw_sky_count < 96) {
        raw_sky[raw_sky_count++] =
            PaletteSample{r / sum, g / sum, b / sum, luma};
      }
    }
  }
  PaletteSample sky_samples[96];
  const int sky_sample_count =
      build_dominant_palette(raw_sky, raw_sky_count, 0.10, 2, sky_samples, 96);

  const int stride = 2;
  const int y_start = std::max(2, (int)(height * 0.18));
  const int y_end = std::min(height - 5, (int)(height * 0.96));
  const int x_start = 2;
  const int x_end = width - 2;

  const int gw = std::min(kMaxGridW, (x_end - x_start + stride - 1) / stride);
  const int gh = std::min(kMaxGridH, (y_end - y_start + stride - 1) / stride);
  if (gw <= 2 || gh <= 2) return 0;

  const int grid_count = gw * gh;
  memset(s_cell_fg, 0, (size_t)grid_count);
  memset(s_cell_visited, 0, (size_t)grid_count);
  const int horizon_y = height / 2;

  for (int gy = 0; gy < gh; ++gy) {
    const int y = y_start + gy * stride;
    for (int gx = 0; gx < gw; ++gx) {
      const int x = x_start + gx * stride;
      if (is_manipulator_self_mask(x, y, width, height)) continue;

      const int idx = (y * width + x) * 4;
      const unsigned char b = image[idx + 0];
      const unsigned char g = image[idx + 1];
      const unsigned char r = image[idx + 2];
      const double luma = 0.299 * r + 0.587 * g + 0.114 * b;

      if (y >= horizon_y) {
        if (!matches_palette(r, g, b, luma, floor_samples, floor_sample_count, 0.14, 115.0)) {
          s_cell_fg[gy * gw + gx] = 1;
        }
      } else {
        if (!matches_palette(r, g, b, luma, sky_samples, sky_sample_count, 0.12, 75.0)) {
          s_cell_fg[gy * gw + gx] = 1;
        }
      }
    }
  }

  const double cx = 0.5 * (double)(width - 1);
  const double fov = effective_fov > 1e-6 ? effective_fov : 1.05;
  const double focal_px = cx / tan(0.5 * fov);
  const int dx8[8] = {-1, 0, 1, -1, 1, -1, 0, 1};
  const int dy8[8] = {-1, -1, -1, 0, 0, 1, 1, 1};

  for (int gy = 0; gy < gh; ++gy) {
    for (int gx = 0; gx < gw; ++gx) {
      const int start_idx = gy * gw + gx;
      if (!s_cell_fg[start_idx] || s_cell_visited[start_idx]) continue;

      int q_head = 0;
      int q_tail = 0;
      s_bfs_queue[q_tail++] = start_idx;
      s_cell_visited[start_idx] = 1;

      int cell_count = 0;
      double sum_x = 0.0;
      double sum_rn = 0.0, sum_gn = 0.0, sum_bn = 0.0;
      double sum_sat = 0.0, sum_luma = 0.0, sum_luma_sq = 0.0;
      int min_px = width, max_px = 0, min_py = height, max_py = 0;

      while (q_head < q_tail) {
        const int cur = s_bfs_queue[q_head++];
        const int cy = cur / gw;
        const int cxg = cur % gw;
        const int px = x_start + cxg * stride;
        const int py = y_start + cy * stride;

        const int pidx = (py * width + px) * 4;
        const double pb = image[pidx + 0];
        const double pg = image[pidx + 1];
        const double pr = image[pidx + 2];
        const double psum = std::max(pr + pg + pb, 1.0);
        const double pmax = std::max({pr, pg, pb});
        const double pmin = std::min({pr, pg, pb});
        const double pluma = (0.299 * pr + 0.587 * pg + 0.114 * pb) / 255.0;

        cell_count += 1;
        sum_x += (double)px;
        sum_rn += pr / psum;
        sum_gn += pg / psum;
        sum_bn += pb / psum;
        sum_sat += (pmax > 1.0 ? (pmax - pmin) / pmax : 0.0);
        sum_luma += pluma;
        sum_luma_sq += pluma * pluma;

        if (px < min_px) min_px = px;
        if (px > max_px) max_px = px;
        if (py < min_py) min_py = py;
        if (py > max_py) max_py = py;

        for (int dir = 0; dir < 8; ++dir) {
          const int nx = cxg + dx8[dir];
          const int ny = cy + dy8[dir];
          if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
          const int n_idx = ny * gw + nx;
          if (!s_cell_visited[n_idx] && s_cell_fg[n_idx]) {
            s_cell_visited[n_idx] = 1;
            s_bfs_queue[q_tail++] = n_idx;
          }
        }
      }

      if (cell_count < 8) continue;
      const int bbox_w = std::max(1, max_px - min_px + 1);
      const int bbox_h = std::max(1, max_py - min_py + 1);
      if (max_py < horizon_y + 3 || bbox_h < 7) continue;
      const double aspect = (double)bbox_w / (double)bbox_h;
      if (aspect > 3.8) continue;

      const double centroid_x = sum_x / (double)cell_count;
      const double center_offset = clamp_value((centroid_x - cx) / fmax(cx, 1.0), -1.0, 1.0);
      const double angle = atan2(centroid_x - cx, fmax(focal_px, 1.0));
      const double half_angle = atan2(0.5 * (double)bbox_w, fmax(focal_px, 1.0));
      const double visual_range = estimate_visual_range_m(
          width, height, fov, min_px, max_px, min_py, max_py);

      const double mean_luma = sum_luma / (double)cell_count;
      const double luma_var = std::max(0.0, (sum_luma_sq / (double)cell_count) - mean_luma * mean_luma);
      const double phys_w = clamp_value(((double)bbox_w * visual_range) / fmax(focal_px, 1.0), 0.02, 2.5);
      const double phys_h = clamp_value(((double)bbox_h * visual_range) / fmax(focal_px, 1.0), 0.02, 2.5);

      if (min_py >= horizon_y - 1) {
        if (bbox_w > (int)(width * 0.30) ||
            phys_w > 0.42 ||
            aspect > 2.0 ||
            cell_count > grid_count / 16) {
          continue;
        }
      }

      ControllerWebotsDetectedObject det = {};
      det.min_x = min_px;
      det.max_x = max_px;
      det.min_y = min_py;
      det.max_y = max_py;
      det.pixel_count = cell_count;
      det.center_offset = center_offset;
      det.angle = angle;
      det.half_angle_width = half_angle;
      det.visual_range_m = visual_range;
      det.range_m = visual_range;

      det.features[0] = sum_rn / (double)cell_count;
      det.features[1] = sum_gn / (double)cell_count;
      det.features[2] = sum_bn / (double)cell_count;
      det.features[3] = sum_sat / (double)cell_count;
      det.features[4] = mean_luma;
      det.features[5] = clamp_value(std::sqrt(luma_var) * 3.0, 0.0, 1.0);
      det.features[6] = clamp_value(aspect, 0.0, 3.0) / 3.0;
      det.features[7] = clamp_value((double)(horizon_y - min_py) / (double)bbox_h, 0.0, 1.0);
      det.features[8] = phys_w;
      det.features[9] = phys_h;
      det.features[10] = (min_py <= horizon_y - 3) ? 1.0 : 0.0;
      det.features[11] = (max_py >= horizon_y + 6) ? 1.0 : 0.0;

      if (perception->object_count < MAX_CAMERA_DETECTED_OBJECTS) {
        perception->objects[perception->object_count++] = det;
      }
    }
  }

  s_latest_perception = *perception;
  s_has_latest_perception = 1;
  return 0;
}

int controller_webots_camera_perception_fuse_lidar(
    ControllerWebotsCameraPerception *perception,
    const float *lidar_ranges,
    int lidar_resolution,
    double lidar_fov,
    double range_search_window,
    double min_trace_range,
    double max_trace_range,
    double sensor_local_x,
    double sensor_local_y,
    double robot_x,
    double robot_z,
    double robot_heading,
    double now_time) {
  if (!perception) return 0;

  const double sensor_origin_x =
      robot_x + cos(robot_heading) * sensor_local_x - sin(robot_heading) * sensor_local_y;
  const double sensor_origin_z =
      robot_z + sin(robot_heading) * sensor_local_x + cos(robot_heading) * sensor_local_y;
  const int lidar_ready =
      lidar_ranges && lidar_resolution > 1 && lidar_fov > 1e-6;
  const double focal_px = (0.5 * 320.0) / tan(0.5 * 1.05);
  const int horizon_y = 90;

  int any_confirmed = 0;

  for (int i = 0; i < perception->object_count; ++i) {
    ControllerWebotsDetectedObject *obj = &perception->objects[i];
    const double half_window =
        fmax(obj->half_angle_width + 0.04, fmax(range_search_window, 0.08));
    const int lidar_covers =
        lidar_ready && fabs(obj->angle) <= (0.5 * lidar_fov + half_window);

    double lidar_min_r = max_trace_range;
    double lidar_med_r = max_trace_range;
    const int hit_count =
        lidar_covers
            ? query_lidar_sector(
                  lidar_ranges,
                  lidar_resolution,
                  lidar_fov,
                  obj->angle,
                  half_window,
                  min_trace_range,
                  max_trace_range,
                  &lidar_min_r,
                  &lidar_med_r)
            : 0;

    if (hit_count >= 2) {
      obj->lidar_range_m = lidar_med_r;
      if (fabs(lidar_med_r - obj->visual_range_m) <= 0.55 && obj->min_y <= horizon_y) {
        obj->lidar_confirmed = 1;
        obj->low_profile_confirmed = 0;
        obj->range_m = lidar_med_r;
        obj->features[10] = 1.0;
        any_confirmed = 1;
      } else if (lidar_med_r > obj->visual_range_m + 0.45) {
        obj->lidar_confirmed = 0;
        obj->low_profile_confirmed = 1;
        obj->range_m = obj->visual_range_m;
        obj->features[10] = 0.0;
      } else if (lidar_min_r < obj->visual_range_m - 0.45) {
        obj->occluded_by_lidar = 1;
        obj->lidar_confirmed = 1;
        obj->range_m = lidar_min_r;
        obj->features[10] = 1.0;
        any_confirmed = 1;
      }
    } else if (lidar_covers) {
      obj->lidar_confirmed = 0;
      obj->low_profile_confirmed = 1;
      obj->lidar_range_m = max_trace_range;
      obj->range_m = obj->visual_range_m;
      obj->features[10] = 0.0;
    }

    const double bbox_w = (double)std::max(1, obj->max_x - obj->min_x + 1);
    const double bbox_h = (double)std::max(1, obj->max_y - obj->min_y + 1);
    obj->features[8] = clamp_value((bbox_w * obj->range_m) / focal_px, 0.02, 2.5);
    obj->features[9] = clamp_value((bbox_h * obj->range_m) / focal_px, 0.02, 2.5);

    const double world_angle = robot_heading - obj->angle;
    obj->world_x = sensor_origin_x + cos(world_angle) * obj->range_m;
    obj->world_z = sensor_origin_z + sin(world_angle) * obj->range_m;

    classify_or_discover_object(obj, obj->lidar_confirmed && !obj->occluded_by_lidar);
    if (obj->lidar_confirmed) {
      obj->confidence = clamp_value(std::max(obj->confidence, 0.86) + 0.05, 0.86, 0.99);
      obj->score = obj->confidence;
    }

    const int is_compact = (obj->low_profile_confirmed || obj->features[9] < 0.34) ? 1 : 0;
    if (is_compact && s_has_active_target &&
        hypot(obj->world_x - s_active_target_x, obj->world_z - s_active_target_z) <= 0.45) {
      obj->is_pickup_target = 1;
    } else {
      obj->is_pickup_target = 0;
    }

    if (is_compact && !obj->occluded_by_lidar) {
      update_tracked_target_memory(obj, now_time);
    }
  }

  int best_target_idx = -1;
  double best_target_rank = -1.0;
  for (int i = 0; i < perception->object_count; ++i) {
    const ControllerWebotsDetectedObject &obj = perception->objects[i];
    if (!obj.is_pickup_target || obj.occluded_by_lidar) continue;
    const double rank =
        obj.confidence + (obj.lidar_confirmed ? 0.15 : 0.0) -
        0.15 * fabs(obj.center_offset) - 0.10 * obj.range_m;
    if (rank > best_target_rank) {
      best_target_rank = rank;
      best_target_idx = i;
    }
  }

  if (best_target_idx >= 0) {
    const ControllerWebotsDetectedObject &t = perception->objects[best_target_idx];
    perception->target_visible = 1;
    perception->target_type = t.type;
    std::snprintf(perception->target_label, sizeof(perception->target_label), "%s", t.label);
    perception->target_score = t.score;
    perception->target_center_offset = t.center_offset;
    perception->target_angle = t.angle;
    perception->target_half_angle = t.half_angle_width;
    perception->target_range_m = t.range_m;
    perception->target_lidar_range_m = t.lidar_range_m;
    perception->target_lidar_confirmed = t.lidar_confirmed;
    perception->target_low_profile = t.low_profile_confirmed;
    perception->target_world_x = t.world_x;
    perception->target_world_z = t.world_z;
    perception->target_confidence = t.confidence;
  } else {
    perception->target_visible = 0;
  }

  int best_obstacle_idx = -1;
  double best_obstacle_range = 1e9;
  for (int i = 0; i < perception->object_count; ++i) {
    const ControllerWebotsDetectedObject &obj = perception->objects[i];
    if (obj.is_pickup_target) continue;
    if (lidar_ready && !obj.lidar_confirmed) continue;
    if (lidar_ready && obj.low_profile_confirmed) continue;
    if (obj.min_y > horizon_y) continue;

    const int is_compact = (obj.low_profile_confirmed || obj.features[9] < 0.34) ? 1 : 0;
    const int bbox_h = obj.max_y - obj.min_y + 1;
    if (is_compact && (obj.range_m > 1.45 || bbox_h < 10)) continue;

    if (obj.range_m < best_obstacle_range) {
      best_obstacle_range = obj.range_m;
      best_obstacle_idx = i;
    }
  }

  if (best_obstacle_idx >= 0) {
    const ControllerWebotsDetectedObject &p = perception->objects[best_obstacle_idx];
    perception->visible = 1;
    perception->detection_count = p.pixel_count;
    perception->score = p.score;
    perception->center_offset = p.center_offset;
    perception->angle = p.angle;
    perception->fallback_range_m = p.range_m;
    perception->obstacle_lidar_confirmed = p.lidar_confirmed;
    std::snprintf(perception->obstacle_label, sizeof(perception->obstacle_label), "%s", p.label);
    perception->confidence_boost =
        2 + (int)clamp_value(round(p.score * 4.0), 1.0, 4.0) + (p.lidar_confirmed ? 2 : 0);
  } else {
    perception->visible = 0;
    perception->detection_count = 0;
    perception->score = 0.0;
    perception->obstacle_lidar_confirmed = 0;
    perception->obstacle_label[0] = '\0';
  }

  s_latest_perception = *perception;
  s_has_latest_perception = 1;
  return any_confirmed;
}

int controller_webots_camera_get_latest_perception(
    ControllerWebotsCameraPerception *out_perception) {
  if (!out_perception || !s_has_latest_perception) return 0;
  *out_perception = s_latest_perception;
  return 1;
}

int controller_webots_camera_get_best_target(
    double robot_x,
    double robot_z,
    double now_time,
    double max_age_seconds,
    ControllerWebotsTrackedTarget *out_target) {
  if (!out_target) return 0;
  int best_idx = -1;
  double best_score = -1e9;

  for (int i = 0; i < MAX_CAMERA_TRACKED_TARGETS; ++i) {
    const ControllerWebotsTrackedTarget &t = s_tracked_targets[i];
    if (!t.active) continue;
    if (max_age_seconds > 0.0 && now_time - t.last_seen_time > max_age_seconds) continue;

    const double dist = hypot(t.world_x - robot_x, t.world_z - robot_z);
    const double score =
        t.confidence * 2.0 +
        (t.lidar_confirmed ? 0.5 : 0.0) +
        fmin((double)t.seen_count * 0.05, 0.6) -
        dist * 0.35;
    if (score > best_score) {
      best_score = score;
      best_idx = i;
    }
  }

  if (best_idx < 0) return 0;
  *out_target = s_tracked_targets[best_idx];
  return 1;
}

void controller_webots_camera_reset_tracked_targets(void) {
  std::memset(s_tracked_targets, 0, sizeof(s_tracked_targets));
  std::memset(&s_latest_perception, 0, sizeof(s_latest_perception));
  s_has_latest_perception = 0;
}
