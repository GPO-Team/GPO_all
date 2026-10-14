#include "controller_avoidance_start.h"

int main(void) {
  ControllerAvoidanceState state = {0};
  LidarObstacleContext lidar = {
      .unexpected_left_score = 0.2,
      .unexpected_right_score = 0.8,
  };
  ControllerAvoidanceDetection detection = {
      .left_front_corner_range = 2.0,
      .right_front_corner_range = 0.5,
      .left_obstacle_range = 2.0,
      .right_obstacle_range = 0.5,
      .should_start_avoidance = 1,
  };
  const ControllerAvoidanceStartConfig config = {
      .switch_margin = 0.1,
      .initial_hold_steps = 7,
      .priority_hold_steps = 9,
      .detour = {
          .forward_distance = 0.6,
          .max_distance = 1.2,
          .side_distance = 0.4,
      },
  };
  const ControllerAvoidanceStartInput input = {
      .lidar_context = &lidar,
      .detection = &detection,
      .x = 1.0,
      .z = 2.0,
      .heading = 0.0,
      .target_distance = 4.0,
      .priority_turn_sign = 0.0,
      .camera_turn_sign = 0.0,
      .heading_error = -0.2,
  };
  ControllerAvoidanceStartOutput output = {0};

  if (!controller_avoidance_start(
          &state, &input, &config, &output)) return 1;
  if (!state.active || state.mode != AVOID_MODE_FOLLOW_EDGE) return 2;
  if (state.turn_sign != 1.0 || state.obstacle_side != -1) return 3;
  if (state.hold_steps != 7 || !state.detour_active) return 4;
  if (output.priority_turn_sign != 1.0 ||
      output.priority_hold_steps != 9) return 5;

  ControllerAvoidanceState unchanged = {0};
  detection.should_start_avoidance = 0;
  if (controller_avoidance_start(
          &unchanged, &input, &config, &output)) return 6;
  if (unchanged.active) return 7;

  unchanged.active = 1;
  detection.should_start_avoidance = 1;
  if (controller_avoidance_start(
          &unchanged, &input, &config, &output)) return 8;

  return 0;
}
