#include "controller_webots_devices.h"

#include <cmath>
#include <stdio.h>

#include <webots/motor.h>
#include <webots/position_sensor.h>
#include <webots/robot.h>
#include <webots/touch_sensor.h>

namespace {
double clamp_position(double value, double minimum, double maximum) {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

const double kJointMinimum[5] = {-2.9496, -1.5708, -2.6354, -1.7802, -2.9234};
const double kJointMaximum[5] = {2.9496, 1.5708, 2.5482, 1.7802, 2.9234};
}

static void init_wheels(ControllerWebotsDevices *devices) {
  char name[16];
  for (int i = 0; i < 4; ++i) {
    snprintf(name, sizeof(name), "wheel%d", i + 1);
    devices->wheels[i] = wb_robot_get_device(name);
    wb_motor_set_position(devices->wheels[i], INFINITY);
    wb_motor_set_velocity(devices->wheels[i], 0.0);
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
    if (devices->arm_joints[i]) {
      wb_motor_set_velocity(devices->arm_joints[i], 1.0);
      wb_motor_enable_torque_feedback(devices->arm_joints[i], (int)wb_robot_get_basic_time_step());
      wb_motor_set_position(devices->arm_joints[i], arm_positions[i]);
      devices->arm_sensors[i] = wb_motor_get_position_sensor(devices->arm_joints[i]);
      if (devices->arm_sensors[i])
        wb_position_sensor_enable(devices->arm_sensors[i], (int)wb_robot_get_basic_time_step());
    }
  }

  for (int i = 0; i < 2; ++i) {
    devices->gripper_fingers[i] = wb_robot_get_device(finger_names[i]);
    if (devices->gripper_fingers[i]) {
      wb_motor_set_velocity(devices->gripper_fingers[i], 0.03);
      wb_motor_set_available_force(devices->gripper_fingers[i], 12.0);
      wb_motor_enable_force_feedback(devices->gripper_fingers[i], (int)wb_robot_get_basic_time_step());
      wb_motor_set_position(devices->gripper_fingers[i], finger_opening);
      devices->finger_sensors[i] = wb_motor_get_position_sensor(devices->gripper_fingers[i]);
      if (devices->finger_sensors[i])
        wb_position_sensor_enable(devices->finger_sensors[i], (int)wb_robot_get_basic_time_step());
    }
  }
  devices->finger_contacts[0] = wb_robot_get_device("gripper_contact_left");
  devices->finger_contacts[1] = wb_robot_get_device("gripper_contact_right");
  for (int i=0;i<2;++i) if(devices->finger_contacts[i])
    wb_touch_sensor_enable(devices->finger_contacts[i], (int)wb_robot_get_basic_time_step());
}

void controller_webots_devices_set_manipulator(
    ControllerWebotsDevices *devices,
    const double joints[5],
    double finger_opening) {
  if (!devices || !joints) return;
  for (int i = 0; i < 5; ++i) {
    if (devices->arm_joints[i])
      wb_motor_set_position(devices->arm_joints[i],
                            clamp_position(joints[i], kJointMinimum[i], kJointMaximum[i]));
  }
  finger_opening = clamp_position(finger_opening, 0.0, 0.0115);
  for (int i = 0; i < 2; ++i) {
    if (devices->gripper_fingers[i])
      wb_motor_set_position(devices->gripper_fingers[i], finger_opening);
  }
}

int controller_webots_devices_read_manipulator(
    const ControllerWebotsDevices *devices,
    double joints[5],
    double fingers[2]) {
  if (!devices || !joints || !fingers) return 0;
  for (int i = 0; i < 5; ++i) {
    if (!devices->arm_sensors[i]) return 0;
    joints[i] = wb_position_sensor_get_value(devices->arm_sensors[i]);
    if (!std::isfinite(joints[i])) return 0;
  }
  for (int i = 0; i < 2; ++i) {
    if (!devices->finger_sensors[i]) return 0;
    fingers[i] = wb_position_sensor_get_value(devices->finger_sensors[i]);
    if (!std::isfinite(fingers[i])) return 0;
  }
  return 1;
}

int controller_webots_devices_read_grip(const ControllerWebotsDevices *devices,
    double contacts[2], double efforts[7]) {
  if(!devices || !contacts || !efforts) return 0;
  for(int i=0;i<5;++i) {
    if(!devices->arm_joints[i]) return 0;
    efforts[i]=wb_motor_get_torque_feedback(devices->arm_joints[i]);
    if(!std::isfinite(efforts[i])) return 0;
  }
  for(int i=0;i<2;++i) {
    if(!devices->finger_contacts[i] || !devices->gripper_fingers[i]) return 0;
    contacts[i]=wb_touch_sensor_get_value(devices->finger_contacts[i]);
    efforts[5+i]=wb_motor_get_force_feedback(devices->gripper_fingers[i]);
    if(!std::isfinite(contacts[i]) || !std::isfinite(efforts[5+i])) return 0;
  }
  return 1;
}

void controller_webots_devices_init(ControllerWebotsDevices *devices) {
  if (!devices) return;
  *devices = ControllerWebotsDevices{0};
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
