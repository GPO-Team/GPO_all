#include "controller_avoidance.h"
#include "controller_avoidance_command.h"
#include "controller_avoidance_detection.h"
#include "controller_avoidance_state.h"

#include <cmath>
#include <stddef.h>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const ControllerAvoidanceDetectionConfig config = {
      .max_trace_range = 4.0,
      .track_caution_range = 1.2,
      .expected_wall_soft_stop_range = 0.45,
      .expected_wall_slowdown_range = 0.8,
      .pass_center_clear_range = 0.9,
      .pass_gap_max_angle_rad = 0.35,
      .pass_side_danger_range = 0.5,
      .avoid_side_trigger_range = 0.7,
      .track_hard_priority_range = 0.65,
      .reflex_side_release_range = 0.9,
      .avoid_recover_range = 1.1,
      .avoid_trigger_range = 0.75,
      .avoid_stop_range = 0.4,
      .track_slow_range = 0.85,
  };

  LidarObstacleContext context = {0};
  context.unexpected_front_hit_count = 1;
  context.unexpected_front_min_range = 1.5;
  context.unexpected_center_min_range = 1.5;
  context.unexpected_left_front_min_range = 1.2;
  context.unexpected_right_front_min_range = 1.2;
  context.unexpected_left_min_range = 1.1;
  context.unexpected_right_min_range = 1.1;
  context.expected_front_min_range = 4.0;
  context.has_best_gap = 1;
  context.best_gap_range = 2.0;
  context.best_gap_beam_angle = 0.1;

  ControllerAvoidanceDetection detection;
  controller_avoidance_detect(&context, 1, 0, &config, &detection);
  if (!detection.center_passage_available || detection.should_start_avoidance) return 1;
  if (!nearly_equal(detection.near_front_range, 1.2)) return 2;

  context.unexpected_front_min_range = 0.38;
  context.unexpected_center_min_range = 0.35;
  context.unexpected_left_front_min_range = 0.5;
  context.unexpected_right_front_min_range = 0.55;
  context.has_best_gap = 0;
  controller_avoidance_detect(&context, 1, 0, &config, &detection);
  if (detection.center_passage_available || !detection.should_start_avoidance) return 3;
  if (!detection.obstacle_context_present || !detection.lidar_hard_priority_zone) return 4;

  const ControllerAvoidanceTurnInput turn_input = {
      .left_score = 0.2,
      .right_score = 1.0,
      .left_clearance = 0.7,
      .right_clearance = 0.7,
      .switch_margin = 0.1,
      .priority_turn_sign = -1.0,
      .camera_turn_sign = -1.0,
      .heading_error = -0.4,
  };
  if (!nearly_equal(controller_avoidance_choose_turn_sign(&turn_input), 1.0)) return 5;

  ControllerAvoidanceTurnInput fallback_input = {0};
  fallback_input.switch_margin = 0.1;
  fallback_input.priority_turn_sign = -1.0;
  fallback_input.camera_turn_sign = 1.0;
  fallback_input.heading_error = 0.5;
  if (!nearly_equal(controller_avoidance_choose_turn_sign(&fallback_input), -1.0)) return 6;

  const ControllerAvoidanceCommandConfig command_config = {
      .avoid_recover_range = 1.1,
      .avoid_stop_range = 0.4,
      .avoid_reverse_range = 0.25,
      .gap_min_range = 0.8,
      .track_caution_range = 1.2,
      .track_side_bias_range = 0.9,
      .pass_side_danger_range = 0.5,
      .pass_center_clear_range = 0.9,
      .pass_cruise_speed_factor = 0.8,
      .pass_steer_gain = 1.4,
      .min_angular_command = 0.12,
      .gap_switch_range_bonus = 0.4,
      .stuck_steps_limit = 20,
  };
  ControllerAvoidanceCommandInput command_input = {
      .context = &context,
      .detection = &detection,
      .turn_sign = 1.0,
      .stuck_steps = 0,
      .detour_active = 0,
      .detour_heading_error = 0.0,
      .heading_error_to_target = 0.0,
      .runtime_linear_speed_limit = 0.3,
      .runtime_angular_speed_limit = 1.0,
      .pass_min_speed = 0.08,
      .pass_max_speed = 0.22,
      .avoid_min_speed = 0.07,
      .avoid_max_speed = 0.18,
      .reverse_speed = 0.05,
  };
  ControllerAvoidanceCommand command;

  context.has_best_gap = 1;
  context.best_gap_range = 2.0;
  context.best_gap_beam_angle = -0.1;
  detection.center_passage_available = 1;
  detection.center_obstacle_range = 1.5;
  detection.front_obstacle_range = 1.5;
  detection.left_lidar_context = 1.0;
  detection.right_lidar_context = 1.0;
  controller_avoidance_compute_command(&command_input, &command_config, &command);
  if (command.mode != CONTROLLER_AVOIDANCE_COMMAND_PASS_GAP) return 7;
  if (command.linear_speed <= 0.0 || !command.clear_detour || !command.clear_hold) return 8;

  context.has_best_gap = 0;
  detection.center_passage_available = 0;
  detection.center_obstacle_range = 0.2;
  detection.front_obstacle_range = 0.3;
  controller_avoidance_compute_command(&command_input, &command_config, &command);
  if (command.mode != CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN) return 9;
  if (command.linear_speed >= 0.0 || command.angular_speed <= 0.0) return 10;

  command_input.stuck_steps = 21;
  controller_avoidance_compute_command(&command_input, &command_config, &command);
  if (command.mode != CONTROLLER_AVOIDANCE_COMMAND_ESCAPE || !command.reset_stuck) return 11;

  ControllerAvoidanceState state = {0};
  state.active = 1;
  state.turn_sign = -1.0;
  state.contour_steps = 42;
  state.detour_active = 1;
  controller_avoidance_state_reset(&state, 1.25, -0.75);
  if (state.active || state.mode != AVOID_MODE_NONE || state.contour_steps != 0) return 12;
  if (!nearly_equal(state.turn_sign, 1.0)) return 13;
  if (!nearly_equal(state.prev_x, 1.25) || !nearly_equal(state.prev_z, -0.75)) return 14;
  if (!nearly_equal(state.start_x, 1.25) || !nearly_equal(state.start_z, -0.75)) return 15;
  if (state.detour_active || !nearly_equal(state.detour_x, 1.25) ||
      !nearly_equal(state.detour_z, -0.75)) {
    return 16;
  }

  const ControllerAvoidanceDetourConfig detour_config = {
      .forward_distance = 0.6,
      .max_distance = 1.8,
      .side_distance = 0.4,
  };
  controller_avoidance_set_detour(
      &state, 1.0, 2.0, 0.0, NULL, 1.0, &detour_config);
  if (!state.detour_active) return 17;
  if (!nearly_equal(state.detour_x, 1.0 + cos(0.92) * 0.6)) return 18;
  if (!nearly_equal(state.detour_z, 2.0 + sin(0.92) * 0.6 + 0.4 * 0.28)) return 19;

  LidarObstacleContext detour_context = {0};
  detour_context.has_best_gap = 1;
  detour_context.best_gap_beam_angle = -0.25;
  detour_context.best_gap_range = 1.5;
  controller_avoidance_set_detour(
      &state, 0.0, 0.0, 0.0, &detour_context, -1.0, &detour_config);
  if (!nearly_equal(state.detour_x, cos(0.25) * 1.08)) return 20;
  if (!nearly_equal(state.detour_z, sin(0.25) * 1.08 - 0.4 * 0.28)) return 21;

  controller_avoidance_state_reset(&state, 0.0, 0.0);
  state.hold_steps = 2;
  state.prev_target_distance = 10.0;
  state.best_target_distance = 10.0;
  state.detour_active = 1;
  const ControllerAvoidanceProgressConfig progress_config = {
      .stuck_pose_epsilon = 0.01,
      .stuck_progress_epsilon = 0.01,
      .best_progress_epsilon = 0.05,
      .min_contour_steps = 3,
      .detour_reached_distance = 0.2,
  };
  const ControllerAvoidanceProgressInput progress_input = {
      .x = 0.001,
      .z = 0.0,
      .heading = 0.01,
      .target_distance = 9.999,
      .obstacle_context_present = 0,
      .detour_distance = 0.1,
  };
  controller_avoidance_update_progress(&state, &progress_input, &progress_config);
  if (state.contour_steps != 1 || state.hold_steps != 1 || state.stuck_steps != 1) return 22;
  if (state.no_obstacle_steps != 1 || state.clear_steps != 2 || state.detour_active) return 23;
  if (!nearly_equal(state.prev_x, 0.001) ||
      !nearly_equal(state.prev_target_distance, 9.999)) {
    return 24;
  }
  if (!nearly_equal(state.heading_accum_rad, 0.01) || state.no_progress_steps != 0) return 25;

  controller_avoidance_state_begin(&state, 2.0, 3.0, 0.4, 7.5, -1.0, 12);
  if (!state.active || state.mode != AVOID_MODE_FOLLOW_EDGE || state.hold_steps != 12) return 26;
  if (!nearly_equal(state.turn_sign, -1.0) || state.obstacle_side != 1) return 27;
  if (!nearly_equal(state.prev_x, 2.0) || !nearly_equal(state.prev_z, 3.0)) return 28;
  if (!nearly_equal(state.prev_target_distance, 7.5) ||
      !nearly_equal(state.hit_target_distance, 7.5) ||
      !nearly_equal(state.best_target_distance, 7.5)) {
    return 29;
  }
  if (!nearly_equal(state.state_heading, 0.4) ||
      !nearly_equal(state.prev_heading, 0.4) || state.stuck_steps != 0) {
    return 30;
  }

  return 0;
}
