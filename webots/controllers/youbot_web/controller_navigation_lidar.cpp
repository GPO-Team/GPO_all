#include "controller_navigation_lidar.h"

#include "controller_math.h"

#include <cmath>

static double sign_or_one_local(double value) {
  return value < 0.0 ? -1.0 : 1.0;
}

void controller_navigation_lidar_compute(
    const ControllerNavigationLidarConfig *config,
    const ControllerNavigationLidarInput *input,
    ControllerNavigationLidarOutput *output) {
  if (!config || !input || !output) return;
  *output = ControllerNavigationLidarOutput{
      .updated_heading_error = input->heading_error,
      .heading_bias = 0.0,
      .speed_scale = 1.0,
      .expected_wall_speed_scale = 1.0,
      .priority_turn_sign = input->current_priority_turn_sign,
      .priority_hold_steps = input->current_priority_hold_steps,
  };

  double raw_heading_bias = 0.0;

  if (input->lidar_available || input->camera_visual_front_obstacle) {
    const double tracking_front_range = input->center_passage_available
                                            ? input->center_obstacle_range
                                            : input->near_front_range;
    const double front_caution = clamp_value(
        (config->track_caution_range + 0.15 - tracking_front_range) /
            fmax(config->track_caution_range - config->avoid_stop_range + 0.15, 0.05),
        0.0,
        1.0);
    const double left_pressure = input->lidar_available
                                     ? clamp_value(
                                           (config->track_side_bias_range + 0.10 - input->left_lidar_context) /
                                               fmax(config->track_side_bias_range - config->avoid_side_danger_range + 0.10, 0.05),
                                           0.0,
                                           1.0)
                                     : 0.0;
    const double right_pressure = input->lidar_available
                                      ? clamp_value(
                                            (config->track_side_bias_range + 0.10 - input->right_lidar_context) /
                                                fmax(config->track_side_bias_range - config->avoid_side_danger_range + 0.10, 0.05),
                                            0.0,
                                            1.0)
                                      : 0.0;
    const double asymmetric_pressure = right_pressure - left_pressure;
    const int large_target_turn = fabs(input->heading_error) > 0.45;
    double desired_turn_sign = 0.0;

    output->speed_scale = clamp_value(
        1.0 - front_caution * (input->center_passage_available ? 0.24 : 0.62) -
            fmax(left_pressure, right_pressure) *
                (input->center_passage_available ? 0.08 : 0.18),
        input->center_passage_available ? 0.55 : 0.24,
        1.0);
    output->hard_priority =
        tracking_front_range < config->track_hard_priority_range + 0.05 ||
        (!input->center_passage_available &&
         input->lidar_available &&
         (input->left_lidar_context < config->avoid_side_trigger_range + 0.12 ||
          input->right_lidar_context < config->avoid_side_trigger_range + 0.12));
    output->caution_active =
        input->camera_visual_front_obstacle ||
        tracking_front_range < config->track_caution_range + 0.15 ||
        (input->lidar_available &&
         (input->left_lidar_context < config->track_side_bias_range + 0.10 ||
          input->right_lidar_context < config->track_side_bias_range + 0.10));

    if (input->center_passage_available) {
      if (large_target_turn) {
        raw_heading_bias = 0.0;
      } else {
        const double gap_heading_error = wrap_angle(-input->best_gap_beam_angle);
        raw_heading_bias = clamp_value(
            gap_heading_error * 0.72 + asymmetric_pressure * 0.20,
            -config->max_heading_bias,
            config->max_heading_bias);
      }
      if (output->priority_hold_steps > 0) output->priority_hold_steps -= 1;
      if (output->priority_hold_steps <= 0) output->priority_turn_sign = 0.0;
    } else if (fabs(asymmetric_pressure) > config->priority_switch_margin) {
      desired_turn_sign = sign_or_one_local(asymmetric_pressure);
    } else if (input->camera_visual_front_obstacle &&
               fabs(input->camera_obstacle_center_offset) > 0.10) {
      desired_turn_sign = input->camera_obstacle_center_offset < 0.0 ? -1.0 : 1.0;
    } else if (output->hard_priority) {
      if (fabs(output->priority_turn_sign) > 0.0) {
        desired_turn_sign = output->priority_turn_sign;
      } else if (fabs(input->heading_error) > 0.14) {
        desired_turn_sign = sign_or_one_local(input->heading_error);
      } else {
        desired_turn_sign = input->left_lidar_context >= input->right_lidar_context ? 1.0 : -1.0;
      }
    }

    const int committed_hold =
        config->priority_hold_steps < 65 ? 65 : config->priority_hold_steps;

    if (!input->center_passage_available && output->caution_active) {
      if (desired_turn_sign != 0.0) {
        const int allow_flip =
            output->priority_turn_sign == 0.0 ||
            desired_turn_sign == output->priority_turn_sign ||
            (output->priority_hold_steps <= 0 &&
             fabs(asymmetric_pressure) > config->priority_switch_margin + 0.40);
        if (allow_flip) {
          output->priority_turn_sign = desired_turn_sign;
          output->priority_hold_steps = committed_hold;
        }
      } else if (tracking_front_range < config->track_caution_range &&
                 fabs(output->priority_turn_sign) > 0.0) {
        output->priority_hold_steps =
            output->priority_hold_steps > 36 ? output->priority_hold_steps : 36;
      } else if (output->priority_hold_steps <= 0) {
        output->priority_turn_sign = 0.0;
      }

      if (output->priority_hold_steps > 0 &&
          tracking_front_range >= config->track_caution_range) {
        output->priority_hold_steps -= 1;
      }

      if (fabs(output->priority_turn_sign) > 0.0) {
        const double bias_magnitude = clamp_value(
            (output->hard_priority ? 0.34 : 0.18) + front_caution * 0.22 +
                fmax(left_pressure, right_pressure) * 0.14,
            0.0,
            config->max_heading_bias);
        raw_heading_bias = output->priority_turn_sign * bias_magnitude;
      } else if (fabs(asymmetric_pressure) > config->priority_center_margin) {
        raw_heading_bias = clamp_value(
            asymmetric_pressure * (0.22 + 0.34 * front_caution),
            -config->max_heading_bias * 0.6,
            config->max_heading_bias * 0.6);
      }
    } else if (!input->center_passage_available) {
      if (output->priority_hold_steps > 0) {
        output->priority_hold_steps -= 1;
      } else {
        output->priority_turn_sign = 0.0;
      }
    }

    if (input->camera_visual_front_obstacle && output->caution_active &&
        !input->center_passage_available) {
      double cam_offset = input->camera_obstacle_center_offset;
      if (fabs(output->priority_turn_sign) > 0.0 &&
          cam_offset * output->priority_turn_sign < 0.0) {
        cam_offset = 0.0;
      }
      raw_heading_bias = clamp_value(
          raw_heading_bias + cam_offset * 0.24,
          -config->max_heading_bias,
          config->max_heading_bias);
      output->speed_scale = fmin(output->speed_scale, 0.78);
    }

    const int steering_outward =
        fabs(raw_heading_bias) > fabs(input->prev_heading_bias) &&
        (input->prev_heading_bias == 0.0 ||
         (raw_heading_bias * input->prev_heading_bias) > 0.0);
    const double smooth_alpha = steering_outward ? 0.35 : 0.14;
    output->heading_bias = clamp_value(
        input->prev_heading_bias +
            smooth_alpha * (raw_heading_bias - input->prev_heading_bias),
        -config->max_heading_bias,
        config->max_heading_bias);
    if (fabs(output->heading_bias) < 0.005 && fabs(raw_heading_bias) < 0.005) {
      output->heading_bias = 0.0;
    }

    output->updated_heading_error =
        wrap_angle(input->heading_error + output->heading_bias);
    if (output->hard_priority) {
      output->speed_scale = fmin(
          output->speed_scale, input->center_passage_available ? 0.82 : 0.62);
    }
  } else {
    output->heading_bias = input->prev_heading_bias * 0.85;
    if (fabs(output->heading_bias) < 0.005) output->heading_bias = 0.0;
    output->updated_heading_error =
        wrap_angle(input->heading_error + output->heading_bias);
  }

  if (!output->caution_active && input->expected_zone_wall_slowdown) {
    output->expected_wall_speed_scale = clamp_value(
        (input->expected_front_range - config->expected_wall_soft_stop_range) /
            fmax(config->expected_wall_slowdown_range -
                     config->expected_wall_soft_stop_range,
                 0.05),
        0.32,
        1.0);
    if (input->expected_zone_wall_close && fabs(input->heading_error) < 0.24) {
      output->expected_wall_speed_scale =
          fmin(output->expected_wall_speed_scale, 0.26);
    }
  }
}