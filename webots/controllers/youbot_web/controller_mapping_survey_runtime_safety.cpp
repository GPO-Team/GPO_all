#include "controller_mapping_survey_runtime_safety.h"

#include "controller_mapping_obstacles.h"
#include "controller_zone_geometry.h"

#include <cmath>

static ControllerMappingObstacles obstacles_for(
    const ControllerMappingSurveySafetyContext *context) {
  return ControllerMappingObstacles{
      context->persistent_map, context->persistent_map_count,
      context->obstacle_trace, context->obstacle_trace_count,
      context->now, context->trace_ttl_seconds, context->trace_clearance};
}

int controller_mapping_survey_runtime_point_safe(
    const ControllerMappingSurveySafetyContext *context,
    double x, double y, int room_zone_index, double clearance) {
  if (!context || !context->zones) return 0;
  if (room_zone_index >= 0 && room_zone_index < context->zones->count) {
    const LimitZone *room = &context->zones->zones[room_zone_index];
    if (!controller_zone_geometry_point_in(x, y, room) ||
        controller_zone_geometry_point_near_boundary(x, y, room, clearance * 0.72)) return 0;
  } else if (x < -context->max_extent_x || x > context->max_extent_x ||
             y < -context->max_extent_y || y > context->max_extent_y) return 0;
  for (int i = 0; i < context->zones->count; ++i) {
    if (i != room_zone_index && controller_zone_geometry_point_near(
        x, y, &context->zones->zones[i], clearance)) return 0;
  }
  const ControllerMappingObstacles obstacles = obstacles_for(context);
  return !controller_mapping_obstacles_map_near(
      &obstacles, x, y, fmax(clearance, context->obstacle_clearance));
}

int controller_mapping_survey_runtime_segment_safe(
    const ControllerMappingSurveySafetyContext *context,
    double ax, double ay, double bx, double by, int room_zone_index, double clearance) {
  if (!context) return 0;
  const int steps = (int)ceil(hypot(bx - ax, by - ay) / fmax(context->grid_cell * 0.72, 0.05));
  for (int i = 0; i <= steps; ++i) {
    const double t = steps > 0 ? (double)i / (double)steps : 0.0;
    if (!controller_mapping_survey_runtime_point_safe(
        context, ax + (bx - ax) * t, ay + (by - ay) * t, room_zone_index, clearance)) return 0;
  }
  return 1;
}

int controller_mapping_survey_runtime_known_obstacle_near(
    const ControllerMappingSurveySafetyContext *context, double x, double y, double clearance) {
  if (!context) return 0;
  const ControllerMappingObstacles obstacles = obstacles_for(context);
  return controller_mapping_obstacles_map_near(&obstacles, x, y, clearance) ||
      controller_mapping_obstacles_recent_trace_near(&obstacles, x, y, clearance);
}

int controller_mapping_survey_runtime_map_obstacle_near(
    const ControllerMappingSurveySafetyContext *context, double x, double y, double clearance) {
  if (!context) return 0;
  const ControllerMappingObstacles obstacles = obstacles_for(context);
  return controller_mapping_obstacles_map_near(&obstacles, x, y, clearance);
}

int controller_mapping_survey_runtime_scan_point_allowed(
    const ControllerMappingSurveySafetyContext *context,
    double x, double y, int room_zone_index,
    double boundary_clearance, double obstacle_clearance) {
  if (!context || !context->zones) return 0;
  if (room_zone_index >= 0 && room_zone_index < context->zones->count) {
    const LimitZone *room = &context->zones->zones[room_zone_index];
    if (!controller_zone_geometry_point_in(x, y, room) ||
        controller_zone_geometry_point_near_boundary(
            x, y, room, boundary_clearance * 0.72)) return 0;
  } else if (x < -context->max_extent_x || x > context->max_extent_x ||
             y < -context->max_extent_y || y > context->max_extent_y) return 0;
  for (int index = 0; index < context->zones->count; ++index) {
    if (index != room_zone_index && controller_zone_geometry_point_near(
        x, y, &context->zones->zones[index], boundary_clearance)) return 0;
  }
  return !controller_mapping_survey_runtime_map_obstacle_near(
      context, x, y, obstacle_clearance);
}

int controller_mapping_survey_runtime_segment_clear(
    const ControllerMappingSurveySafetyContext *context,
    double ax, double ay, double bx, double by, double clearance, double ignore_radius) {
  if (!context) return 0;
  const ControllerMappingObstacles obstacles = obstacles_for(context);
  return controller_mapping_obstacles_segment_clear(
      &obstacles, ax, ay, bx, by, clearance, context->grid_cell, ignore_radius);
}
