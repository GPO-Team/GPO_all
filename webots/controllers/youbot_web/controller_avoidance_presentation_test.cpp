#include "controller_avoidance_presentation.h"

#include <string.h>

int main(void) {
  ControllerAvoidanceState state{};
  state.detour_active = 1;
  state.hold_steps = 4;
  state.stuck_steps = 6;
  state.turn_sign = 1.0;
  state.obstacle_side = -1;
  ControllerAvoidanceCommand command = {
      .mode = CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN,
      .turn_sign = -1.0,
      .turn_sign_changed = 1,
      .clear_detour = 1,
      .clear_hold = 1,
      .reset_stuck = 1,
  };
  ControllerAvoidancePresentationOutput output = {0};
  controller_avoidance_presentation_apply(
      &state, &command, 9, 7, 1, &output);
  if (state.detour_active || state.hold_steps != 7 || state.stuck_steps != 0) return 1;
  if (state.turn_sign != -1.0 || state.obstacle_side != 1) return 2;
  if (output.priority_turn_sign != -1.0 || output.priority_hold_steps != 9) return 3;
  if (strcmp(output.status, "avoiding_gap_turn") != 0) return 4;

  command = ControllerAvoidanceCommand{
      .mode = CONTROLLER_AVOIDANCE_COMMAND_PASS_GAP,
  };
  controller_avoidance_presentation_apply(
      &state, &command, 9, 7, 0, &output);
  if (strcmp(output.status, "passing_lidar_gap") != 0) return 5;

  command.mode = CONTROLLER_AVOIDANCE_COMMAND_HARD_TURN;
  controller_avoidance_presentation_apply(
      &state, &command, 9, 7, 0, &output);
  if (strcmp(output.status, "avoiding_committed_turn") != 0) return 6;

  command.mode = CONTROLLER_AVOIDANCE_COMMAND_GAP_DRIVE;
  controller_avoidance_presentation_apply(
      &state, &command, 9, 7, 0, &output);
  if (strcmp(output.status, "avoiding_gap_drive") != 0) return 7;

  command.mode = CONTROLLER_AVOIDANCE_COMMAND_COMMITTED_DRIVE;
  controller_avoidance_presentation_apply(
      &state, &command, 9, 7, 0, &output);
  if (strcmp(output.status, "avoiding_committed_drive") != 0) return 8;

  command.mode = CONTROLLER_AVOIDANCE_COMMAND_ESCAPE;
  controller_avoidance_presentation_apply(
      &state, &command, 9, 7, 0, &output);
  if (strcmp(output.status, "avoiding_committed_escape") != 0) return 9;

  return 0;
}
