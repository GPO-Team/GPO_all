#ifndef CONTROLLER_MANIPULATOR_SERVICE_H
#define CONTROLLER_MANIPULATOR_SERVICE_H

typedef enum {
  CONTROLLER_MANIPULATOR_TRANSPORT = 0,
  CONTROLLER_MANIPULATOR_PRE_GRASP,
  CONTROLLER_MANIPULATOR_GRASP,
  CONTROLLER_MANIPULATOR_LIFT,
  CONTROLLER_MANIPULATOR_PLACE,
} ControllerManipulatorPose;

typedef enum {
  CONTROLLER_MANIPULATOR_IDLE = 0,
  CONTROLLER_MANIPULATOR_MOVING,
  CONTROLLER_MANIPULATOR_REACHED,
  CONTROLLER_MANIPULATOR_TIMED_OUT,
  CONTROLLER_MANIPULATOR_INVALID,
} ControllerManipulatorStep;

typedef struct {
  double joints[5];
  double finger_opening;
} ControllerManipulatorTarget;

typedef struct {
  ControllerManipulatorPose pose;
  ControllerManipulatorTarget target;
  ControllerManipulatorStep state;
  double started_at;
  double timeout_seconds;
  double joint_tolerance;
  double finger_tolerance;
  ControllerManipulatorTarget origin;
  double duration_seconds;
  int trajectory_complete;
  int joints_reached;
  int fingers_reached;
  int require_fingers;
} ControllerManipulatorService;

void controller_manipulator_service_init(ControllerManipulatorService *service);
ControllerManipulatorTarget controller_manipulator_service_target(
    ControllerManipulatorPose pose);
void controller_manipulator_service_start(
    ControllerManipulatorService *service,
    ControllerManipulatorPose pose,
    double now);
int controller_manipulator_service_start_target(
    ControllerManipulatorService *service,
    const ControllerManipulatorTarget *target,
    const double joints[5], const double fingers[2], double now);
// Simulation-time cubic interpolation. target remains the final goal.
// Custom motion completion concerns the arm; set require_fingers=1 when
// opening must finish. Contact/holding confirmation belongs to the mission.
ControllerManipulatorTarget controller_manipulator_service_sample(
    const ControllerManipulatorService *service, double now);
ControllerManipulatorStep controller_manipulator_service_step(
    ControllerManipulatorService *service,
    const double joints[5],
    const double fingers[2],
    double now);

#endif
