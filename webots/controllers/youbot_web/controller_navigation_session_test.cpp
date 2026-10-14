#include "controller_navigation_session.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

int main(void) {
  RouteData route = {0};
  ControllerNavigationSessionOutput output = {0};

  if (controller_navigation_session_evaluate(
          &route, 0, 0, 0, 1.0, 2.0, &output) !=
      CONTROLLER_NAVIGATION_SESSION_WAIT_FOR_ROUTE) return 1;

  route.count = 1;
  route.waypoints[0] = Waypoint{4.0, 6.0, 0.0, 0};
  if (controller_navigation_session_evaluate(
          &route, 1, 0, 0, 1.0, 2.0, &output) !=
      CONTROLLER_NAVIGATION_SESSION_STOP_FINISHED) return 2;

  if (controller_navigation_session_evaluate(
          &route, 0, 1, 0, 1.0, 2.0, &output) !=
      CONTROLLER_NAVIGATION_SESSION_RELOCALIZE) return 3;
  if (!nearly_equal(output.distance_to_target, 5.0)) return 4;
  if (!nearly_equal(output.segment_start_x, 1.0) ||
      !nearly_equal(output.segment_start_z, 2.0)) return 5;

  if (controller_navigation_session_evaluate(
          &route, 0, 0, 0, 1.0, 2.0, &output) !=
      CONTROLLER_NAVIGATION_SESSION_CONTINUE) return 6;

  return 0;
}
