#ifndef CONTROLLER_MANIPULATOR_KINEMATICS_H
#define CONTROLLER_MANIPULATOR_KINEMATICS_H

// Robot-root coordinates in metres. Pitch is q2+q3+q4: zero points up,
// -pi points down. Roll is q5 about the tool axis. TCP is at arm5 z=0.120.
typedef struct {
  double x, y, z, pitch, roll;
} ControllerManipulatorTcp;

int controller_manipulator_joints_valid(const double joints[5]);
// Clamp at most .001 rad of measured endpoint overshoot; never clamp targets.
int controller_manipulator_normalize_measurement(const double joints[5], double normalized[5]);
int controller_manipulator_forward(const double joints[5], ControllerManipulatorTcp *tcp);
int controller_manipulator_inverse(const ControllerManipulatorTcp *tcp,
    const double seed[5], double solution[5]);

#endif
