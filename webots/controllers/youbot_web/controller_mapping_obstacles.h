#ifndef YOUBOT_WEB_CONTROLLER_MAPPING_OBSTACLES_H
#define YOUBOT_WEB_CONTROLLER_MAPPING_OBSTACLES_H

#include "controller_types.h"

typedef struct {
  const MapCell *map;
  int map_count;
  const ObstacleTracePoint *trace;
  int trace_count;
  double now_time;
  double trace_ttl_seconds;
  double min_trace_confidence;
} ControllerMappingObstacles;

int controller_mapping_obstacles_map_near(
    const ControllerMappingObstacles *obstacles, double x, double y, double clearance);
int controller_mapping_obstacles_recent_trace_near(
    const ControllerMappingObstacles *obstacles, double x, double y, double clearance);
int controller_mapping_obstacles_known_near(
    const ControllerMappingObstacles *obstacles, double x, double y, double clearance);
int controller_mapping_obstacles_segment_clear(
    const ControllerMappingObstacles *obstacles,
    double ax,
    double ay,
    double bx,
    double by,
    double clearance,
    double grid_cell,
    double near_robot_ignore_radius);

#endif
