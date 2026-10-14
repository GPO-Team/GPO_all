#ifndef CONTROLLER_MANIPULATOR_H
#define CONTROLLER_MANIPULATOR_H

typedef enum {
  MANIPULATOR_IDLE, MANIPULATOR_OPEN, MANIPULATOR_APPROACH, MANIPULATOR_DESCEND,
  MANIPULATOR_CLOSE, MANIPULATOR_LIFT, MANIPULATOR_TRANSFER, MANIPULATOR_LOWER,
  MANIPULATOR_RELEASE, MANIPULATOR_RETRACT, MANIPULATOR_STOW, MANIPULATOR_COMPLETED,
  MANIPULATOR_FAILED, MANIPULATOR_CANCELLED
} ControllerManipulatorStage;

typedef struct {
  double joints[5];
  double fingers[2];
  double object[3];
  int object_valid;
  int contacts_required;
  double contacts[2];
} ControllerManipulatorSample;

typedef struct {
  ControllerManipulatorStage stage;
  double poses[4][5];
  double targets[5];
  double source[3], destination[3];
  double finger_target;
  double elapsed, settled;
  double previous_fingers[2];
  int halt_motion;
  int hold_fingers;
  double held_fingers[2];
  const char *error;
} ControllerManipulator;

// Positions are relative to the robot origin (ENU). Dimensions: Webots R2025a Youbot.proto.
int controller_manipulator_inverse(const double position[3], double joints[5]);
void controller_manipulator_forward(const double joints[5], double position[3]);
int controller_manipulator_start(ControllerManipulator *arm, const double source[3], const double destination[3]);
int controller_manipulator_active(const ControllerManipulator *arm);
double controller_manipulator_finger_target(const ControllerManipulator *arm, int finger);
void controller_manipulator_step(ControllerManipulator *arm, const ControllerManipulatorSample *sample, double dt);
void controller_manipulator_cancel(ControllerManipulator *arm, const ControllerManipulatorSample *sample);
const char *controller_manipulator_stage_name(ControllerManipulatorStage stage);

#endif
