#include "controller_lidar_math.h"

#include <cmath>
#include <stddef.h>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  if (!nearly_equal(controller_lidar_range_pressure(0.4, 1.0, 0.4), 1.0)) return 1;
  if (!nearly_equal(controller_lidar_range_pressure(1.0, 1.0, 0.4), 0.0)) return 2;
  if (!nearly_equal(controller_lidar_range_pressure(0.7, 1.0, 0.4), 0.5)) return 3;
  if (!nearly_equal(controller_lidar_range_pressure(0.5, 0.4, 0.4), 0.0)) return 4;
  if (!nearly_equal(controller_lidar_range_pressure(0.4, 0.4, 0.4), 1.0)) return 5;

  const float supported_ranges[] = {1.0f, 5.0f, 1.2f, 5.0f, 1.1f};
  if (!controller_lidar_hit_is_consistent(
          supported_ranges, 5, 2, 1.2, 4.0, 2, 0.08, 0.55)) {
    return 6;
  }

  const float isolated_ranges[] = {2.0f, 5.0f, 1.2f, 5.0f, 2.1f};
  if (controller_lidar_hit_is_consistent(
          isolated_ranges, 5, 2, 1.2, 4.0, 2, 0.08, 0.55)) {
    return 7;
  }

  const float no_valid_neighbors[] = {NAN, 5.0f, 1.2f, 5.0f, INFINITY};
  if (!controller_lidar_hit_is_consistent(
          no_valid_neighbors, 5, 2, 1.2, 4.0, 2, 0.08, 0.55)) {
    return 8;
  }

  const ObstacleTracePoint trace = {0.0, 0.0, 8.0, 2};
  if (!nearly_equal(controller_lidar_trace_confidence(&trace, 10.0, 6.0), 1.0 / 3.0)) {
    return 9;
  }
  if (!nearly_equal(controller_lidar_trace_confidence(NULL, 10.0, 6.0), 0.0)) return 10;

  const ControllerLidarContextConfig context_config = {
      4.0,
      1.0,
      0.4,
      1.2,
      0.7,
      0.2,
      0.25,
      0.65,
      0.5,
  };
  LidarObstacleContext context;
  controller_lidar_context_init(&context, context_config.effective_max_range);
  if (!nearly_equal(context.unexpected_front_min_range, 4.0)) return 11;
  if (!nearly_equal(context.best_gap_score, -1e9) || context.has_best_gap) return 12;

  controller_lidar_context_observe(
      &context, &context_config, 0.5, 0.0, 1, 1, 0.0, 0.0);
  if (!nearly_equal(context.expected_front_min_range, 0.5)) return 13;
  if (context.expected_front_score <= 0.0 || context.unexpected_front_hit_count != 0) return 14;

  controller_lidar_context_observe(
      &context, &context_config, 0.4, 0.0, 1, 0, 0.0, 0.0);
  if (!context.has_closest_unexpected ||
      !nearly_equal(context.closest_unexpected_range, 0.4)) {
    return 15;
  }
  if (context.unexpected_front_hit_count != 1 ||
      !nearly_equal(context.unexpected_center_min_range, 0.4)) {
    return 16;
  }

  controller_lidar_context_observe(
      &context, &context_config, 3.0, -0.5, 0, 0, -0.45, 1.0);
  if (!context.has_best_gap || !nearly_equal(context.best_gap_beam_angle, -0.5) ||
      !nearly_equal(context.best_gap_range, 3.0)) {
    return 17;
  }

  return 0;
}
