#ifndef YOUBOT_WEB_CONTROLLER_MAPPING_SURVEY_RUNTIME_SAFETY_H
#define YOUBOT_WEB_CONTROLLER_MAPPING_SURVEY_RUNTIME_SAFETY_H

#include "controller_types.h"

typedef struct {
  const ZoneData *zones;
  const MapCell *persistent_map;
  int persistent_map_count;
  const ObstacleTracePoint *obstacle_trace;
  int obstacle_trace_count;
  double now;
  double trace_ttl_seconds;
  double trace_clearance;
  double max_extent_x;
  double max_extent_y;
  double obstacle_clearance;
  double grid_cell;
} ControllerMappingSurveySafetyContext;

int controller_mapping_survey_runtime_point_safe(
    const ControllerMappingSurveySafetyContext *context,
    double x, double y, int room_zone_index, double clearance);
int controller_mapping_survey_runtime_segment_safe(
    const ControllerMappingSurveySafetyContext *context,
    double ax, double ay, double bx, double by, int room_zone_index, double clearance);
int controller_mapping_survey_runtime_known_obstacle_near(
    const ControllerMappingSurveySafetyContext *context, double x, double y, double clearance);
int controller_mapping_survey_runtime_map_obstacle_near(
    const ControllerMappingSurveySafetyContext *context, double x, double y, double clearance);
int controller_mapping_survey_runtime_scan_point_allowed(
    const ControllerMappingSurveySafetyContext *context,
    double x, double y, int room_zone_index,
    double boundary_clearance, double obstacle_clearance);
int controller_mapping_survey_runtime_segment_clear(
    const ControllerMappingSurveySafetyContext *context,
    double ax, double ay, double bx, double by, double clearance, double ignore_radius);

#endif
