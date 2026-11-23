#include "controller_mapping_obstacles.h"

#include "controller_lidar_math.h"

#include <cmath>

int controller_mapping_obstacles_map_near(
    const ControllerMappingObstacles *obstacles, double x, double y, double clearance) {
  if (!obstacles || !obstacles->map) return 0;
  const double clearance_squared = clearance * clearance;
  for (int i = 0; i < obstacles->map_count; ++i) {
    const double dx = obstacles->map[i].x - x;
    const double dy = obstacles->map[i].y - y;
    if (dx * dx + dy * dy <= clearance_squared) return 1;
  }
  return 0;
}

int controller_mapping_obstacles_recent_trace_near(
    const ControllerMappingObstacles *obstacles, double x, double y, double clearance) {
  if (!obstacles || !obstacles->trace) return 0;
  const double clearance_squared = clearance * clearance;
  for (int i = 0; i < obstacles->trace_count; ++i) {
    if (controller_lidar_trace_confidence(
            &obstacles->trace[i], obstacles->now_time, obstacles->trace_ttl_seconds) <
        obstacles->min_trace_confidence) continue;
    const double dx = obstacles->trace[i].x - x;
    const double dy = obstacles->trace[i].y - y;
    if (dx * dx + dy * dy <= clearance_squared) return 1;
  }
  return 0;
}

int controller_mapping_obstacles_known_near(
    const ControllerMappingObstacles *obstacles, double x, double y, double clearance) {
  return controller_mapping_obstacles_map_near(obstacles, x, y, clearance) ||
         controller_mapping_obstacles_recent_trace_near(obstacles, x, y, clearance);
}

int controller_mapping_obstacles_segment_clear(
    const ControllerMappingObstacles *obstacles,
    double ax,
    double ay,
    double bx,
    double by,
    double clearance,
    double grid_cell,
    double near_robot_ignore_radius) {
  const double dx = bx - ax;
  const double dy = by - ay;
  const double length = hypot(dx, dy);
  const int steps = (int)ceil(length / fmax(grid_cell * 0.9, 0.06));
  for (int i = 0; i <= steps; ++i) {
    const double t = steps > 0 ? (double)i / (double)steps : 0.0;
    if (length * t < near_robot_ignore_radius + 0.18) continue;
    if (controller_mapping_obstacles_known_near(
            obstacles, ax + dx * t, ay + dy * t, clearance)) return 0;
  }
  return 1;
}
