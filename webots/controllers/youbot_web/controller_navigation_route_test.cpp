#include "controller_navigation_route.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

int main(void) {
  RouteData route = {0};
  int waypoint_index = 0;
  int route_finished = 1;
  ControllerNavigationRouteOutput output = {0};

  if (controller_navigation_route_evaluate(
          &route, &waypoint_index, &route_finished,
          0.0, 0.0, 0.0, 0.12, 0.08, &output) !=
      CONTROLLER_NAVIGATION_ROUTE_WAITING) return 1;
  if (route_finished) return 2;

  route.count = 2;
  route.waypoints[0] = Waypoint{1.0, 0.0, 0.0, 0};
  route.waypoints[1] = Waypoint{2.0, 0.0, 1.0, 1};
  if (controller_navigation_route_evaluate(
          &route, &waypoint_index, &route_finished,
          0.0, 0.0, 0.0, 0.12, 0.08, &output) !=
      CONTROLLER_NAVIGATION_ROUTE_ACTIVE) return 3;
  if (!nearly_equal(output.target.x, 1.0) || output.is_final_waypoint) return 4;

  if (controller_navigation_route_evaluate(
          &route, &waypoint_index, &route_finished,
          1.0, 0.0, 0.0, 0.12, 0.08, &output) !=
      CONTROLLER_NAVIGATION_ROUTE_ADVANCED) return 5;
  if (waypoint_index != 1 || !output.is_final_waypoint ||
      !nearly_equal(output.target.x, 2.0)) return 6;

  if (controller_navigation_route_evaluate(
          &route, &waypoint_index, &route_finished,
          2.0, 0.0, 0.5, 0.12, 0.08, &output) !=
      CONTROLLER_NAVIGATION_ROUTE_ACTIVE) return 7;
  if (controller_navigation_route_evaluate(
          &route, &waypoint_index, &route_finished,
          2.0, 0.0, 1.0, 0.12, 0.08, &output) !=
      CONTROLLER_NAVIGATION_ROUTE_COMPLETED) return 8;
  if (!route_finished) return 9;

  if (controller_navigation_route_evaluate(
          &route, &waypoint_index, &route_finished,
          2.0, 0.0, 1.0, 0.12, 0.08, &output) !=
      CONTROLLER_NAVIGATION_ROUTE_FINISHED) return 10;

  return 0;
}
