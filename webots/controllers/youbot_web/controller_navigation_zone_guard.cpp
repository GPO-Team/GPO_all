#include "controller_navigation_zone_guard.h"

#include "controller_zone_geometry.h"

ControllerNavigationZoneDecision controller_navigation_zone_guard_evaluate(
    const ZoneData *zones,
    double current_x,
    double current_z,
    const Waypoint *target,
    double clearance,
    int mapping_survey,
    int mapping_survey_room_zone_index,
    int has_next_waypoint) {
  if (!zones || !target) return CONTROLLER_NAVIGATION_ZONE_CLEAR;

  const int skip_zone_index =
      mapping_survey ? mapping_survey_room_zone_index : -1;
  for (int zone_index = 0; zone_index < zones->count; ++zone_index) {
    if (zone_index == skip_zone_index) continue;
    if (!controller_zone_geometry_point_near(
            target->x, target->z, &zones->zones[zone_index], clearance)) {
      continue;
    }
    return mapping_survey && has_next_waypoint
               ? CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_TARGET
               : CONTROLLER_NAVIGATION_ZONE_BLOCKED_TARGET;
  }

  if (!controller_zone_geometry_segment_blocked(
          zones, current_x, current_z, target->x, target->z,
          clearance, skip_zone_index)) {
    return CONTROLLER_NAVIGATION_ZONE_CLEAR;
  }
  return mapping_survey && has_next_waypoint
             ? CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_SEGMENT
             : CONTROLLER_NAVIGATION_ZONE_BLOCKED_SEGMENT;
}
