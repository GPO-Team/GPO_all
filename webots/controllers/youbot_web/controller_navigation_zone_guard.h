#ifndef YOUBOT_WEB_CONTROLLER_NAVIGATION_ZONE_GUARD_H
#define YOUBOT_WEB_CONTROLLER_NAVIGATION_ZONE_GUARD_H

#include "controller_types.h"

typedef enum {
  CONTROLLER_NAVIGATION_ZONE_CLEAR = 0,
  CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_TARGET = 1,
  CONTROLLER_NAVIGATION_ZONE_BLOCKED_TARGET = 2,
  CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_SEGMENT = 3,
  CONTROLLER_NAVIGATION_ZONE_BLOCKED_SEGMENT = 4,
} ControllerNavigationZoneDecision;

ControllerNavigationZoneDecision controller_navigation_zone_guard_evaluate(
    const ZoneData *zones,
    double current_x,
    double current_z,
    const Waypoint *target,
    double clearance,
    int mapping_survey,
    int mapping_survey_room_zone_index,
    int has_next_waypoint);

#endif
