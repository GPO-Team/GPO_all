#include "controller_lidar_trace.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

int main(void) {
  ObstacleTracePoint trace[2] = {0};
  int trace_count = 0;

  controller_lidar_trace_append(trace, &trace_count, 2, 0.10, 1.0, 2.0, 3.0);
  if (trace_count != 1 || trace[0].hit_count != 1) return 1;

  controller_lidar_trace_append(trace, &trace_count, 2, 0.10, 1.05, 2.0, 4.0);
  if (trace_count != 1 || trace[0].hit_count != 2) return 2;
  if (!nearly_equal(trace[0].x, 1.016) || !nearly_equal(trace[0].last_seen_time, 4.0)) return 3;

  controller_lidar_trace_append(trace, &trace_count, 2, 0.10, 3.0, 4.0, 5.0);
  controller_lidar_trace_append(trace, &trace_count, 2, 0.10, 6.0, 7.0, 6.0);
  if (trace_count != 2 || !nearly_equal(trace[0].x, 6.0) || trace[0].hit_count != 1) return 4;

  controller_lidar_trace_prune(trace, &trace_count, 6.5, 1.0);
  if (trace_count != 1 || !nearly_equal(trace[0].x, 6.0)) return 5;

  MapCell map[2] = {0};
  int map_count = 0;
  int map_dirty = 0;
  trace[0] = ObstacleTracePoint{1.02, 2.02, 6.0, 2};
  controller_lidar_trace_merge_into_map(
      trace, 1, 6.5, 1.0, 2, map, &map_count, 2, 0.10, 1e-9, &map_dirty);
  if (map_count != 1 || !map_dirty || !nearly_equal(map[0].x, 1.0) || map[0].confidence != 1) {
    return 6;
  }

  map_dirty = 0;
  controller_lidar_trace_merge_into_map(
      trace, 1, 6.5, 1.0, 2, map, &map_count, 2, 0.10, 1e-9, &map_dirty);
  if (map_count != 1 || !map_dirty || map[0].confidence != 2) return 7;

  return 0;
}
