#include "controller_webots_motion_state.h"

void controller_webots_motion_state_apply(ControllerWebotsMotionState *state) {
  if (!state) return;
  controller_motion_profile_apply(&state->profile, &state->limits);
}

int controller_webots_motion_state_load(
    ControllerWebotsMotionState *state, const char *path) {
  if (!state || !controller_motion_profile_load_file(path, &state->profile)) return 0;
  controller_webots_motion_state_apply(state);
  return 1;
}
