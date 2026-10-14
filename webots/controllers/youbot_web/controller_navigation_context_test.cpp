#include "controller_navigation_context.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

int main(void) {
  ControllerNavigationPoseHistory history = {0};
  if (controller_navigation_context_update_pose(&history, 1.0, 2.0, 0.2, 0.45, 1.2)) return 1;
  if (!history.valid || !nearly_equal(history.last_x, 1.0)) return 2;

  if (controller_navigation_context_update_pose(&history, 1.1, 2.1, 0.3, 0.45, 1.2)) return 3;
  if (!controller_navigation_context_update_pose(&history, 2.0, 2.1, 0.3, 0.45, 1.2)) return 4;

  history = ControllerNavigationPoseHistory{0.0, 0.0, 3.0, 1};
  if (controller_navigation_context_update_pose(&history, 0.0, 0.0, -3.0, 0.45, 1.2)) return 5;

  const Waypoint target = {3.0, 4.0, 1.25, 1};
  ControllerNavigationTargetContext context;
  controller_navigation_context_target(&target, 2, 3, 0.0, 0.0, 0.5, &context);
  if (!nearly_equal(context.dx, 3.0) || !nearly_equal(context.dz, 4.0)) return 6;
  if (!nearly_equal(context.distance, 5.0)) return 7;
  if (!nearly_equal(context.heading_to_target, atan2(4.0, 3.0))) return 8;
  if (!nearly_equal(context.heading_error, atan2(4.0, 3.0) - 0.5)) return 9;
  if (!context.is_final_waypoint) return 10;

  return 0;
}
