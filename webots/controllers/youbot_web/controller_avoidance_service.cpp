#include "controller_avoidance_service.h"

#include <string.h>

int controller_avoidance_service_process_active(
    ControllerAvoidanceState *state,
    const ControllerAvoidanceServiceInput *input,
    ControllerAvoidanceServiceOutput *output) {
  if (!state || !state->active || !input || !output || !input->progress_config ||
      !input->lifecycle_config || !input->command_config) return 0;
  memset(output, 0, sizeof(*output));

  controller_avoidance_update_progress(
      state, &input->progress_input, input->progress_config);
  ControllerAvoidanceLifecycleDecision lifecycle_decision;
  controller_avoidance_lifecycle_evaluate(
      state, input->lifecycle_config, &input->lifecycle_input, &lifecycle_decision);
  controller_avoidance_recovery_resolve(
      &lifecycle_decision,
      input->has_next_waypoint,
      &output->recovery);

  if (!state->active) return 1;
  ControllerAvoidanceCommandInput command_input = input->command_input;
  command_input.turn_sign = state->turn_sign;
  command_input.stuck_steps = state->stuck_steps;
  command_input.detour_active = state->detour_active;
  controller_avoidance_compute_command(
      &command_input, input->command_config, &output->command);
  controller_avoidance_presentation_apply(
      state,
      &output->command,
      input->priority_hold_steps,
      input->avoidance_hold_steps,
      input->has_best_gap,
      &output->presentation);
  output->has_command = 1;
  return 1;
}
