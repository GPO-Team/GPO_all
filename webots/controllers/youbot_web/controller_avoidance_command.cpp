#include "controller_avoidance_command.h"

#include "controller_lidar_math.h"
#include "controller_math.h"

#include <cmath>
#include <string.h>

double controller_avoidance_choose_turn_sign(
    const ControllerAvoidanceTurnInput *input) {
  if (!input) return 1.0;
  if (input->left_score + input->switch_margin < input->right_score ||
      input->left_clearance > input->right_clearance + input->switch_margin) {
    return 1.0;
  }
  if (input->right_score + input->switch_margin < input->left_score ||
      input->right_clearance > input->left_clearance + input->switch_margin) {
    return -1.0;
  }
  if (fabs(input->priority_turn_sign) > 0.0) return input->priority_turn_sign;
  if (input->camera_turn_sign != 0.0) return input->camera_turn_sign;
  return input->heading_error < 0.0 ? -1.0 : 1.0;
}

void controller_avoidance_compute_command(
    const ControllerAvoidanceCommandInput *input,
    const ControllerAvoidanceCommandConfig *config,
    ControllerAvoidanceCommand *command) {
  if (!input || !input->context || !input->detection || !config || !command) return;
  memset(command, 0, sizeof(*command));

  const LidarObstacleContext *context = input->context;
  const ControllerAvoidanceDetection *detection = input->detection;
  double turn_sign = input->turn_sign;
  const int hard_front_blocked =
      detection->center_obstacle_range < config->avoid_stop_range + 0.05 ||
      (!detection->center_passage_available &&
       (detection->front_obstacle_range < config->avoid_stop_range + 0.10 ||
        context->unexpected_front_score > 0.95));
  const double gap_heading_error =
      context->has_best_gap ? wrap_angle(-context->best_gap_beam_angle) : 0.0;
  const double gap_turn_sign =
      context->has_best_gap ? (gap_heading_error < 0.0 ? -1.0 : 1.0) : turn_sign;

  if (detection->center_passage_available && !hard_front_blocked) {
    const double pass_left_pressure = controller_lidar_range_pressure(
        detection->left_lidar_context,
        config->track_side_bias_range,
        config->pass_side_danger_range);
    const double pass_right_pressure = controller_lidar_range_pressure(
        detection->right_lidar_context,
        config->track_side_bias_range,
        config->pass_side_danger_range);
    const double pass_centering_bias =
        clamp_value((pass_right_pressure - pass_left_pressure) * 0.34, -0.30, 0.30);
    const double pass_heading_error = wrap_angle(
        gap_heading_error + pass_centering_bias + input->heading_error_to_target * 0.06);
    const double pass_speed_scale = clamp_value(
        (context->best_gap_range - config->pass_center_clear_range) /
            fmax(config->track_caution_range - config->pass_center_clear_range, 0.08),
        0.52,
        1.0);

    command->mode = CONTROLLER_AVOIDANCE_COMMAND_PASS_GAP;
    command->linear_speed = clamp_value(
        input->runtime_linear_speed_limit * config->pass_cruise_speed_factor * pass_speed_scale,
        input->pass_min_speed,
        input->pass_max_speed);
    command->angular_speed = clamp_value(
        pass_heading_error * config->pass_steer_gain,
        -input->runtime_angular_speed_limit * 0.72,
        input->runtime_angular_speed_limit * 0.72);
    if (fabs(pass_heading_error) > 0.06 &&
        fabs(command->angular_speed) < config->min_angular_command * 0.55) {
      command->angular_speed =
          (pass_heading_error < 0.0 ? -1.0 : 1.0) * config->min_angular_command * 0.55;
    }
    command->turn_sign = turn_sign;
    command->clear_detour = 1;
    command->clear_hold = 1;
    return;
  }

  if (context->has_best_gap && gap_turn_sign != turn_sign &&
      (input->stuck_steps > config->stuck_steps_limit / 2 ||
       context->best_gap_range >
           detection->front_obstacle_range + config->gap_switch_range_bonus)) {
    turn_sign = gap_turn_sign;
    command->turn_sign_changed = 1;
  }

  const double front_pressure = controller_lidar_range_pressure(
      detection->front_obstacle_range,
      config->avoid_recover_range,
      config->avoid_stop_range);
  const double center_pressure = controller_lidar_range_pressure(
      detection->center_obstacle_range,
      config->avoid_recover_range,
      config->avoid_reverse_range);
  const double side_commit_score =
      turn_sign > 0.0 ? context->unexpected_right_score : context->unexpected_left_score;
  const double opposite_side_score =
      turn_sign > 0.0 ? context->unexpected_left_score : context->unexpected_right_score;
  const double gap_speed_scale = context->has_best_gap
                                     ? clamp_value(
                                           (context->best_gap_range - config->gap_min_range) /
                                               fmax(config->track_caution_range -
                                                        config->gap_min_range,
                                                    0.1),
                                           0.28,
                                           1.0)
                                     : 0.42;
  const double turn_lock_bias = clamp_value(side_commit_score - opposite_side_score, -0.55, 0.55);
  const double local_detour_bias = input->detour_active
                                       ? clamp_value(input->detour_heading_error * 0.26, -0.24, 0.24)
                                       : 0.0;
  const double route_bias = input->detour_active
                                ? 0.0
                                : clamp_value(input->heading_error_to_target * 0.10, -0.10, 0.10);

  if (hard_front_blocked) {
    const double hard_turn_error = context->has_best_gap
                                       ? gap_heading_error
                                       : (input->detour_active ? input->detour_heading_error
                                                               : turn_sign);
    command->mode = CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN;
    command->linear_speed =
        detection->center_obstacle_range < config->avoid_reverse_range
            ? -input->reverse_speed
            : 0.0;
    command->angular_speed = clamp_value(
        hard_turn_error * (context->has_best_gap ? 2.5 : 1.45),
        -input->runtime_angular_speed_limit,
        input->runtime_angular_speed_limit);
    if (fabs(command->angular_speed) < config->min_angular_command) {
      command->angular_speed = turn_sign * config->min_angular_command;
    }
  } else {
    command->mode = context->has_best_gap
                        ? CONTROLLER_AVOIDANCE_COMMAND_GAP_DRIVE
                        : CONTROLLER_AVOIDANCE_COMMAND_COMMITTED_DRIVE;
    command->linear_speed = clamp_value(
        input->runtime_linear_speed_limit *
            (0.46 - front_pressure * 0.18 - center_pressure * 0.12) * gap_speed_scale,
        input->avoid_min_speed,
        input->avoid_max_speed);
    if (context->has_best_gap) {
      const double detour_weight = input->detour_active ? 0.52 : 0.0;
      const double steer_error = wrap_angle(
          gap_heading_error * (1.0 - detour_weight) +
          input->detour_heading_error * detour_weight);
      command->angular_speed = clamp_value(
          steer_error * 1.95 +
              turn_sign * (input->runtime_angular_speed_limit * 0.18 + front_pressure * 0.22) +
              turn_lock_bias * 0.18 + local_detour_bias + route_bias,
          -input->runtime_angular_speed_limit,
          input->runtime_angular_speed_limit);
    } else {
      command->angular_speed = clamp_value(
          turn_sign * (input->runtime_angular_speed_limit * 0.52 + front_pressure * 0.38) +
              turn_lock_bias * 0.55 + local_detour_bias + route_bias,
          -input->runtime_angular_speed_limit,
          input->runtime_angular_speed_limit);
    }
    if (fabs(command->angular_speed) < config->min_angular_command) {
      command->angular_speed = turn_sign * config->min_angular_command;
    }
  }

  if (input->stuck_steps > config->stuck_steps_limit) {
    command->mode = CONTROLLER_AVOIDANCE_COMMAND_ESCAPE;
    command->linear_speed = -input->reverse_speed;
    command->angular_speed = turn_sign * input->runtime_angular_speed_limit;
    command->reset_stuck = 1;
  }
  command->turn_sign = turn_sign;
}
