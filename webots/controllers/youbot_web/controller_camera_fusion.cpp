#include "controller_camera_fusion.h"

#include <cmath>

int controller_camera_fusion_confirmed_range(
    const float *ranges,
    int resolution,
    double lidar_fov,
    double relative_angle,
    double search_window_rad,
    double min_range,
    double max_range,
    double *confirmed_range) {
  if (!confirmed_range || !ranges || resolution <= 1 || lidar_fov <= 0.0 ||
      search_window_rad <= 0.0 || max_range <= min_range) {
    return 0;
  }

  double best_range = max_range;
  double best_angle_error = search_window_rad;
  for (int i = 0; i < resolution; ++i) {
    const double alpha = (double)i / (double)(resolution - 1);
    const double beam_angle = -0.5 * lidar_fov + alpha * lidar_fov;
    const double angle_error = fabs(beam_angle - relative_angle);
    const double range = ranges[i];
    if (angle_error > search_window_rad || !std::isfinite(range) || range <= min_range ||
        range >= max_range - 0.03) {
      continue;
    }

    if (range < best_range || angle_error < best_angle_error * 0.55) {
      best_range = range;
      best_angle_error = angle_error;
    }
  }

  if (best_range >= max_range) return 0;
  *confirmed_range = best_range;
  return 1;
}

double controller_camera_fusion_estimate_range(
    const float *ranges,
    int resolution,
    double lidar_fov,
    double relative_angle,
    double search_window_rad,
    double min_range,
    double max_range,
    double fallback_range) {
  double confirmed_range = fallback_range;
  return controller_camera_fusion_confirmed_range(
             ranges, resolution, lidar_fov, relative_angle, search_window_rad,
             min_range, max_range, &confirmed_range)
             ? confirmed_range
             : fallback_range;
}
