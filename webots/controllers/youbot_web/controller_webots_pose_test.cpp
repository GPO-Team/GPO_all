#include "controller_webots_pose.h"
#include <cassert>
#include <cmath>

namespace {
double position[] = {1.0, 2.0, 0.102};
double rotation[] = {0.0, 1.0, 0.0, 0.3};
double orientation[9];
void set_orientation(double yaw, double pitch) {
  const double c = std::cos(yaw), s = std::sin(yaw);
  const double cp = std::cos(pitch), sp = std::sin(pitch);
  const double matrix[] = {c*cp, -s, c*sp, s*cp, c, s*sp, -sp, 0, cp};
  for (int i = 0; i < 9; ++i) orientation[i] = matrix[i];
}
}
// Sensor fixtures exercise the production pose reader without a simulator.
extern "C" const double *wb_supervisor_field_get_sf_vec3f(WbFieldRef) { return position; }
extern "C" const double *wb_supervisor_field_get_sf_rotation(WbFieldRef) { return rotation; }
extern "C" const double *wb_supervisor_node_get_orientation(WbNodeRef) { return orientation; }

int main() {
  ControllerWebotsPose pose = {};
  pose.self_node = reinterpret_cast<WbNodeRef>(1);
  pose.translation_field = reinterpret_cast<WbFieldRef>(2);
  pose.rotation_field = reinterpret_cast<WbFieldRef>(3);
  double x, y, heading;
  set_orientation(0.0, 0.3);
  assert(controller_webots_pose_read(&pose, &x, &y, &heading));
  assert(x == 1.0 && y == 2.0);
  assert(std::fabs(heading) < 1e-9); // Pitch under cargo is not a yaw command.
  set_orientation(-2.5, 0.15);
  assert(controller_webots_pose_read(&pose, &x, &y, &heading));
  assert(std::fabs(heading + 2.5) < 1e-9);
  return 0;
}
