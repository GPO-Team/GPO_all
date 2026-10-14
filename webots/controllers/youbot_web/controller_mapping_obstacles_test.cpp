#include "controller_mapping_obstacles.h"

int main(void) {
  const MapCell map[1] = {{1.0, 1.0, 3}};
  const ObstacleTracePoint trace[1] = {{2.0, 0.0, 9.5, 4}};
  const ControllerMappingObstacles obstacles = {
      .map = map,
      .map_count = 1,
      .trace = trace,
      .trace_count = 1,
      .now_time = 10.0,
      .trace_ttl_seconds = 6.0,
      .min_trace_confidence = 0.18,
  };
  if (!controller_mapping_obstacles_map_near(&obstacles, 1.1, 1.0, 0.11)) return 1;
  if (!controller_mapping_obstacles_recent_trace_near(&obstacles, 2.1, 0.0, 0.11)) return 2;
  if (controller_mapping_obstacles_known_near(&obstacles, 4.0, 4.0, 0.2)) return 3;
  if (controller_mapping_obstacles_segment_clear(
          &obstacles, 0.0, 0.0, 3.0, 0.0, 0.2, 0.25, 0.4)) return 4;
  if (!controller_mapping_obstacles_segment_clear(
          &obstacles, 0.0, 0.0, 0.8, 0.0, 0.2, 0.25, 0.4)) return 5;
  return 0;
}
