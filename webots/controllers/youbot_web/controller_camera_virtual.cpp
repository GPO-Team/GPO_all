#include "controller_camera_virtual.h"

#include <cmath>

static double clamp_value(double value, double min_value, double max_value) {
  if (value < min_value) return min_value;
  if (value > max_value) return max_value;
  return value;
}

static void append_cluster(
    ControllerCameraVirtualCluster *clusters,
    int capacity,
    ControllerCameraVirtualSummary *summary,
    int beams,
    double min_range,
    double angle_sum,
    double weight_sum) {
  if (summary->cluster_count >= capacity || beams < 2) return;
  clusters[summary->cluster_count++] = ControllerCameraVirtualCluster{
      angle_sum / fmax(weight_sum, 1e-9), min_range, beams};
}

void controller_camera_virtual_collect(
    const float *ranges,
    int resolution,
    const ControllerCameraVirtualConfig *config,
    ControllerCameraVirtualCluster *clusters,
    int capacity,
    ControllerCameraVirtualSummary *summary) {
  if (!summary) return;
  *summary = ControllerCameraVirtualSummary{0};
  if (!ranges || !config || !clusters || resolution <= 1 || capacity <= 0 ||
      config->lidar_fov <= 0.0 || config->effective_fov <= 0.0) return;

  int in_cluster = 0;
  int cluster_beams = 0;
  double cluster_min_range = config->max_range;
  double cluster_angle_sum = 0.0;
  double cluster_weight_sum = 0.0;
  double previous_range = 0.0;
  for (int i = 0; i < resolution; ++i) {
    const double alpha = (double)i / (double)(resolution - 1);
    const double angle = -0.5 * config->lidar_fov + alpha * config->lidar_fov;
    const double range = ranges[i];
    const int valid = fabs(angle) <= config->effective_fov * 0.5 &&
                      std::isfinite(range) && range > config->min_range;
    const int hit = valid && range < config->max_range - 0.04;
    if (valid) summary->total_beams += 1;
    if (valid && range < config->caution_range) {
      const double offset = clamp_value(angle / (config->effective_fov * 0.5), -1.0, 1.0);
      const double closeness = clamp_value(
          (config->caution_range - range) / fmax(config->caution_range - config->stop_range, 0.05),
          0.0, 1.0);
      summary->close_beams += 1;
      summary->weighted_offset_sum += offset * (0.25 + closeness);
      summary->weight_sum += 0.25 + closeness;
    }
    if ((!hit || (in_cluster && fabs(range - previous_range) > config->cluster_jump)) && in_cluster) {
      append_cluster(clusters, capacity, summary, cluster_beams, cluster_min_range,
                     cluster_angle_sum, cluster_weight_sum);
      in_cluster = 0; cluster_beams = 0; cluster_min_range = config->max_range;
      cluster_angle_sum = 0.0; cluster_weight_sum = 0.0;
    }
    if (hit) {
      const double weight = 1.0 / fmax(range, 0.16);
      in_cluster = 1; cluster_beams += 1;
      if (range < cluster_min_range) cluster_min_range = range;
      cluster_angle_sum += angle * weight; cluster_weight_sum += weight; previous_range = range;
    }
  }
  if (in_cluster) append_cluster(clusters, capacity, summary, cluster_beams, cluster_min_range,
                                 cluster_angle_sum, cluster_weight_sum);
}

void controller_camera_virtual_sort_by_range_desc(
    ControllerCameraVirtualCluster *clusters,
    int count) {
  if (!clusters || count <= 1) return;
  for (int i = 0; i < count; ++i) for (int j = i + 1; j < count; ++j) {
    if (clusters[i].range < clusters[j].range) {
      const ControllerCameraVirtualCluster swap = clusters[i]; clusters[i] = clusters[j]; clusters[j] = swap;
    }
  }
}

int controller_camera_virtual_box(
    const ControllerCameraVirtualCluster *cluster,
    const ControllerCameraVirtualConfig *config,
    int frame_width,
    int frame_height,
    ControllerCameraVirtualBox *box) {
  if (!cluster || !config || !box || frame_width <= 0 || frame_height <= 0 ||
      config->effective_fov <= 0.0) return 0;
  const double range = clamp_value(cluster->range, 0.12, config->max_range);
  const double offset = clamp_value(cluster->angle / (config->effective_fov * 0.5), -1.0, 1.0);
  const int horizon = (int)(frame_height * 0.42);
  const double depth = clamp_value(
      (range - 0.15) / fmax(config->max_range - 0.15, 0.1), 0.0, 1.0);
  box->screen_x = (int)((offset * 0.5 + 0.5) * (frame_width - 1));
  box->bottom_y = horizon + (int)((frame_height - horizon - 4) * (1.0 - depth * 0.82));
  box->height = (int)clamp_value(82.0 / (range + 0.34), 16, 112);
  box->width = (int)clamp_value(cluster->beams * 2.8 + 36.0 / (range + 0.32), 14, 96);
  box->danger = clamp_value(
      (config->caution_range - range) / fmax(config->caution_range - config->stop_range, 0.05),
      0.0, 1.0);
  return 1;
}

ControllerCameraVirtualObservation controller_camera_virtual_observation(
    const ControllerCameraVirtualSummary *summary,
    double min_score) {
  ControllerCameraVirtualObservation observation = {0};
  if (!summary || summary->total_beams <= 0 || summary->close_beams <= 0 ||
      summary->weight_sum <= 1e-9) return observation;
  observation.score = (double)summary->close_beams / (double)summary->total_beams;
  if (observation.score < min_score) return observation;
  observation.visible = 1;
  observation.center_offset = clamp_value(
      summary->weighted_offset_sum / summary->weight_sum, -1.0, 1.0);
  observation.detection_count = summary->close_beams;
  return observation;
}
