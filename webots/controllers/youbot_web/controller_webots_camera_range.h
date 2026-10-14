#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_CAMERA_RANGE_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_CAMERA_RANGE_H

#include "controller_webots_sensors.h"

int controller_webots_camera_confirmed_range_from_lidar(
    const ControllerWebotsSensors *sensors,
    int lidar_available,
    int lidar_resolution,
    double lidar_fov,
    double relative_angle,
    double search_window_rad,
    double min_range,
    double max_range,
    double *confirmed_range);

double controller_webots_camera_range_from_lidar(
    const ControllerWebotsSensors *sensors,
    int lidar_available,
    int lidar_resolution,
    double lidar_fov,
    double relative_angle,
    double search_window_rad,
    double min_range,
    double max_range,
    double fallback_range);

#endif
