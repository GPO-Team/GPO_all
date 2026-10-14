#include "controller_navigation_motion_service.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

int main(void) {
  const ControllerNavigationTrackingConfig tracking_config = {
      .final_align_distance = 0.18,
      .heading_tolerance_rad = 0.08,
      .track_slow_radius = 0.22,
      .turn_exit_error_rad = 0.12,
      .track_reenter_turn_rad = 0.56,
      .turn_enter_error_rad = 0.42,
      .turn_heading_gain = 3.8,
      .track_heading_gain = 3.0,
      .track_min_linear_speed = 0.045,
      .min_angular_command = 0.28,
      .position_tolerance = 0.05,
  };
  const ControllerNavigationLidarConfig lidar_config = {
      .track_caution_range = 1.45,
      .avoid_stop_range = 0.31,
      .track_side_bias_range = 0.66,
      .avoid_side_danger_range = 0.15,
      .track_hard_priority_range = 1.24,
      .avoid_side_trigger_range = 0.36,
      .max_heading_bias = 0.40,
      .priority_switch_margin = 0.18,
      .priority_center_margin = 0.08,
      .priority_hold_steps = 18,
      .expected_wall_soft_stop_range = 0.24,
      .expected_wall_slowdown_range = 0.46,
  };
  const ControllerNavigationMotionServiceInput input = {
      .tracking = {
          .mode = NAV_MODE_IDLE,
          .distance_to_target = 1.0,
          .heading_error_to_target = 0.2,
          .updated_heading_error = 0.2,
          .route_relaxed_mode = 1,
          .lidar_speed_scale = 1.0,
          .expected_wall_speed_scale = 1.0,
          .runtime_linear_speed_limit = 0.22,
          .runtime_angular_speed_limit = 1.6,
      },
      .lidar = {
          .heading_error = 0.2,
          .current_priority_turn_sign = 1.0,
          .current_priority_hold_steps = 4,
      },
  };
  ControllerNavigationMotionServiceOutput output{};
  if (controller_navigation_motion_service_compute(
          &tracking_config, &lidar_config, &input, &output)) return 1;
  if (output.tracking.mode != NAV_MODE_TRACK ||
      output.tracking.linear_speed <= 0.0 ||
      output.tracking.linear_speed > 0.22) return 2;
  if (!nearly_equal(output.lidar.priority_turn_sign, 1.0) ||
      output.lidar.priority_hold_steps != 4) return 3;

  ControllerNavigationMotionServiceInput align_input = input;
  align_input.tracking = ControllerNavigationTrackingInput{
      .mode = NAV_MODE_TRACK,
      .is_final_waypoint = 1,
      .target_has_heading = 1,
      .target_heading = 1.0,
      .current_heading = 0.8,
      .distance_to_target = 0.04,
      .lidar_speed_scale = 1.0,
      .expected_wall_speed_scale = 1.0,
      .runtime_linear_speed_limit = 0.22,
      .runtime_angular_speed_limit = 1.6,
  };
  if (!controller_navigation_motion_service_compute(
          &tracking_config, &lidar_config, &align_input, &output)) return 4;
  if (output.tracking.action != CONTROLLER_NAVIGATION_TRACKING_FINAL_ALIGN) return 5;

  return 0;
}
