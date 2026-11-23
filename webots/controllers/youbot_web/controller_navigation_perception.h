#ifndef YOUBOT_WEB_CONTROLLER_NAVIGATION_PERCEPTION_H
#define YOUBOT_WEB_CONTROLLER_NAVIGATION_PERCEPTION_H

#include "controller_avoidance.h"

typedef struct {
  double camera_range_epsilon;
  double camera_range_fallback;
  double camera_min_fov;
  double camera_front_fov_factor;
  double camera_range_margin;
  double camera_min_score;
  int camera_min_detection_count;
  double camera_offset_deadband;
  ControllerAvoidanceDetectionConfig avoidance;
} ControllerNavigationPerceptionConfig;

typedef struct {
  const LidarObstacleContext *lidar_context;
  int lidar_available;
  int camera_visible;
  double camera_angle;
  double camera_fov;
  double camera_range;
  double camera_score;
  int camera_detection_count;
  double camera_center_offset;
} ControllerNavigationPerceptionInput;

typedef struct {
  int camera_visual_front_obstacle;
  double camera_preferred_turn_sign;
  ControllerAvoidanceDetection avoidance;
} ControllerNavigationPerceptionOutput;

void controller_navigation_perception_prepare(
    const ControllerNavigationPerceptionInput *input,
    const ControllerNavigationPerceptionConfig *config,
    ControllerNavigationPerceptionOutput *output);

#endif
