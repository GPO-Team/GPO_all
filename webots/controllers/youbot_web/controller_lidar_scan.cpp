#include "controller_lidar_scan.h"

#include "controller_lidar_math.h"
#include "controller_lidar_trace.h"

#include <cmath>

#define CONTROLLER_LIDAR_SCAN_EPS 1e-9

void controller_lidar_scan_capture(
    const ControllerLidarScanConfig *config,
    const float *ranges,
    int resolution,
    double fov,
    double sensor_max_range,
    double robot_x,
    double robot_y,
    double heading,
    double now_time,
    ObstacleTracePoint *trace,
    int *trace_count,
    int trace_capacity,
    ControllerLidarScanStats *stats) {
  if (!config || !stats) return;

  const double effective_max_range = sensor_max_range > CONTROLLER_LIDAR_SCAN_EPS
                                         ? fmin(sensor_max_range, config->max_trace_range)
                                         : config->max_trace_range;
  *stats = ControllerLidarScanStats{
      0,
      0,
      effective_max_range,
      effective_max_range,
      effective_max_range,
      effective_max_range,
      effective_max_range,
      effective_max_range,
  };
  if (!ranges || resolution <= 1 || fov <= CONTROLLER_LIDAR_SCAN_EPS || !trace ||
      !trace_count || trace_capacity <= 0 || config->sample_stride <= 0) {
    return;
  }

  const double sensor_origin_x =
      robot_x + cos(heading) * config->sensor_local_x - sin(heading) * config->sensor_local_y;
  const double sensor_origin_y =
      robot_y + sin(heading) * config->sensor_local_x + cos(heading) * config->sensor_local_y;

  for (int i = 0; i < resolution; i += config->sample_stride) {
    const double range = (double)ranges[i];
    if (!std::isfinite(range) || range < config->min_trace_range || range > effective_max_range ||
        range >= effective_max_range - 0.02) {
      continue;
    }
    if (!controller_lidar_hit_is_consistent(
            ranges,
            resolution,
            i,
            range,
            effective_max_range,
            config->sample_stride,
            config->min_trace_range,
            config->range_jump_tolerance)) {
      continue;
    }

    const double alpha = (double)i / (double)(resolution - 1);
    const double beam_angle = -0.5 * fov + alpha * fov;
    if (fabs(beam_angle) <= config->front_sector_rad) {
      stats->front_hit_count += 1;
      if (range < stats->front_min_range) stats->front_min_range = range;
      if (fabs(beam_angle) <= config->center_sector_rad && range < stats->center_min_range) {
        stats->center_min_range = range;
      }
      if (beam_angle <= -config->front_corner_min_rad &&
          beam_angle >= -config->front_corner_max_rad && range < stats->left_front_min_range) {
        stats->left_front_min_range = range;
      }
      if (beam_angle >= config->front_corner_min_rad &&
          beam_angle <= config->front_corner_max_rad && range < stats->right_front_min_range) {
        stats->right_front_min_range = range;
      }
    } else if (beam_angle < 0.0) {
      if (range < stats->left_min_range) stats->left_min_range = range;
    } else if (range < stats->right_min_range) {
      stats->right_min_range = range;
    }

    const double world_angle = heading - beam_angle;
    const double hit_x = sensor_origin_x + cos(world_angle) * range;
    const double hit_y = sensor_origin_y + sin(world_angle) * range;
    const double robot_dx = hit_x - robot_x;
    const double robot_dy = hit_y - robot_y;
    if (sqrt(robot_dx * robot_dx + robot_dy * robot_dy) < config->near_robot_ignore_radius) {
      continue;
    }

    const double snapped_hit_x = round(hit_x / config->snap_step) * config->snap_step;
    const double snapped_hit_y = round(hit_y / config->snap_step) * config->snap_step;
    controller_lidar_trace_append(
        trace,
        trace_count,
        trace_capacity,
        config->trace_spacing,
        snapped_hit_x,
        snapped_hit_y,
        now_time);
    stats->hit_count += 1;
  }
}
