#include "controller_navigation_route.h"

#include <cmath>

static double wrap_angle(double angle) {
  return atan2(sin(angle), cos(angle));
}

static int waypoint_reached(
    double x,
    double z,
    double heading,
    const Waypoint *waypoint,
    int is_final_waypoint,
    double position_tolerance,
    double heading_tolerance_rad) {
  if (hypot(waypoint->x - x, waypoint->z - z) > position_tolerance) return 0;
  if (!is_final_waypoint || !waypoint->has_heading) return 1;
  return fabs(wrap_angle(waypoint->heading_rad - heading)) <=
         heading_tolerance_rad;
}

ControllerNavigationRouteDecision controller_navigation_route_evaluate(
    const RouteData *route,
    int *current_waypoint_index,
    int *route_finished,
    double x,
    double z,
    double heading,
    double position_tolerance,
    double heading_tolerance_rad,
    ControllerNavigationRouteOutput *output) {
  if (!route || !current_waypoint_index || !route_finished || !output ||
      route->count <= 0) {
    if (route_finished) *route_finished = 0;
    return CONTROLLER_NAVIGATION_ROUTE_WAITING;
  }
  if (*route_finished) return CONTROLLER_NAVIGATION_ROUTE_FINISHED;

  output->target = route->waypoints[*current_waypoint_index];
  output->is_final_waypoint = *current_waypoint_index + 1 >= route->count;
  if (!waypoint_reached(
          x, z, heading, &output->target, output->is_final_waypoint,
          position_tolerance, heading_tolerance_rad)) {
    return CONTROLLER_NAVIGATION_ROUTE_ACTIVE;
  }
  if (output->is_final_waypoint) {
    *route_finished = 1;
    return CONTROLLER_NAVIGATION_ROUTE_COMPLETED;
  }

  ++*current_waypoint_index;
  output->target = route->waypoints[*current_waypoint_index];
  output->is_final_waypoint = *current_waypoint_index + 1 >= route->count;
  return CONTROLLER_NAVIGATION_ROUTE_ADVANCED;
}
