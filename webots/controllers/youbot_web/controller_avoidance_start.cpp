#include "controller_avoidance_start.h"

#include <cmath>

int controller_avoidance_start(
    ControllerAvoidanceState *state,
    const ControllerAvoidanceStartInput *input,
    const ControllerAvoidanceStartConfig *config,
    ControllerAvoidanceStartOutput *output) {
  if (!state || !input || !input->lidar_context || !input->detection ||
      !config || !output || state->active ||
      !input->detection->should_start_avoidance) {
    return 0;
  }

  const ControllerAvoidanceTurnInput turn_input = {
      .left_score = input->lidar_context->unexpected_left_score,
      .right_score = input->lidar_context->unexpected_right_score,
      .left_clearance = fmax(
          input->detection->left_obstacle_range,
          input->detection->left_front_corner_range),
      .right_clearance = fmax(
          input->detection->right_obstacle_range,
          input->detection->right_front_corner_range),
      .switch_margin = config->switch_margin,
      .priority_turn_sign = input->priority_turn_sign,
      .camera_turn_sign = input->camera_turn_sign,
      .heading_error = input->heading_error,
  };
  const double turn_sign = controller_avoidance_choose_turn_sign(&turn_input);
  controller_avoidance_state_begin(
      state,
      input->x,
      input->z,
      input->heading,
      input->target_distance,
      turn_sign,
      config->initial_hold_steps);
  controller_avoidance_set_detour(
      state,
      input->x,
      input->z,
      input->heading,
      input->lidar_context,
      state->turn_sign,
      &config->detour);
  output->priority_turn_sign = state->turn_sign;
  output->priority_hold_steps = config->priority_hold_steps;
  return 1;
}
