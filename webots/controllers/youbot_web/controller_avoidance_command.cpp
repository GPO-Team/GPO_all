#include "controller_avoidance_command.h"

#include "controller_lidar_math.h"
#include "controller_math.h"

#include <algorithm>
#include <cmath>
#include <string.h>

double controller_avoidance_choose_turn_sign(
    const ControllerAvoidanceTurnInput *input) {
  if (!input) return 1.0;
  if (fabs(input->priority_turn_sign) > 0.0) return input->priority_turn_sign;
  if (input->left_score + input->switch_margin < input->right_score ||
      input->left_clearance > input->right_clearance + input->switch_margin) {
    return 1.0;
  }
  if (input->right_score + input->switch_margin < input->left_score ||
      input->right_clearance > input->left_clearance + input->switch_margin) {
    return -1.0;
  }
  if (fabs(input->heading_error) > 0.12) {
    return input->heading_error < 0.0 ? -1.0 : 1.0;
  }
  if (input->camera_turn_sign != 0.0) return input->camera_turn_sign;
  return input->left_clearance >= input->right_clearance ? 1.0 : -1.0;
}

void controller_avoidance_compute_command(
    const ControllerAvoidanceCommandInput *input,
    const ControllerAvoidanceCommandConfig *config,
    ControllerAvoidanceCommand *command) {
  if (!input || !input->context || !input->detection || !config || !command) return;
  memset(command, 0, sizeof(*command));

  const LidarObstacleContext *context = input->context;
  const ControllerAvoidanceDetection *detection = input->detection;
  double turn_sign = input->turn_sign >= 0.0 ? 1.0 : -1.0;

  const double follow_side_range =
      turn_sign > 0.0 ? detection->right_lidar_context : detection->left_lidar_context;
  const double follow_corner_range =
      turn_sign > 0.0 ? detection->right_front_corner_range : detection->left_front_corner_range;
  const double opposite_side_range =
      turn_sign > 0.0 ? detection->left_lidar_context : detection->right_lidar_context;
  const double opposite_corner_range =
      turn_sign > 0.0 ? detection->left_front_corner_range : detection->right_front_corner_range;

  const double desired_wall_distance = clamp_value(
      config->pass_side_danger_range + 0.30,
      0.44,
      0.56);

  const int wall_still_alongside =
      follow_side_range < 1.22 ||
      follow_corner_range < 1.28;

  const int is_front_blocked =
      detection->center_obstacle_range < config->avoid_stop_range + 0.12 ||
      detection->near_front_range < config->avoid_stop_range + 0.12 ||
      follow_corner_range < config->avoid_stop_range + 0.06;

  const int is_side_too_close =
      follow_side_range < config->pass_side_danger_range + 0.04 ||
      opposite_side_range < config->pass_side_danger_range + 0.04 ||
      opposite_corner_range < config->pass_side_danger_range + 0.06;

  const int hard_blocked = is_front_blocked || is_side_too_close;

  const double gap_heading_error =
      context->has_best_gap ? wrap_angle(-context->best_gap_beam_angle) : 0.0;
  const double gap_turn_sign =
      context->has_best_gap ? (gap_heading_error < 0.0 ? -1.0 : 1.0) : turn_sign;

  if (input->stuck_steps >= config->stuck_steps_limit * 2 &&
      follow_side_range < config->avoid_stop_range &&
      context->has_best_gap &&
      gap_turn_sign != turn_sign &&
      opposite_side_range > config->avoid_recover_range + 0.25) {
    turn_sign = gap_turn_sign;
    command->turn_sign_changed = 1;
  }

  const int corners_clear =
      follow_corner_range > config->avoid_recover_range + 0.08 &&
      opposite_corner_range > config->avoid_recover_range + 0.04;

  const int clear_path_to_target =
      !wall_still_alongside &&
      !hard_blocked &&
      corners_clear &&
      detection->center_passage_available &&
      detection->near_front_range > config->avoid_recover_range + 0.06 &&
      fabs(input->heading_error_to_target) < 0.65;

  if (clear_path_to_target) {
    const double pass_left_pressure = controller_lidar_range_pressure(
        detection->left_lidar_context,
        config->track_side_bias_range + 0.14,
        config->pass_side_danger_range + 0.08);
    const double pass_right_pressure = controller_lidar_range_pressure(
        detection->right_lidar_context,
        config->track_side_bias_range + 0.14,
        config->pass_side_danger_range + 0.08);
    const double pass_centering_bias =
        clamp_value((pass_right_pressure - pass_left_pressure) * 0.35, -0.30, 0.30);
    const double pass_heading_error = wrap_angle(
        input->heading_error_to_target * 0.82 +
        gap_heading_error * 0.18 +
        pass_centering_bias);

    command->mode = CONTROLLER_AVOIDANCE_COMMAND_PASS_GAP;
    command->linear_speed = clamp_value(
        input->runtime_linear_speed_limit * config->pass_cruise_speed_factor,
        input->avoid_min_speed,
        input->avoid_max_speed);
    command->angular_speed = clamp_value(
        pass_heading_error * config->pass_steer_gain,
        -input->runtime_angular_speed_limit * 0.85,
        input->runtime_angular_speed_limit * 0.85);
    command->turn_sign = turn_sign;
    command->clear_detour = 1;
    command->clear_hold = 1;
    return;
  }

  const int rear_clear_for_reverse =
      !detection->rear_obstacle_detected ||
      detection->rear_obstacle_range > config->avoid_reverse_range + 0.14;

  if (input->stuck_steps > config->stuck_steps_limit) {
    command->mode = CONTROLLER_AVOIDANCE_COMMAND_ESCAPE;
    command->linear_speed = rear_clear_for_reverse ? -input->reverse_speed : 0.0;
    command->angular_speed = turn_sign * fmax(config->min_angular_command, input->runtime_angular_speed_limit * 0.55);
    command->reset_stuck = 1;
    command->turn_sign = turn_sign;
    return;
  }

  if (hard_blocked) {
    command->mode = CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN;
    const int critically_close =
        detection->near_front_range < config->avoid_reverse_range + 0.10 ||
        follow_corner_range < config->avoid_reverse_range + 0.10 ||
        follow_side_range < config->pass_side_danger_range + 0.03 ||
        opposite_side_range < config->pass_side_danger_range + 0.03;

    if (critically_close && rear_clear_for_reverse) {
      command->linear_speed = -input->reverse_speed;
      command->angular_speed = turn_sign * fmax(config->min_angular_command, input->runtime_angular_speed_limit * 0.55);
    } else {
      const double front_urgency = controller_lidar_range_pressure(
          fmin(detection->near_front_range, follow_corner_range),
          config->avoid_stop_range + 0.22,
          config->avoid_reverse_range + 0.10);
      command->linear_speed = 0.0;
      command->angular_speed = clamp_value(
          turn_sign * input->runtime_angular_speed_limit * (0.65 + 0.30 * front_urgency),
          -input->runtime_angular_speed_limit,
          input->runtime_angular_speed_limit);
      if (fabs(command->angular_speed) < config->min_angular_command) {
        command->angular_speed = turn_sign * config->min_angular_command;
      }
    }
    command->turn_sign = turn_sign;
    return;
  }

  const double front_clearance_scale = clamp_value(
      (fmin(detection->near_front_range, follow_corner_range) - (config->avoid_stop_range + 0.12)) /
          fmax(config->track_caution_range - (config->avoid_stop_range + 0.12), 0.15),
      0.52,
      1.0);
  const double opposite_repulsion =
      turn_sign *
      controller_lidar_range_pressure(
          fmin(opposite_side_range, opposite_corner_range),
          config->track_side_bias_range + 0.05,
          config->pass_side_danger_range + 0.06) *
      1.15;

  const int front_obstacle_approaching =
      detection->near_front_range < config->avoid_recover_range ||
      detection->center_obstacle_range < config->avoid_recover_range;

  if (wall_still_alongside || front_obstacle_approaching) {
    command->mode = CONTROLLER_AVOIDANCE_COMMAND_COMMITTED_DRIVE;

    const double side_error =
        follow_side_range < 1.22 ? (desired_wall_distance - follow_side_range) : 0.0;
    const double corner_error =
        fmax(0.0, (desired_wall_distance + 0.18) - follow_corner_range);
    const double wall_gain = side_error >= 0.0 ? 2.15 : 0.65;
    const double front_deflect = front_obstacle_approaching
                                     ? controller_lidar_range_pressure(
                                           fmin(detection->near_front_range, detection->center_obstacle_range),
                                           config->avoid_recover_range + 0.10,
                                           config->avoid_stop_range + 0.12) *
                                           1.35
                                     : 0.0;
    const double raw_wall_omega =
        turn_sign * (side_error * wall_gain + corner_error * 2.10 + front_deflect) -
        opposite_repulsion;

    const double max_contour_omega = input->runtime_angular_speed_limit * 0.80;
    command->angular_speed = clamp_value(
        raw_wall_omega,
        -max_contour_omega,
        max_contour_omega);

    const double turn_slowdown = clamp_value(
        1.0 - fabs(command->angular_speed) / fmax(input->runtime_angular_speed_limit * 1.8, 0.2),
        0.62,
        1.0);
    const double target_cruise =
        input->runtime_linear_speed_limit * 0.80 * front_clearance_scale * turn_slowdown;
    command->linear_speed = clamp_value(
        target_cruise,
        fmax(input->avoid_min_speed, input->runtime_linear_speed_limit * 0.48),
        input->avoid_max_speed);
  } else {
    command->mode = CONTROLLER_AVOIDANCE_COMMAND_GAP_DRIVE;

    const double toward_wall_sign = -turn_sign;
    double wrap_error = input->heading_error_to_target;
    if (wrap_error * toward_wall_sign > 0.0) {
      wrap_error = toward_wall_sign * fmin(fabs(wrap_error), 0.90);
    }

    const double max_wrap_omega = input->runtime_angular_speed_limit * 0.80;
    command->angular_speed = clamp_value(
        wrap_error * 2.05 - opposite_repulsion,
        -max_wrap_omega,
        max_wrap_omega);

    const double turn_brake = clamp_value(
        1.0 - fabs(wrap_error) * 0.40,
        0.60,
        1.0);
    const double target_wrap_speed =
        input->runtime_linear_speed_limit * 0.78 * front_clearance_scale * turn_brake;
    command->linear_speed = clamp_value(
        target_wrap_speed,
        input->avoid_min_speed,
        input->avoid_max_speed);
  }

  command->turn_sign = turn_sign;
}