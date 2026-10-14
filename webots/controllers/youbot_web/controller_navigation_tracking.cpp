#include "controller_navigation_tracking.h"

#include "controller_math.h"

#include <cmath>

static double sign_or_one_local(double value) {
  return value < 0.0 ? -1.0 : 1.0;
}

int controller_navigation_tracking_prepare(
    const ControllerNavigationTrackingConfig *config,
    const ControllerNavigationTrackingInput *input,
    ControllerNavigationTrackingOutput *output) {
  if (!config || !input || !output) return 0;
  *output = ControllerNavigationTrackingOutput{
      input->mode,
      CONTROLLER_NAVIGATION_TRACKING_DRIVE,
      CONTROLLER_NAVIGATION_STATUS_TRACK_PATH,
      0.0,
      0.0,
  };

  if (output->mode == NAV_MODE_IDLE) output->mode = NAV_MODE_TRACK;
  const double align_distance = fmin(config->final_align_distance, config->position_tolerance);
  if (input->is_final_waypoint && input->target_has_heading &&
      input->distance_to_target <= align_distance) {
    output->mode = NAV_MODE_FINAL_ALIGN;
  } else if (!input->is_final_waypoint && output->mode == NAV_MODE_FINAL_ALIGN) {
    output->mode = NAV_MODE_TRACK;
  }

  if (output->mode != NAV_MODE_FINAL_ALIGN) return 0;
  if (!input->is_final_waypoint || !input->target_has_heading) {
    output->mode = NAV_MODE_TRACK;
    return 0;
  }
  if (input->distance_to_target > align_distance) {
    output->mode = NAV_MODE_TURN;
    return 0;
  }

  const double heading_error = wrap_angle(input->target_heading - input->current_heading);
  output->angular_speed = clamp_value(
      heading_error * config->final_align_gain,
      -input->runtime_angular_speed_limit,
      input->runtime_angular_speed_limit);
  if (fabs(heading_error) > config->heading_tolerance_rad &&
      fabs(output->angular_speed) < config->min_angular_command) {
    output->angular_speed = sign_or_one_local(heading_error) * config->min_angular_command;
  }
  output->action = CONTROLLER_NAVIGATION_TRACKING_FINAL_ALIGN;
  output->status = CONTROLLER_NAVIGATION_STATUS_ALIGN_FINAL;
  return 1;
}

void controller_navigation_tracking_compute(
    const ControllerNavigationTrackingConfig *config,
    const ControllerNavigationTrackingInput *input,
    ControllerNavigationTrackingOutput *output) {
  if (!config || !input || !output) return;
  if (controller_navigation_tracking_prepare(config, input, output)) return;

  NavigationMode mode = output->mode;
  if (input->route_relaxed_mode && mode == NAV_MODE_TURN) mode = NAV_MODE_TRACK;

  if (mode == NAV_MODE_TURN) {
    const int lidar_priority = !input->avoidance_active && input->lidar_hard_priority &&
                               fabs(input->lidar_priority_turn_sign) > 0.0;
    const double preferred_turn_error = lidar_priority
                                            ? wrap_angle(input->heading_error_to_target +
                                                         input->lidar_heading_bias)
                                            : input->updated_heading_error;
    if (fabs(preferred_turn_error) <= config->turn_exit_error_rad ||
        input->distance_to_target <= config->track_slow_radius * 0.5) {
      mode = NAV_MODE_TRACK;
    } else {
      output->mode = mode;
      output->action = CONTROLLER_NAVIGATION_TRACKING_TURN;
      output->status = lidar_priority ? CONTROLLER_NAVIGATION_STATUS_TURN_LIDAR
                                      : CONTROLLER_NAVIGATION_STATUS_TURN_PATH;
      output->linear_speed = 0.0;
      output->angular_speed = clamp_value(
          preferred_turn_error * config->turn_heading_gain,
          -input->runtime_angular_speed_limit,
          input->runtime_angular_speed_limit);
      if (fabs(preferred_turn_error) > config->heading_tolerance_rad &&
          fabs(output->angular_speed) < config->min_angular_command) {
        output->angular_speed = sign_or_one_local(preferred_turn_error) * config->min_angular_command;
      }
      return;
    }
  }

  if (!input->route_relaxed_mode &&
      fabs(input->updated_heading_error) > config->track_reenter_turn_rad &&
      input->distance_to_target > config->track_slow_radius) {
    output->mode = NAV_MODE_TURN;
    output->action = CONTROLLER_NAVIGATION_TRACKING_TURN;
    output->status = CONTROLLER_NAVIGATION_STATUS_TURN_PATH;
    output->linear_speed = 0.0;
    output->angular_speed = clamp_value(
        input->updated_heading_error * config->turn_heading_gain,
        -input->runtime_angular_speed_limit,
        input->runtime_angular_speed_limit);
    if (fabs(output->angular_speed) < config->min_angular_command) {
      output->angular_speed = sign_or_one_local(input->updated_heading_error) *
                              config->min_angular_command;
    }
    return;
  }

  output->mode = mode;
  output->action = CONTROLLER_NAVIGATION_TRACKING_DRIVE;
  output->angular_speed = clamp_value(
      input->updated_heading_error * config->track_heading_gain,
      -input->runtime_angular_speed_limit,
      input->runtime_angular_speed_limit);

  double base_speed = clamp_value(
      input->distance_to_target * 1.18,
      config->track_min_linear_speed,
      input->runtime_linear_speed_limit);
  if (input->distance_to_target < config->track_slow_radius) {
    const double near_target_speed_cap = clamp_value(
        input->runtime_linear_speed_limit * 0.36, 0.14, 0.24);
    base_speed = clamp_value(
        input->distance_to_target * 1.05,
        config->track_min_linear_speed,
        near_target_speed_cap);
  }
  base_speed *= input->lidar_speed_scale;
  base_speed *= input->expected_wall_speed_scale;

  const int clear_fast_tracking =
      !input->lidar_caution_active && !input->expected_zone_wall_slowdown;
  double heading_scale = clear_fast_tracking
                             ? clamp_value(1.0 - fabs(input->updated_heading_error) / 1.15, 0.45, 1.0)
                             : clamp_value(1.0 - fabs(input->updated_heading_error) / 0.85, 0.22, 1.0);
  if (fabs(input->updated_heading_error) > config->turn_enter_error_rad) {
    heading_scale = fmin(heading_scale, clear_fast_tracking ? 0.62 : 0.35);
  }
  output->linear_speed = base_speed * heading_scale;
  if (input->distance_to_target <= config->position_tolerance * 1.4) {
    output->linear_speed = fmin(output->linear_speed, 0.05);
  }
  output->status = input->lidar_caution_active
                       ? CONTROLLER_NAVIGATION_STATUS_TRACK_LIDAR
                       : (input->expected_zone_wall_ahead
                              ? CONTROLLER_NAVIGATION_STATUS_TRACK_ZONE
                              : CONTROLLER_NAVIGATION_STATUS_TRACK_PATH);
}
