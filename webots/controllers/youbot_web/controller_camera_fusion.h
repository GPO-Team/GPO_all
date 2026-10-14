#ifndef YOUBOT_WEB_CONTROLLER_CAMERA_FUSION_H
#define YOUBOT_WEB_CONTROLLER_CAMERA_FUSION_H

int controller_camera_fusion_confirmed_range(
    const float *ranges,
    int resolution,
    double lidar_fov,
    double relative_angle,
    double search_window_rad,
    double min_range,
    double max_range,
    double *confirmed_range);

double controller_camera_fusion_estimate_range(
    const float *ranges,
    int resolution,
    double lidar_fov,
    double relative_angle,
    double search_window_rad,
    double min_range,
    double max_range,
    double fallback_range);

#endif
