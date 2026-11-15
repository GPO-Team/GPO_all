#include "controller_webots_camera_perception.h"

#include "controller_math.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>

struct DetectedObject {
  std::string label;
  int x;
  int y;
  int width;
  int height;
  double confidence;
  int observationCount;
};

class CameraPerceptionModule {
public:
  std::vector<DetectedObject> processCameraImage(const unsigned char *imageTag, int width, int height);
  std::vector<DetectedObject> getMemoryDatabase() const;

private:
  std::vector<DetectedObject> memoryDatabase;
};

struct FloorChromaticitySample {
  double rn;
  double gn;
  double bn;
  double luma;
  int is_right;
};

static int matches_floor_palette(
    unsigned char r,
    unsigned char g,
    unsigned char b,
    double luma,
    const FloorChromaticitySample *samples,
    int sample_count) {
  if (!samples || sample_count < 8) return 0;
  const double sum = (double)r + (double)g + (double)b;
  if (sum <= 15.0) return 0;

  const double rn = (double)r / sum;
  const double gn = (double)g / sum;
  const double bn = (double)b / sum;

  int left_matches = 0;
  int right_matches = 0;
  for (int i = 0; i < sample_count; ++i) {
    const double chrom_diff =
        fabs(rn - samples[i].rn) +
        fabs(gn - samples[i].gn) +
        fabs(bn - samples[i].bn);
    if (chrom_diff < 0.095 && fabs(luma - samples[i].luma) < 75.0) {
      if (samples[i].is_right) {
        ++right_matches;
      } else {
        ++left_matches;
      }
      if (left_matches >= 2 && right_matches >= 2) {
        return 1;
      }
    }
  }
  return 0;
}

static int classify_obstacle_pixel(
    unsigned char r,
    unsigned char g,
    unsigned char b,
    double bg_luma,
    const FloorChromaticitySample *floor_samples,
    int floor_sample_count,
    double *pixel_weight) {
  const int max_c = std::max({(int)r, (int)g, (int)b});
  const int min_c = std::min({(int)r, (int)g, (int)b});
  const int sat = max_c - min_c;
  const double luma = 0.299 * r + 0.587 * g + 0.114 * b;

  if (matches_floor_palette(r, g, b, luma, floor_samples, floor_sample_count)) {
    return 0;
  }

  if (sat >= 42 && max_c >= 65) {
    if (pixel_weight) *pixel_weight = 1.0 + clamp_value((double)(sat - 42) / 140.0, 0.0, 0.8);
    return 1;
  }

  if (bg_luma > 1.0 && fabs(luma - bg_luma) >= 58.0 && sat >= 14) {
    if (pixel_weight) *pixel_weight = 0.85;
    return 1;
  }

  if (bg_luma > 85.0 && luma < 42.0) {
    if (pixel_weight) *pixel_weight = 0.85;
    return 1;
  }

  return 0;
}

static double estimate_camera_visual_range_m(
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

  const double nominal_object_size_m = 0.36;
  const double camera_height_m = 0.28;
  const double camera_pitch_rad = 0.06;

  const double bbox_w = (double)std::max(max_x - min_x + 1, 4);
  const double bbox_h = (double)std::max(max_y - min_y + 1, 4);

  const double range_by_width = (nominal_object_size_m * focal_px) / bbox_w;
  const double range_by_height = (nominal_object_size_m * focal_px) / bbox_h;
  const double size_range = fmin(range_by_width, range_by_height);

  const int bottom_not_clipped = (max_y < height - 5) && (max_y > (int)half_h + 3);
  if (bottom_not_clipped) {
    const double v_norm = ((double)max_y - half_h) / fmax(focal_px, 1.0);
    const double ray_depression = camera_pitch_rad + atan(v_norm);
    if (ray_depression > 0.04) {
      const double ground_range = camera_height_m / tan(ray_depression);
      const double blended = 0.65 * ground_range + 0.35 * size_range;
      return clamp_value(blended, 0.16, 3.20);
    }
  }

  return clamp_value(size_range, 0.16, 3.20);
}

std::vector<DetectedObject> CameraPerceptionModule::processCameraImage(
    const unsigned char *imageTag, int width, int height) {
  std::vector<DetectedObject> currentFrameObjects;
  if (!imageTag || width <= 4 || height <= 4) return currentFrameObjects;

  ControllerWebotsCameraPerception perception;
  if (controller_webots_camera_perception_analyze(
          imageTag, width, height, 1.05, 0.02, &perception) == 0 &&
      perception.visible) {
    const int cx = (int)((perception.center_offset * 0.5 + 0.5) * (width - 1));
    const int cy = height / 2;
    const int pixelIndex = (cy * width + clamp_value(cx, 0, width - 1)) * 4;
    const unsigned char b = imageTag[pixelIndex + 0];
    const unsigned char g = imageTag[pixelIndex + 1];
    const unsigned char r = imageTag[pixelIndex + 2];

    std::string detectedLabel = "obstacle_detected";
    if (r > 140 && g < 110 && b < 110) detectedLabel = "obstacle_red_box";
    else if (g > 140 && r < 110 && b < 110) detectedLabel = "obstacle_green_cylinder";
    else if (b > 140 && r < 110 && g < 110) detectedLabel = "target_blue_zone";
    else if (r > 180 && g > 180 && b < 110) detectedLabel = "obstacle_yellow_marker";

    DetectedObject obj;
    obj.label = detectedLabel;
    obj.x = std::max(0, cx - 20);
    obj.y = std::max(0, cy - 20);
    obj.width = 40;
    obj.height = 40;
    obj.confidence = clamp_value(perception.score, 0.5, 0.99);
    obj.observationCount = perception.detection_count;
    currentFrameObjects.push_back(obj);

    bool found = false;
    for (auto &mem : memoryDatabase) {
      if (mem.label == obj.label) {
        mem.observationCount++;
        mem.confidence = std::min(0.99, mem.confidence + 0.01);
        found = true;
        break;
      }
    }
    if (!found) {
      memoryDatabase.push_back(obj);
    }
  }
  return currentFrameObjects;
}

std::vector<DetectedObject> CameraPerceptionModule::getMemoryDatabase() const {
  return memoryDatabase;
}

int controller_webots_camera_perception_confirm_range(
    ControllerWebotsCameraPerception *perception, double measured_range) {
  if (!perception || !perception->visible) return 0;
  if (!controller_math_is_finite(measured_range) || measured_range <= 0.05) {
    return perception->fallback_range_m > 0.05 ? 1 : 0;
  }

  if (perception->fallback_range_m > 0.05) {
    if (fabs(perception->fallback_range_m - measured_range) <= 0.65) {
      perception->fallback_range_m =
          0.75 * perception->fallback_range_m + 0.25 * measured_range;
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
  if (!image || !perception || width <= 4 || height <= 4) return -1;
  memset(perception, 0, sizeof(*perception));

  FloorChromaticitySample floor_samples[72];
  int floor_sample_count = 0;
  double bg_luma_sum = 0.0;
  int bg_samples = 0;

  const int sample_rows[2] = {height - 4, std::max(2, height - 10)};
  const int left_end = std::max(8, (int)(width * 0.32));
  const int right_start = std::min(width - 8, (int)(width * 0.68));

  for (int r_idx = 0; r_idx < 2; ++r_idx) {
    const int sy = sample_rows[r_idx];
    for (int sx = 4; sx < width - 4; sx += 6) {
      const int idx = (sy * width + sx) * 4;
      const unsigned char b = image[idx + 0];
      const unsigned char g = image[idx + 1];
      const unsigned char r = image[idx + 2];
      const double sum = (double)r + (double)g + (double)b;
      const double luma = 0.299 * r + 0.587 * g + 0.114 * b;

      if (r_idx == 0) {
        bg_luma_sum += luma;
        bg_samples += 1;
      }

      if (sum > 15.0 && (sx <= left_end || sx >= right_start) && floor_sample_count < 72) {
        floor_samples[floor_sample_count++] = FloorChromaticitySample{
            (double)r / sum,
            (double)g / sum,
            (double)b / sum,
            luma,
            sx >= right_start ? 1 : 0,
        };
      }
    }
  }
  const double bg_luma = bg_samples > 0 ? (bg_luma_sum / (double)bg_samples) : 0.0;

  const int stride = 2;
  const int y_start = std::max(2, (int)(height * 0.38));
  const int y_end = std::min(height - 3, (int)(height * 0.94));
  const int x_start = 2;
  const int x_end = width - 2;

  int hit_pixels = 0;
  int total_sampled = 0;
  double weighted_x_sum = 0.0;
  double total_weight = 0.0;
  int min_x = width;
  int max_x = 0;
  int min_y = height;
  int max_y = 0;

  for (int y = y_start; y < y_end; y += stride) {
    for (int x = x_start; x < x_end; x += stride) {
      total_sampled += 1;
      const int pixel_index = (y * width + x) * 4;
      const unsigned char b = image[pixel_index + 0];
      const unsigned char g = image[pixel_index + 1];
      const unsigned char r = image[pixel_index + 2];

      double weight = 0.0;
      if (classify_obstacle_pixel(
              r, g, b, bg_luma, floor_samples, floor_sample_count, &weight)) {
        hit_pixels += 1;
        weighted_x_sum += (double)x * weight;
        total_weight += weight;
        if (x < min_x) min_x = x;
        if (x > max_x) max_x = x;
        if (y < min_y) min_y = y;
        if (y > max_y) max_y = y;
      }
    }
  }

  if (total_sampled <= 0 || hit_pixels < 8 || total_weight <= 1e-6) {
    perception->visible = 0;
    perception->score = 0.0;
    return 0;
  }

  const double raw_score = clamp_value(
      ((double)hit_pixels / (double)total_sampled) * 4.5,
      0.0,
      1.0);
  if (raw_score < min_obstacle_score) {
    perception->visible = 0;
    perception->score = raw_score;
    return 0;
  }

  const double cx = 0.5 * (double)(width - 1);
  const double centroid_x = weighted_x_sum / total_weight;
  const double center_offset = clamp_value((centroid_x - cx) / fmax(cx, 1.0), -1.0, 1.0);
  const double fov = effective_fov > 1e-6 ? effective_fov : 1.05;
  const double angle = center_offset * (0.5 * fov);
  const double visual_range = estimate_camera_visual_range_m(
      width, height, fov, min_x, max_x, min_y, max_y);

  perception->visible = 1;
  perception->detection_count = hit_pixels;
  perception->score = raw_score;
  perception->center_offset = center_offset;
  perception->angle = angle;
  perception->fallback_range_m = visual_range;
  perception->confidence_boost =
      1 + (int)clamp_value(round(raw_score * 5.0), 1.0, 5.0);
  return 0;
}