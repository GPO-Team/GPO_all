#ifndef YOUBOT_WEB_CONTROLLER_AVOIDANCE_H
#define YOUBOT_WEB_CONTROLLER_AVOIDANCE_H

#include "controller_types.h"

typedef struct {
  double max_trace_range;
  double track_caution_range;
  double expected_wall_soft_stop_range;
  double expected_wall_slowdown_range;
  double pass_center_clear_range;
  double pass_gap_max_angle_rad;
  double pass_side_danger_range;
  double avoid_side_trigger_range;
  double track_hard_priority_range;
  double reflex_side_release_range;
  double avoid_recover_range;
  double avoid_trigger_range;
  double avoid_stop_range;
  double track_slow_range;
} ControllerAvoidanceDetectionConfig;

typedef struct {
  int front_obstacle_detected;
  double front_obstacle_range;
  double center_obstacle_range;
  double left_front_corner_range;
  double right_front_corner_range;
  double left_obstacle_range;
  double right_obstacle_range;
  double expected_front_range;
  double near_front_range;
  double left_lidar_context;
  double right_lidar_context;
  int expected_zone_wall_ahead;
  int expected_zone_wall_close;
  int expected_zone_wall_slowdown;
  int center_passage_available;
  int side_obstacle_detected;
  int lidar_hard_priority_zone;
  int front_corner_obstacle_detected;
  int obstacle_context_present;
  int should_start_avoidance;
} ControllerAvoidanceDetection;

typedef struct {
  double left_score;
  double right_score;
  double left_clearance;
  double right_clearance;
  double switch_margin;
  double priority_turn_sign;
  double camera_turn_sign;
  double heading_error;
} ControllerAvoidanceTurnInput;

typedef enum {
  CONTROLLER_AVOIDANCE_COMMAND_PASS_GAP = 0,
  CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN = 1,
  CONTROLLER_AVOIDANCE_COMMAND_GAP_DRIVE = 2,
  CONTROLLER_AVOIDANCE_COMMAND_COMMITTED_DRIVE = 3,
  CONTROLLER_AVOIDANCE_COMMAND_ESCAPE = 4,
} ControllerAvoidanceCommandMode;

typedef struct {
  double avoid_recover_range;
  double avoid_stop_range;
  double avoid_reverse_range;
  double gap_min_range;
  double track_caution_range;
  double track_side_bias_range;
  double pass_side_danger_range;
  double pass_center_clear_range;
  double pass_cruise_speed_factor;
  double pass_steer_gain;
  double min_angular_command;
  double gap_switch_range_bonus;
  int stuck_steps_limit;
} ControllerAvoidanceCommandConfig;

typedef struct {
  const LidarObstacleContext *context;
  const ControllerAvoidanceDetection *detection;
  double turn_sign;
  int stuck_steps;
  int detour_active;
  double detour_heading_error;
  double heading_error_to_target;
  double runtime_linear_speed_limit;
  double runtime_angular_speed_limit;
  double pass_min_speed;
  double pass_max_speed;
  double avoid_min_speed;
  double avoid_max_speed;
  double reverse_speed;
} ControllerAvoidanceCommandInput;

typedef struct {
  ControllerAvoidanceCommandMode mode;
  double linear_speed;
  double angular_speed;
  double turn_sign;
  int turn_sign_changed;
  int clear_detour;
  int clear_hold;
  int reset_stuck;
} ControllerAvoidanceCommand;

typedef struct {
  AvoidanceMode mode;
  int hold_steps;
  double turn_sign;
  int active;
  int obstacle_side;
  int release_steps;
  int contour_steps;
  int clear_steps;
  int escape_steps;
  int stuck_steps;
  int no_obstacle_steps;
  double prev_x;
  double prev_z;
  double prev_target_distance;
  double hit_target_distance;
  double state_heading;
  double start_x;
  double start_z;
  double best_target_distance;
  int no_progress_steps;
  double prev_heading;
  double heading_accum_rad;
  int detour_active;
  double detour_x;
  double detour_z;
} ControllerAvoidanceState;

typedef struct {
  double forward_distance;
  double max_distance;
  double side_distance;
} ControllerAvoidanceDetourConfig;

typedef struct {
  double stuck_pose_epsilon;
  double stuck_progress_epsilon;
  double best_progress_epsilon;
  int min_contour_steps;
  double detour_reached_distance;
} ControllerAvoidanceProgressConfig;

typedef struct {
  double x;
  double z;
  double heading;
  double target_distance;
  int obstacle_context_present;
  double detour_distance;
} ControllerAvoidanceProgressInput;

void controller_avoidance_detect(
    const LidarObstacleContext *context,
    int lidar_available,
    int camera_visual_front_obstacle,
    const ControllerAvoidanceDetectionConfig *config,
    ControllerAvoidanceDetection *detection);
double controller_avoidance_choose_turn_sign(
    const ControllerAvoidanceTurnInput *input);
void controller_avoidance_compute_command(
    const ControllerAvoidanceCommandInput *input,
    const ControllerAvoidanceCommandConfig *config,
    ControllerAvoidanceCommand *command);
void controller_avoidance_state_reset(
    ControllerAvoidanceState *state,
    double start_x,
    double start_z);
void controller_avoidance_state_begin(
    ControllerAvoidanceState *state,
    double x,
    double z,
    double heading,
    double target_distance,
    double turn_sign,
    int hold_steps);
void controller_avoidance_set_detour(
    ControllerAvoidanceState *state,
    double x,
    double z,
    double heading,
    const LidarObstacleContext *context,
    double turn_sign,
    const ControllerAvoidanceDetourConfig *config);
void controller_avoidance_update_progress(
    ControllerAvoidanceState *state,
    const ControllerAvoidanceProgressInput *input,
    const ControllerAvoidanceProgressConfig *config);

#include "controller_avoidance_command.h"
#include "controller_avoidance_detection.h"
#include "controller_avoidance_state.h"

#endif
