#ifndef YOUBOT_WEB_CONTROLLER_NAVIGATION_ROUTE_H
#define YOUBOT_WEB_CONTROLLER_NAVIGATION_ROUTE_H

#include "controller_types.h"

typedef enum {
  CONTROLLER_NAVIGATION_ROUTE_WAITING = 0,
  CONTROLLER_NAVIGATION_ROUTE_FINISHED = 1,
  CONTROLLER_NAVIGATION_ROUTE_ACTIVE = 2,
  CONTROLLER_NAVIGATION_ROUTE_ADVANCED = 3,
  CONTROLLER_NAVIGATION_ROUTE_COMPLETED = 4,
  CONTROLLER_NAVIGATION_ROUTE_UNREACHABLE = 5,
} ControllerNavigationRouteDecision;

typedef struct {
  Waypoint target;
  int is_final_waypoint;
} ControllerNavigationRouteOutput;

void controller_navigation_route_set_avoidance_context(
    int avoidance_active, int obstacle_near);
int controller_navigation_route_last_target_unreachable(void);
int controller_navigation_route_is_holding_center(void);

ControllerNavigationRouteDecision controller_navigation_route_evaluate(
    const RouteData *route,
    int *current_waypoint_index,
    int *route_finished,
    double x,
    double z,
    double heading,
    double position_tolerance,
    double heading_tolerance_rad,
    ControllerNavigationRouteOutput *output);

#endif