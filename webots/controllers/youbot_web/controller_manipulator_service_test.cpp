#include "controller_manipulator_service.h"

#include <assert.h>
#include <math.h>
#include <limits>

int main() {
  ControllerManipulatorService service;
  controller_manipulator_service_init(&service);

  const ControllerManipulatorTarget pre_grasp =
      controller_manipulator_service_target(CONTROLLER_MANIPULATOR_PRE_GRASP);
  assert(pre_grasp.finger_opening > 0.01);
  assert(pre_grasp.joints[1] > 0.0);

  controller_manipulator_service_start(
      &service, CONTROLLER_MANIPULATOR_PRE_GRASP, 10.0);
  double joints[5] = {};
  double fingers[2] = {};
  ControllerManipulatorStep step =
      controller_manipulator_service_step(&service, joints, fingers, 10.5);
  assert(step == CONTROLLER_MANIPULATOR_MOVING);

  for (int i = 0; i < 5; ++i) joints[i] = pre_grasp.joints[i];
  fingers[0] = pre_grasp.finger_opening;
  fingers[1] = pre_grasp.finger_opening;
  step = controller_manipulator_service_step(&service, joints, fingers, 11.0);
  assert(step == CONTROLLER_MANIPULATOR_REACHED);

  controller_manipulator_service_start(
      &service, CONTROLLER_MANIPULATOR_GRASP, 20.0);
  step = controller_manipulator_service_step(&service, joints, fingers, 29.0);
  assert(step == CONTROLLER_MANIPULATOR_TIMED_OUT);

  const ControllerManipulatorTarget transport =
      controller_manipulator_service_target(CONTROLLER_MANIPULATOR_TRANSPORT);
  assert(fabs(transport.joints[2] - pre_grasp.joints[2]) > 0.1);
  controller_manipulator_service_start(&service, CONTROLLER_MANIPULATOR_PRE_GRASP, 30);
  joints[0] = std::numeric_limits<double>::quiet_NaN();
  step = controller_manipulator_service_step(&service, joints, fingers, 31);
  assert(step == CONTROLLER_MANIPULATOR_INVALID);
  for (int i = 0; i < 5; ++i) joints[i] = 0;
  fingers[0] = fingers[1] = .025;
  ControllerManipulatorTarget custom = {{.5, -.5, -1.2, -1.4, .2}, 0};
  assert(controller_manipulator_service_start_target(&service, &custom, joints, fingers, 40));
  auto command = controller_manipulator_service_sample(&service, 40);
  assert(command.joints[0] == 0 && command.finger_opening == .025);
  command = controller_manipulator_service_sample(&service, 40 + service.duration_seconds * .5);
  for (int i = 0; i < 5; ++i) assert(fabs(command.joints[i] - custom.joints[i] * .5) < 1e-10);
  assert(fabs(command.finger_opening - .0125) < 1e-10);
  command = controller_manipulator_service_sample(&service, 40 + service.duration_seconds * .25);
  assert(fabs(command.joints[0] - custom.joints[0] * .15625) < 1e-10);
  command = controller_manipulator_service_sample(&service, 40 + service.duration_seconds + 1);
  for (int i = 0; i < 5; ++i) assert(command.joints[i] == custom.joints[i]);
  for (int i = 0; i < 5; ++i) joints[i] = custom.joints[i];
  // A gripped handle prevents fingers reaching zero. Arm completion remains
  // observable separately, and does not claim finger/contact completion.
  fingers[0] = fingers[1] = .008;
  step = controller_manipulator_service_step(&service, joints, fingers, 40 + service.duration_seconds);
  assert(step == CONTROLLER_MANIPULATOR_REACHED);
  assert(service.joints_reached && !service.fingers_reached && service.trajectory_complete);
  assert(controller_manipulator_service_start_target(&service, &custom, joints, fingers, 50));
  service.require_fingers = 1;
  step = controller_manipulator_service_step(&service, joints, fingers, 50 + service.duration_seconds);
  assert(step == CONTROLLER_MANIPULATOR_MOVING);
  fingers[0] = fingers[1] = 0;
  step = controller_manipulator_service_step(&service, joints, fingers, 50 + service.duration_seconds);
  assert(step == CONTROLLER_MANIPULATOR_REACHED);
  custom.joints[1] = 5;
  assert(!controller_manipulator_service_start_target(&service, &custom, joints, fingers, 50));
  custom.joints[1] = -.5;
  fingers[0] = -.0004; fingers[1] = .0254;
  joints[1] = -1.1348;
  assert(controller_manipulator_service_start_target(&service, &custom, joints, fingers, 60));
  assert(service.origin.joints[1] == -1.13446);
  fingers[0] = -.002;
  assert(!controller_manipulator_service_start_target(&service, &custom, joints, fingers, 61));
  return 0;
}
