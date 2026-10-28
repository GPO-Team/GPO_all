#ifndef YOUBOT_WEB_CONTROLLER_TELEMETRY_H
#define YOUBOT_WEB_CONTROLLER_TELEMETRY_H

#include "controller_types.h"
#include "controller_object_transfer_types.h"

typedef struct {
  double x;
  double y;
  double confidence;
} ControllerTelemetryPoint;

typedef struct {
  const char *status;
  const char *error;
  int current_waypoint_index;
  int finished;
  double distance_to_target;
  int avoidance_active;
  int off_route_active;
  double avoidance_time_sec;
  int avoidance_steps;
  int has_target;
  Waypoint target;
  const char *command_id;
} ControllerTelemetryNavigation;

typedef struct {
  double cruise_speed_mps;
  double payload_kg;
  double battery_range;
  double battery_speed_factor;
  double runtime_linear_limit_mps;
  double runtime_angular_limit_rad;
} ControllerTelemetryMotionProfile;

typedef struct {
  int enabled;
  int horizontal_resolution;
  double max_range;
  int last_hit_count;
  int front_hit_count;
  double front_min_range;
  double center_min_range;
  double left_front_corner_min_range;
  double right_front_corner_min_range;
  double left_min_range;
  double right_min_range;
} ControllerTelemetryLidar;

typedef struct {
  int enabled;
  int width;
  int height;
  double fov;
  const char *mode;
  const char *frame_file;
  const char *mime_type;
  int frame_sequence;
  double captured_at;
  int obstacle_visible;
  double obstacle_score;
  double obstacle_offset;
  double obstacle_angle;
  double obstacle_range;
  int detection_count;
} ControllerTelemetryCamera;

typedef struct {
  int available;
  const char *pose;
  const char *state;
  double joints[5];
  double fingers[2];
  double target_joints[5];
  double target_finger_opening;
  const char *mission_id;
  const char *object_def;
  const char *stage;
  const char *error;
  int active, load_held, cancel_pending;
  int object_valid;
  double object_position[3];
  double contacts[2];
} ControllerTelemetryManipulator;

typedef struct {
  double simulation_time;
  double pose_x;
  double pose_y;
  double pose_z;
  double pose_yaw;
  ControllerTelemetryNavigation navigation;
  ControllerTelemetryMotionProfile motion_profile;
  int dynamic_zone_count;
  int dynamic_zone_wall_count;
  ControllerTelemetryLidar lidar;
  ControllerTelemetryCamera camera;
  const ControllerTelemetryPoint *trace_points;
  int trace_point_count;
  int obstacle_map_cell_count;
  double obstacle_map_cell_size;
  int camera_map_cell_count;
  int camera_map_obstacle_cell_count;
  int camera_map_free_cell_count;
  double camera_map_cell_size;
  const Waypoint *route_waypoints;
  int route_waypoint_count;
  const ControllerObjectTransferState *object_transfer;
  int object_position_available;
  double object_x;
  double object_y;
  double object_z;
  ControllerTelemetryManipulator manipulator;
} ControllerTelemetrySnapshot;

int controller_telemetry_write_snapshot(
    const char *temp_path,
    const char *state_path,
    const ControllerTelemetrySnapshot *snapshot);

#endif
