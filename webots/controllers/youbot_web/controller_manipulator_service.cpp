#include "controller_manipulator_service.h"
#include "controller_manipulator_kinematics.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace {
const ControllerManipulatorTarget kTargets[] = {
    {{0.0, 1.57, -2.635, 1.78, 0.0}, 0.011},
    {{0.0, 0.95, -1.85, 1.65, 0.0}, 0.011},
    {{0.0, 0.65, -1.25, 1.45, 0.0}, 0.001},
    {{0.0, 1.15, -1.95, 1.65, 0.0}, 0.001},
    {{0.0, 0.72, -1.35, 1.48, 0.0}, 0.001},
};
bool fingers_valid(const double fingers[2]) {
  return fingers && std::isfinite(fingers[0]) && std::isfinite(fingers[1])
      && fingers[0] >= -.001 && fingers[0] <= .026
      && fingers[1] >= -.001 && fingers[1] <= .026;
}
}

int controller_manipulator_service_start_target(ControllerManipulatorService *service,
    const ControllerManipulatorTarget *target, const double joints[5],
    const double fingers[2], double now) {
  if (!service) return 0;
  double normalized[5];
  if (!target || !std::isfinite(now) || !controller_manipulator_normalize_measurement(joints, normalized)
      || !controller_manipulator_joints_valid(target->joints) || !fingers_valid(fingers)
      || !std::isfinite(target->finger_opening) || target->finger_opening < 0
      || target->finger_opening > .025) {
    service->state = CONTROLLER_MANIPULATOR_INVALID;
    return 0;
  }
  service->origin = {{normalized[0], normalized[1], normalized[2], normalized[3], normalized[4]},
      (std::clamp(fingers[0], 0.0, .025) + std::clamp(fingers[1], 0.0, .025)) * .5};
  service->target = *target;
  service->duration_seconds = .25;
  for (int i = 0; i < 5; ++i)
    service->duration_seconds = std::max(service->duration_seconds,
        1.5 * std::fabs(target->joints[i] - joints[i]) / .8);
  service->duration_seconds = std::max(service->duration_seconds,
      1.5 * std::fabs(target->finger_opening - service->origin.finger_opening) / .025);
  service->timeout_seconds = std::max(service->timeout_seconds, service->duration_seconds + 3.0);
  service->started_at = now;
  service->trajectory_complete = service->joints_reached = service->fingers_reached = 0;
  service->require_fingers = 0;
  service->state = CONTROLLER_MANIPULATOR_MOVING;
  return 1;
}

ControllerManipulatorTarget controller_manipulator_service_sample(
    const ControllerManipulatorService *service, double now) {
  if (!service) return {};
  if (!std::isfinite(now)) return service->origin;
  const double t = service->duration_seconds > 0
      ? std::clamp((now - service->started_at) / service->duration_seconds, 0.0, 1.0) : 1.0;
  const double blend = t * t * (3.0 - 2.0 * t);
  ControllerManipulatorTarget sample;
  for (int i = 0; i < 5; ++i)
    sample.joints[i] = service->origin.joints[i]
        + blend * (service->target.joints[i] - service->origin.joints[i]);
  sample.finger_opening = service->origin.finger_opening
      + blend * (service->target.finger_opening - service->origin.finger_opening);
  return sample;
}

void controller_manipulator_service_init(ControllerManipulatorService *service) {
  if (!service) return;
  std::memset(service, 0, sizeof(*service));
  service->timeout_seconds = 8.0;
  service->joint_tolerance = 0.035;
  service->finger_tolerance = 0.0025;
  service->target = kTargets[CONTROLLER_MANIPULATOR_TRANSPORT];
  service->origin = service->target;
}

ControllerManipulatorTarget controller_manipulator_service_target(
    ControllerManipulatorPose pose) {
  if (pose < CONTROLLER_MANIPULATOR_TRANSPORT || pose > CONTROLLER_MANIPULATOR_PLACE)
    pose = CONTROLLER_MANIPULATOR_TRANSPORT;
  return kTargets[pose];
}

void controller_manipulator_service_start(
    ControllerManipulatorService *service,
    ControllerManipulatorPose pose,
    double now) {
  if (!service) return;
  if (!std::isfinite(now)) {
    service->state = CONTROLLER_MANIPULATOR_INVALID;
    return;
  }
  service->pose = pose;
  service->target = controller_manipulator_service_target(pose);
  service->started_at = now;
  service->origin = service->target;
  service->duration_seconds = 0;
  service->trajectory_complete = service->joints_reached = service->fingers_reached = 0;
  service->require_fingers = 1;
  service->state = CONTROLLER_MANIPULATOR_MOVING;
}

ControllerManipulatorStep controller_manipulator_service_step(
    ControllerManipulatorService *service,
    const double joints[5],
    const double fingers[2],
    double now) {
  if (!service) return CONTROLLER_MANIPULATOR_IDLE;
  if (!joints || !fingers || !std::isfinite(now) || now < service->started_at
      || !std::isfinite(service->joint_tolerance) || service->joint_tolerance < 0
      || !std::isfinite(service->finger_tolerance) || service->finger_tolerance < 0
      || !std::isfinite(service->timeout_seconds) || service->timeout_seconds <= 0) {
    service->state = CONTROLLER_MANIPULATOR_INVALID;
    return service->state;
  }
  for (int i = 0; i < 5; ++i) {
    if (!std::isfinite(joints[i])) {
      service->state = CONTROLLER_MANIPULATOR_INVALID;
      return service->state;
    }
  }
  if (!std::isfinite(fingers[0]) || !std::isfinite(fingers[1])) {
    service->state = CONTROLLER_MANIPULATOR_INVALID;
    return service->state;
  }
  if (service->state != CONTROLLER_MANIPULATOR_MOVING) return service->state;
  if (now - service->started_at > service->timeout_seconds) {
    service->state = CONTROLLER_MANIPULATOR_TIMED_OUT;
    return service->state;
  }
  service->trajectory_complete = now - service->started_at + 1e-9 >= service->duration_seconds;
  service->joints_reached = service->fingers_reached = 1;
  for (int i = 0; i < 5; ++i) {
    if (std::fabs(joints[i] - service->target.joints[i]) > service->joint_tolerance)
      service->joints_reached = 0;
  }
  for (int i = 0; i < 2; ++i) {
    if (std::fabs(fingers[i] - service->target.finger_opening) > service->finger_tolerance)
      service->fingers_reached = 0;
  }
  if (!service->trajectory_complete || !service->joints_reached
      || (service->require_fingers && !service->fingers_reached)) return service->state;
  service->state = CONTROLLER_MANIPULATOR_REACHED;
  return service->state;
}
