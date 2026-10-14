#include "controller_avoidance_service.h"

int main(void) {
  ControllerAvoidanceState state = {0};
  state.active = 1;
  state.turn_sign = 1.0;
  state.prev_target_distance = 1.0;
  state.best_target_distance = 1.0;
  const LidarObstacleContext context = {0};
  const ControllerAvoidanceDetection detection = {
      .front_obstacle_range = 2.0,
      .center_obstacle_range = 2.0,
      .left_lidar_context = 2.0,
      .right_lidar_context = 2.0,
  };
  const ControllerAvoidanceProgressConfig progress_config = {0.01, 0.01, 0.05, 3, 0.2};
  const ControllerAvoidanceLifecycleConfig lifecycle_config = {0};
  const ControllerAvoidanceCommandConfig command_config = {
      .avoid_recover_range = 1.1, .avoid_stop_range = 0.4, .avoid_reverse_range = 0.25,
      .gap_min_range = 0.8, .track_caution_range = 1.2, .track_side_bias_range = 0.9,
      .pass_side_danger_range = 0.5, .pass_center_clear_range = 0.9,
      .pass_cruise_speed_factor = 0.8, .pass_steer_gain = 1.4,
      .min_angular_command = 0.12, .gap_switch_range_bonus = 0.4, .stuck_steps_limit = 20,
  };
  const ControllerAvoidanceServiceInput input = {
      .progress_config = &progress_config,
      .progress_input = {0.1, 0.0, 0.0, 0.9, 1, 1.0},
      .lifecycle_config = &lifecycle_config,
      .lifecycle_input = {.target_distance = 0.9, .near_front_range = 2.0, .center_obstacle_range = 2.0},
      .command_config = &command_config,
      .command_input = {.context = &context, .detection = &detection,
                        .runtime_linear_speed_limit = 0.3, .runtime_angular_speed_limit = 1.0,
                        .pass_min_speed = 0.08, .pass_max_speed = 0.22,
                        .avoid_min_speed = 0.07, .avoid_max_speed = 0.18, .reverse_speed = 0.05},
  };
  ControllerAvoidanceServiceOutput output = {0};
  if (!controller_avoidance_service_process_active(&state, &input, &output)) return 1;
  if (!output.has_command || state.contour_steps != 1) return 2;
  return 0;
}
