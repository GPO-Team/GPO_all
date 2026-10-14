#include "controller_navigation_tracking.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

static ControllerNavigationTrackingConfig config(void) {
  return ControllerNavigationTrackingConfig{
      .final_align_distance = 0.18,
      .heading_tolerance_rad = 0.08,
      .track_slow_radius = 0.22,
      .turn_exit_error_rad = 0.12,
      .track_reenter_turn_rad = 0.56,
      .turn_enter_error_rad = 0.42,
      .turn_heading_gain = 3.8,
      .track_heading_gain = 3.0,
      .final_align_gain = 3.4,
      .track_min_linear_speed = 0.045,
      .min_angular_command = 0.28,
      .position_tolerance = 0.05,
  };
}

int main(void) {
  const ControllerNavigationTrackingConfig tracking_config = config();
  ControllerNavigationTrackingOutput output;

  ControllerNavigationTrackingInput input = {
      .mode = NAV_MODE_IDLE,
      .distance_to_target = 1.0,
      .lidar_speed_scale = 1.0,
      .expected_wall_speed_scale = 1.0,
      .runtime_linear_speed_limit = 0.22,
      .runtime_angular_speed_limit = 1.6,
  };
  controller_navigation_tracking_compute(&tracking_config, &input, &output);
  if (output.mode != NAV_MODE_TRACK || output.action != CONTROLLER_NAVIGATION_TRACKING_DRIVE) return 1;
  if (!nearly_equal(output.linear_speed, 0.22) || !nearly_equal(output.angular_speed, 0.0)) return 2;

  input.mode = NAV_MODE_TURN;
  input.route_relaxed_mode = 0;
  input.distance_to_target = 1.0;
  input.updated_heading_error = 0.5;
  controller_navigation_tracking_compute(&tracking_config, &input, &output);
  if (output.action != CONTROLLER_NAVIGATION_TRACKING_TURN || output.mode != NAV_MODE_TURN) return 3;
  if (!nearly_equal(output.angular_speed, 1.6) || !nearly_equal(output.linear_speed, 0.0)) return 4;

  input = ControllerNavigationTrackingInput{
      .mode = NAV_MODE_TRACK,
      .is_final_waypoint = 1,
      .target_has_heading = 1,
      .target_heading = 1.0,
      .current_heading = 0.95,
      .distance_to_target = 0.04,
      .lidar_speed_scale = 1.0,
      .expected_wall_speed_scale = 1.0,
      .runtime_linear_speed_limit = 0.22,
      .runtime_angular_speed_limit = 1.6,
  };
  controller_navigation_tracking_compute(&tracking_config, &input, &output);
  if (output.mode != NAV_MODE_FINAL_ALIGN ||
      output.action != CONTROLLER_NAVIGATION_TRACKING_FINAL_ALIGN) return 5;
  if (!nearly_equal(output.linear_speed, 0.0) || !nearly_equal(output.angular_speed, 0.17)) return 6;

  input.mode = NAV_MODE_FINAL_ALIGN;
  input.distance_to_target = 0.17;
  input.current_heading = input.target_heading;
  controller_navigation_tracking_compute(&tracking_config, &input, &output);
  if (output.action == CONTROLLER_NAVIGATION_TRACKING_FINAL_ALIGN) return 7;
  if (output.linear_speed <= 0.0) return 8;
  return 0;
}
