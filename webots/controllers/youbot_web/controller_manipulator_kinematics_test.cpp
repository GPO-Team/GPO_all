#include "controller_manipulator_kinematics.h"
#include <cassert>
#include <cmath>
#include <limits>
#include <initializer_list>

int main() {
  double q[5] = {};
  ControllerManipulatorTcp tcp;
  assert(controller_manipulator_forward(q, &tcp));
  assert(std::fabs(tcp.x - .189) < 1e-10);
  assert(std::fabs(tcp.y) < 1e-10);
  assert(std::fabs(tcp.z - .638) < 1e-10);
  q[0] = 1.5707963267948966;
  q[1] = -1.0;
  q[2] = -1.5;
  q[3] = -.641592653589793;
  assert(controller_manipulator_forward(q, &tcp));
  assert(std::fabs(tcp.x - .156) < 1e-10);
  assert(std::fabs(tcp.y - (.033 + .155 * std::sin(1.0) + .135 * std::sin(2.5))) < 1e-10);
  double solved[5];
  assert(controller_manipulator_inverse(&tcp, q, solved));
  for (int i = 0; i < 5; ++i) assert(std::fabs(solved[i] - q[i]) < 1e-8);
  // Handle above 15cm cube on floor, with root 12cm above the floor.
  tcp = {.40, .0, .072162, -3.141592653589793, 0.0};
  assert(controller_manipulator_inverse(&tcp, q, solved));
  ControllerManipulatorTcp actual;
  assert(controller_manipulator_forward(solved, &actual));
  assert(std::fabs(actual.x - tcp.x) < 1e-8);
  assert(std::fabs(actual.z - tcp.z) < 1e-8);
  for (double yaw : {-2.7, -.8, 0.0, 1.6, 2.7}) {
    for (double shoulder : {-1.0, -.3, .5, 1.4}) {
      for (double elbow : {-2.5, -1.0, .8, 2.4}) {
        double fixture[] = {yaw, shoulder, elbow, -.4, .25};
        assert(controller_manipulator_forward(fixture, &actual));
        assert(controller_manipulator_inverse(&actual, fixture, solved));
        // Nearest branch must retain the already valid exact seed.
        for (int i = 0; i < 5; ++i) assert(std::fabs(solved[i] - fixture[i]) < 1e-8);
      }
    }
  }
  tcp.x = 2;
  assert(!controller_manipulator_inverse(&tcp, q, solved));
  tcp.x = std::numeric_limits<double>::quiet_NaN();
  assert(!controller_manipulator_inverse(&tcp, q, solved));
  q[2] = std::numeric_limits<double>::quiet_NaN();
  assert(!controller_manipulator_forward(q, &actual));
  q[2] = 3.0;
  assert(!controller_manipulator_forward(q, &actual));
  return 0;
}
