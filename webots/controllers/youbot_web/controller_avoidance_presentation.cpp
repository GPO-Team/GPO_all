#include "controller_avoidance_presentation.h"

static const char *command_status(
    ControllerAvoidanceCommandMode mode,
    int has_best_gap) {
  if (mode == CONTROLLER_AVOIDANCE_COMMAND_PASS_GAP)
    return "passing_lidar_gap";
  if (mode == CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN)
    return has_best_gap ? "avoiding_gap_turn" : "avoiding_committed_turn";
  if (mode == CONTROLLER_AVOIDANCE_COMMAND_GAP_DRIVE)
    return "avoiding_gap_drive";
  if (mode == CONTROLLER_AVOIDANCE_COMMAND_COMMITTED_DRIVE)
    return "avoiding_committed_drive";
  return "avoiding_committed_escape";
}

void controller_avoidance_presentation_apply(
    ControllerAvoidanceState *state,
    const ControllerAvoidanceCommand *command,
    int priority_hold_steps,
    int avoidance_hold_steps,
    int has_best_gap,
    ControllerAvoidancePresentationOutput *output) {
  if (!state || !command || !output) return;
  output->priority_updated = 0;
  output->status = command_status(command->mode, has_best_gap);
  if (command->clear_detour) state->detour_active = 0;
  if (command->clear_hold) state->hold_steps = 0;
  if (command->turn_sign_changed) {
    state->turn_sign = command->turn_sign;
    state->obstacle_side = state->turn_sign > 0.0 ? -1 : 1;
    output->priority_updated = 1;
    output->priority_turn_sign = state->turn_sign;
    output->priority_hold_steps = priority_hold_steps;
  }
  if (command->reset_stuck) {
    state->hold_steps = avoidance_hold_steps;
    state->stuck_steps = 0;
  }
}
