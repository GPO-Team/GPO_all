#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_CAMERA_PERCEPTION_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_CAMERA_PERCEPTION_H

#define MAX_CAMERA_DETECTED_OBJECTS 8
#define MAX_CAMERA_TRACKED_TARGETS 16
#define CAMERA_FEATURE_DIM 12

typedef enum {
  CAMERA_OBJECT_NONE = 0,
  CAMERA_OBJECT_OBSTACLE = 1,
  CAMERA_OBJECT_TARGET_ORANGE = 2,
  CAMERA_OBJECT_TARGET_BLUE = 3,
} ControllerWebotsCameraObjectType;

typedef struct {
  ControllerWebotsCameraObjectType type;
  int is_pickup_target;
  char label[48];
  int min_x;
  int max_x;
  int min_y;
  int max_y;
  int pixel_count;
  double score;
  double confidence;
  double center_offset;
  double angle;
  double half_angle_width;
  double visual_range_m;
  double lidar_range_m;
  double range_m;
  int lidar_confirmed;
  int low_profile_confirmed;
  int occluded_by_lidar;
  double world_x;
  double world_z;
  double features[CAMERA_FEATURE_DIM];
} ControllerWebotsDetectedObject;

typedef struct {
  int active;
  ControllerWebotsCameraObjectType type;
  char label[48];
  double world_x;
  double world_z;
  double confidence;
  int seen_count;
  int lidar_confirmed;
  int low_profile_confirmed;
  double last_seen_time;
} ControllerWebotsTrackedTarget;

typedef struct {
  int width;
  int height;
  double focal_px;
  double position[3];
  double orientation[9];
} ControllerWebotsCameraProjection;

typedef struct {
  int visible;
  int detection_count;
  double score;
  double center_offset;
  double angle;
  double fallback_range_m;
  int confidence_boost;
  int obstacle_lidar_confirmed;
  char obstacle_label[48];

  double observed_at;
  int lidar_available;
  ControllerWebotsCameraProjection camera;
  int object_count;
  ControllerWebotsDetectedObject objects[MAX_CAMERA_DETECTED_OBJECTS];

  int target_visible;
  ControllerWebotsCameraObjectType target_type;
  char target_label[48];
  double target_score;
  double target_center_offset;
  double target_angle;
  double target_half_angle;
  double target_range_m;
  double target_lidar_range_m;
  int target_lidar_confirmed;
  int target_low_profile;
  double target_world_x;
  double target_world_z;
  double target_confidence;
} ControllerWebotsCameraPerception;

void controller_webots_camera_set_active_target(
    int active, double target_world_x, double target_world_z);

void controller_webots_camera_set_manipulator_joints(const double joints[5]);

int controller_webots_camera_rename_dataset_class(
    const char *old_name, const char *new_name);

int controller_webots_camera_perception_confirm_range(
    ControllerWebotsCameraPerception *perception, double measured_range);

int controller_webots_camera_perception_analyze(
    const unsigned char *image,
    int width,
    int height,
    double effective_fov,
    double min_obstacle_score,
    ControllerWebotsCameraPerception *perception);

int controller_webots_camera_perception_fuse_lidar(
    ControllerWebotsCameraPerception *perception,
    const float *lidar_ranges,
    int lidar_resolution,
    double lidar_fov,
    double range_search_window,
    double min_trace_range,
    double max_trace_range,
    double sensor_local_x,
    double sensor_local_y,
    double robot_x,
    double robot_z,
    double robot_heading,
    double now_time);

int controller_webots_camera_get_latest_perception(
    ControllerWebotsCameraPerception *out_perception);

int controller_webots_camera_count_box_matches(
    const ControllerWebotsCameraPerception *frame, const double position[3],
    const double orientation[9], const double size[3]);

int controller_webots_camera_get_best_target(
    double robot_x,
    double robot_z,
    double now_time,
    double max_age_seconds,
    ControllerWebotsTrackedTarget *out_target);

void controller_webots_camera_reset_tracked_targets(void);

#endif
