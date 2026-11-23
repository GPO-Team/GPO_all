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
      .speed_scale = 1.0,
      .expected_wall_speed_scale = 1.0,
      .priority_turn_sign = input->current_priority_turn_sign,
      .priority_hold_steps = input->current_priority_hold_steps,
  };

  if (input->lidar_available) {
    const double tracking_front_range = input->center_passage_available
                                            ? input->center_obstacle_range
                                            : input->near_front_range;
    const double front_caution = clamp_value(
        (config->track_caution_range - tracking_front_range) /
            fmax(config->track_caution_range - config->avoid_stop_range, 0.05),
        0.0,
        1.0);
    const double left_pressure = clamp_value(
        (config->track_side_bias_range - input->left_lidar_context) /
            fmax(config->track_side_bias_range - config->avoid_side_danger_range, 0.05),
        0.0,
        1.0);
    const double right_pressure = clamp_value(
        (config->track_side_bias_range - input->right_lidar_context) /
            fmax(config->track_side_bias_range - config->avoid_side_danger_range, 0.05),
        0.0,
        1.0);
    const double asymmetric_pressure = right_pressure - left_pressure;
    double desired_turn_sign = 0.0;

    output->speed_scale = clamp_value(
        1.0 - front_caution * (input->center_passage_available ? 0.28 : 0.72) -
            fmax(left_pressure, right_pressure) *
                (input->center_passage_available ? 0.08 : 0.20),
        input->center_passage_available ? 0.52 : 0.16,
        1.0);
    output->hard_priority =
        tracking_front_range < config->track_hard_priority_range ||
        (!input->center_passage_available &&
         (input->left_lidar_context < config->avoid_side_trigger_range + 0.10 ||
          input->right_lidar_context < config->avoid_side_trigger_range + 0.10));
    output->caution_active =
        tracking_front_range < config->track_caution_range ||
        input->left_lidar_context < config->track_side_bias_range ||
        input->right_lidar_context < config->track_side_bias_range;

    if (input->center_passage_available) {
      const double gap_heading_error = wrap_angle(-input->best_gap_beam_angle);
      output->heading_bias = clamp_value(
          gap_heading_error * 0.82 + asymmetric_pressure * 0.24,
          -config->max_heading_bias,
          config->max_heading_bias);
      output->priority_turn_sign = 0.0;
      output->priority_hold_steps = 0;
    } else if (fabs(asymmetric_pressure) > config->priority_switch_margin) {
      desired_turn_sign = sign_or_one_local(asymmetric_pressure);
    } else if (output->hard_priority) {
      desired_turn_sign = fabs(input->heading_error) > 0.12
                              ? sign_or_one_local(input->heading_error)
                              : (input->left_lidar_context <= input->right_lidar_context ? -1.0 : 1.0);
    }

    if (!input->center_passage_available && output->caution_active) {
      if (desired_turn_sign != 0.0) {
        if (output->priority_turn_sign == 0.0 ||
            desired_turn_sign == output->priority_turn_sign ||
            fabs(asymmetric_pressure) > config->priority_switch_margin + 0.10 ||
            output->priority_hold_steps <= 0) {
          output->priority_turn_sign = desired_turn_sign;
          output->priority_hold_steps = config->priority_hold_steps;
        }
      } else if (output->priority_hold_steps <= 0) {
        output->priority_turn_sign = 0.0;
      }

      if (output->priority_hold_steps > 0) output->priority_hold_steps -= 1;
      if (fabs(output->priority_turn_sign) > 0.0) {
        const double bias_magnitude = clamp_value(
            (output->hard_priority ? 0.34 : 0.18) + front_caution * 0.22 +
                fmax(left_pressure, right_pressure) * 0.14,
            0.0,
            config->max_heading_bias);
        output->heading_bias = output->priority_turn_sign * bias_magnitude;
      } else if (fabs(asymmetric_pressure) > config->priority_center_margin) {
        output->heading_bias = clamp_value(
            asymmetric_pressure * (0.22 + 0.34 * front_caution),
            -config->max_heading_bias * 0.6,
            config->max_heading_bias * 0.6);
      }
    } else if (!input->center_passage_available) {
      output->priority_turn_sign = 0.0;
      output->priority_hold_steps = 0;
    }

    if (input->camera_visual_front_obstacle && output->caution_active &&
        !input->center_passage_available) {
      output->heading_bias = clamp_value(
          output->heading_bias + input->camera_obstacle_center_offset * 0.24,
          -config->max_heading_bias,
          config->max_heading_bias);
      output->speed_scale = fmin(output->speed_scale, 0.78);
    }
    output->updated_heading_error = wrap_angle(input->heading_error + output->heading_bias);
    if (output->hard_priority) {
      output->speed_scale = fmin(
          output->speed_scale, input->center_passage_available ? 0.82 : 0.58);
    }
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
