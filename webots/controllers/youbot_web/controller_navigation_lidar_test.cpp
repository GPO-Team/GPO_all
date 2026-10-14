#include "controller_navigation_lidar.h"

#include <cmath>

static int nearly_equal(double left, double right) {
  return fabs(left - right) < 1e-9;
}

static ControllerNavigationLidarConfig config(void) {
  return ControllerNavigationLidarConfig{
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
}

int main(void) {
  const ControllerNavigationLidarConfig lidar_config = config();
  ControllerNavigationLidarOutput output;
  ControllerNavigationLidarInput input = {
      .heading_error = 0.2,
      .current_priority_turn_sign = 1.0,
      .current_priority_hold_steps = 4,
  };
  controller_navigation_lidar_compute(&lidar_config, &input, &output);
  if (!nearly_equal(output.updated_heading_error, 0.2) ||
      !nearly_equal(output.speed_scale, 1.0) ||
      !nearly_equal(output.expected_wall_speed_scale, 1.0)) return 1;
  if (!nearly_equal(output.priority_turn_sign, 1.0) || output.priority_hold_steps != 4) return 2;

  input = ControllerNavigationLidarInput{
      .lidar_available = 1,
      .center_obstacle_range = 1.0,
      .near_front_range = 1.0,
      .left_lidar_context = 0.20,
      .right_lidar_context = 1.0,
      .heading_error = 0.0,
  };
  controller_navigation_lidar_compute(&lidar_config, &input, &output);
  if (!output.caution_active || !output.hard_priority) return 3;
  if (output.priority_turn_sign >= 0.0 || output.priority_hold_steps != 17) return 4;
  if (output.heading_bias >= 0.0 || output.speed_scale > 0.58) return 5;

  input = ControllerNavigationLidarInput{
      .lidar_available = 1,
      .center_passage_available = 1,
      .center_obstacle_range = 2.0,
      .near_front_range = 0.8,
      .left_lidar_context = 2.0,
      .right_lidar_context = 2.0,
      .best_gap_beam_angle = 0.2,
      .heading_error = 0.1,
      .current_priority_turn_sign = -1.0,
      .current_priority_hold_steps = 8,
  };
  controller_navigation_lidar_compute(&lidar_config, &input, &output);
  if (!nearly_equal(output.heading_bias, -0.164)) return 6;
  if (!nearly_equal(output.priority_turn_sign, 0.0) || output.priority_hold_steps != 0) return 7;

  return 0;
}
