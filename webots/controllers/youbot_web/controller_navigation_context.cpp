#include "controller_navigation_context.h"

#include "controller_math.h"

#include <cmath>

int controller_navigation_context_update_pose(
    ControllerNavigationPoseHistory *history,
    double x,
    double z,
    double heading,
    double relocation_distance,
    double relocation_heading_rad) {
  if (!history) return 0;

  int relocated = 0;
  if (history->valid) {
    const double dx = x - history->last_x;
    const double dz = z - history->last_z;
    const double pose_jump = sqrt(dx * dx + dz * dz);
    const double heading_jump = fabs(wrap_angle(heading - history->last_heading));
    relocated = pose_jump > relocation_distance || heading_jump > relocation_heading_rad;
  }

  history->last_x = x;
  history->last_z = z;
  history->last_heading = heading;
  history->valid = 1;
  return relocated;
}

void controller_navigation_context_target(
    const Waypoint *target,
    int waypoint_index,
    int waypoint_count,
    double x,
    double z,
    double heading,
    ControllerNavigationTargetContext *context) {
  if (!target || !context) return;

  context->dx = target->x - x;
  context->dz = target->z - z;
  context->distance = sqrt(context->dx * context->dx + context->dz * context->dz);
  context->heading_to_target = atan2(context->dz, context->dx);
  context->heading_error = wrap_angle(context->heading_to_target - heading);
  context->is_final_waypoint = waypoint_index + 1 >= waypoint_count;
}
