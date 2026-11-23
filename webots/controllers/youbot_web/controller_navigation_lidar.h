#ifndef YOUBOT_WEB_CONTROLLER_NAVIGATION_LIDAR_H
#define YOUBOT_WEB_CONTROLLER_NAVIGATION_LIDAR_H

typedef struct {
  double track_caution_range;
  double avoid_stop_range;
  double track_side_bias_range;
  double avoid_side_danger_range;
  double track_hard_priority_range;
  double avoid_side_trigger_range;
  double max_heading_bias;
  double priority_switch_margin;
  double priority_center_margin;
  int priority_hold_steps;
  double expected_wall_soft_stop_range;
  double expected_wall_slowdown_range;
} ControllerNavigationLidarConfig;

typedef struct {
  int lidar_available;
  int center_passage_available;
  double center_obstacle_range;
  double near_front_range;
  double left_lidar_context;
  double right_lidar_context;
  double best_gap_beam_angle;
  double heading_error;
  int camera_visual_front_obstacle;
  double camera_obstacle_center_offset;
  int expected_zone_wall_close;
  int expected_zone_wall_slowdown;
  double expected_front_range;
  double current_priority_turn_sign;
  int current_priority_hold_steps;
} ControllerNavigationLidarInput;

typedef struct {
  double updated_heading_error;
  double heading_bias;
  double speed_scale;
  double expected_wall_speed_scale;
  int caution_active;
  int hard_priority;
  double priority_turn_sign;
  int priority_hold_steps;
} ControllerNavigationLidarOutput;

void controller_navigation_lidar_compute(
    const ControllerNavigationLidarConfig *config,
    const ControllerNavigationLidarInput *input,
    ControllerNavigationLidarOutput *output);

#endif
