#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_DEVICES_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_DEVICES_H

#include <webots/robot.h>

#include "controller_drive.h"

typedef struct {
  WbDeviceTag wheels[4];
  WbDeviceTag arm_joints[5];
  WbDeviceTag arm_sensors[5];
  WbDeviceTag gripper_fingers[2];
  WbDeviceTag finger_sensors[2];
  WbDeviceTag finger_contacts[2];
  double applied_wheel_speeds[4];
} ControllerWebotsDevices;

void controller_webots_devices_init(ControllerWebotsDevices *devices);
void controller_webots_devices_drive(
    ControllerWebotsDevices *devices,
    const ControllerDriveConfig *config,
    double vx,
    double vy,
    double omega);
void controller_webots_devices_reset_wheels(ControllerWebotsDevices *devices);
void controller_webots_devices_set_manipulator(
    ControllerWebotsDevices *devices,
    const double joints[5],
    double finger_opening);
int controller_webots_devices_read_manipulator(
    const ControllerWebotsDevices *devices,
    double joints[5],
    double fingers[2]);
int controller_webots_devices_read_grip(const ControllerWebotsDevices *devices,
    double contacts[2], double efforts[7]);

#endif
