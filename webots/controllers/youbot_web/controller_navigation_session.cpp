#include "controller_navigation_session.h"

#include <cmath>

ControllerNavigationSessionDecision controller_navigation_session_evaluate(
    const RouteData *route,
    int route_finished,
    int manual_relocation_detected,
    int current_waypoint_index,
    double x,
    double z,
    ControllerNavigationSessionOutput *output) {
  if (!route || route->count <= 0)
    return CONTROLLER_NAVIGATION_SESSION_WAIT_FOR_ROUTE;
  if (route_finished)
    return CONTROLLER_NAVIGATION_SESSION_STOP_FINISHED;
  if (!manual_relocation_detected)
    return CONTROLLER_NAVIGATION_SESSION_CONTINUE;
  if (!output || current_waypoint_index < 0 ||
      current_waypoint_index >= route->count)
    return CONTROLLER_NAVIGATION_SESSION_CONTINUE;

  const Waypoint *target = &route->waypoints[current_waypoint_index];
  output->distance_to_target = hypot(target->x - x, target->z - z);
  output->segment_start_x = x;
  output->segment_start_z = z;
  return CONTROLLER_NAVIGATION_SESSION_RELOCALIZE;
}
