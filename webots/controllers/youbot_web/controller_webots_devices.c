#include "controller_webots_devices.h"

#include <math.h>
#include <stdio.h>

#include <webots/motor.h>
#include <webots/position_sensor.h>

static void init_wheels(ControllerWebotsDevices *devices) {
  char name[16];
  for (int i = 0; i < 4; ++i) {
    snprintf(name, sizeof(name), "wheel%d", i + 1);
    devices->wheels[i] = wb_robot_get_device(name);
    if (devices->wheels[i]) {
      wb_motor_set_position(devices->wheels[i], INFINITY);
      wb_motor_set_velocity(devices->wheels[i], 0.0);
    }
    devices->applied_wheel_speeds[i] = 0.0;
  }
}

static void init_manipulator_pose(ControllerWebotsDevices *devices) {
  static const char *arm_names[5] = {
      "arm1",
      "arm2",
      "arm3",
      "arm4",
      "arm5",
  };
  static const double arm_positions[5] = {
      0.0,
      1.57,
      -2.635,
      1.78,
      0.0,
  };
  static const char *finger_names[2] = {
      "finger::left",
      "finger::right",
  };
  const double finger_opening = 0.011;

  for (int i = 0; i < 5; ++i) {
    devices->arm_joints[i] = wb_robot_get_device(arm_names[i]);
    char sensor_name[32];
    snprintf(sensor_name, sizeof(sensor_name), "%ssensor", arm_names[i]);
    devices->arm_sensors[i] = wb_robot_get_device(sensor_name);
    if (devices->arm_sensors[i]) wb_position_sensor_enable(devices->arm_sensors[i], 16);
    if (devices->arm_joints[i]) {
      wb_motor_set_velocity(devices->arm_joints[i], 1.0);
      wb_motor_set_position(devices->arm_joints[i], arm_positions[i]);
    }
  }

  for (int i = 0; i < 2; ++i) {
    devices->gripper_fingers[i] = wb_robot_get_device(finger_names[i]);
    char sensor_name[32];
    snprintf(sensor_name, sizeof(sensor_name), "%ssensor", finger_names[i]);
    devices->finger_sensors[i] = wb_robot_get_device(sensor_name);
    if (devices->finger_sensors[i]) wb_position_sensor_enable(devices->finger_sensors[i], 16);
    if (devices->gripper_fingers[i]) {
      wb_motor_set_velocity(devices->gripper_fingers[i], 0.03);
      wb_motor_set_position(devices->gripper_fingers[i], finger_opening);
    }
  }
}

void controller_webots_devices_init(ControllerWebotsDevices *devices) {
  if (!devices) return;
  *devices = (ControllerWebotsDevices){0};
  init_wheels(devices);
  init_manipulator_pose(devices);
}

void controller_webots_devices_drive(
    ControllerWebotsDevices *devices,
    const ControllerDriveConfig *config,
    double vx,
    double vy,
    double omega) {
  if (!devices || !config) return;

  int enabled[4];
  for (int i = 0; i < 4; ++i) {
    enabled[i] = devices->wheels[i] != 0;
  }
  controller_drive_step(config, vx, vy, omega, enabled, devices->applied_wheel_speeds);
  for (int i = 0; i < 4; ++i) {
    if (devices->wheels[i]) {
      wb_motor_set_velocity(devices->wheels[i], devices->applied_wheel_speeds[i]);
    }
  }
}

void controller_webots_devices_reset_wheels(ControllerWebotsDevices *devices) {
  if (!devices) return;
  for (int i = 0; i < 4; ++i) {
    devices->applied_wheel_speeds[i] = 0.0;
    if (devices->wheels[i]) wb_motor_set_velocity(devices->wheels[i], 0.0);
  }
}
