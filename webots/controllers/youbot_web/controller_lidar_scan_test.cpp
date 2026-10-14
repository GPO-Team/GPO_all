#include "controller_lidar_scan.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

int main(void) {
  const ControllerLidarScanConfig config = {
      1,
      0.08,
      3.0,
      0.55,
      0.0,
      0.0,
      0.40,
      0.13,
      0.14,
      0.42,
      0.25,
      0.01,
      0.05,
  };
  const float ranges[5] = {2.0f, 1.0f, 0.5f, 1.2f, 2.0f};
  ObstacleTracePoint trace[8] = {0};
  int trace_count = 0;
  ControllerLidarScanStats stats;

  controller_lidar_scan_capture(
      &config,
      ranges,
      5,
      1.0,
      3.0,
      0.0,
      0.0,
      0.0,
      7.0,
      trace,
      &trace_count,
      8,
      &stats);

  if (stats.hit_count != 2 || stats.front_hit_count != 2) return 1;
  if (!nearly_equal(stats.front_min_range, 0.5) ||
      !nearly_equal(stats.center_min_range, 0.5) ||
      !nearly_equal(stats.left_front_min_range, 1.0) ||
      !nearly_equal(stats.right_front_min_range, 3.0)) {
    return 2;
  }
  if (trace_count != 2 || !nearly_equal(trace[0].last_seen_time, 7.0)) return 3;
  if (!nearly_equal(trace[0].x, 0.97) || !nearly_equal(trace[0].y, 0.25)) return 4;
  if (!nearly_equal(trace[1].x, 0.5) || !nearly_equal(trace[1].y, 0.0)) return 5;

  return 0;
}
