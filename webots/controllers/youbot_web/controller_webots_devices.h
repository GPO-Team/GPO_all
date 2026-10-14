#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_DEVICES_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_DEVICES_H

#include <webots/robot.h>

#include "controller_drive.h"

typedef struct {
  WbDeviceTag wheels[4];
  WbDeviceTag arm_joints[5];
  WbDeviceTag gripper_fingers[2];
  WbDeviceTag arm_sensors[5];
  WbDeviceTag finger_sensors[2];
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

#endif
