#include "controller_webots_adapter.h"

#include <cmath>

ControllerDriveConfig controller_webots_adapter_drive_config(
    double wheel_radius,
    double wheel_base_longitudinal,
    double wheel_base_lateral,
    double max_wheel_speed_rad_s,
    double acceleration_limit_rad_s2,
    double deceleration_limit_rad_s2,
    double time_step_seconds) {
  return ControllerDriveConfig{
      wheel_radius,
      wheel_base_longitudinal + wheel_base_lateral,
      max_wheel_speed_rad_s,
      acceleration_limit_rad_s2,
      deceleration_limit_rad_s2,
      time_step_seconds,
  };
}

void controller_webots_adapter_init(
    ControllerWebotsAdapter *adapter,
    const ControllerDriveConfig *config,
    ControllerWebotsAdapterDriveFn drive,
    void *context) {
  if (!adapter) return;
  *adapter = ControllerWebotsAdapter{0};
  if (config) adapter->drive_config = *config;
  adapter->drive = drive;
  adapter->context = context;
}

void controller_webots_adapter_apply_velocity(
    ControllerWebotsAdapter *adapter, double vx, double vy, double omega) {
  if (!adapter || !adapter->drive) return;
  adapter->drive(adapter->context, &adapter->drive_config, vx, vy, omega);
}

void controller_webots_adapter_stop(ControllerWebotsAdapter *adapter) {
  controller_webots_adapter_apply_velocity(adapter, 0.0, 0.0, 0.0);
}

ControllerWebotsAdapterSensorState controller_webots_adapter_init_sensors(
    ControllerWebotsSensors *sensors,
    int time_step,
    int camera_capture_interval,
    int virtual_camera_width,
    int virtual_camera_height,
    double fallback_camera_fov) {
  ControllerWebotsAdapterSensorState state = {0};
  state.lidar_available = controller_webots_sensors_init_lidar(
      sensors, time_step, &state.lidar_resolution, &state.lidar_fov, &state.lidar_max_range);
  state.camera_available = 1;
  if (!controller_webots_sensors_init_camera(
          sensors,
          time_step * camera_capture_interval,
          &state.camera_width,
          &state.camera_height,
          &state.camera_fov)) {
    state.camera_virtual_mode = 1;
    state.camera_width = virtual_camera_width;
    state.camera_height = virtual_camera_height;
    state.camera_fov = state.lidar_fov > 0.0 ? fmin(state.lidar_fov, 1.20) : fallback_camera_fov;
  }
  return state;
}

void controller_webots_adapter_init_pose(ControllerWebotsPose *pose) {
  controller_webots_pose_init(pose);
}

int controller_webots_adapter_reset_pose(
    ControllerWebotsPose *pose, double x, double y, double height, double heading) {
  return controller_webots_pose_reset(pose, x, y, height, heading);
}

int controller_webots_adapter_read_pose(
    const ControllerWebotsPose *pose, double *x, double *y, double *heading) {
  return controller_webots_pose_read(pose, x, y, heading);
}
