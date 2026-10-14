#include "controller_application_state.h"

#include <stdio.h>
#include <string.h>

void controller_application_state_init(ControllerApplicationState *state) {
  memset(state, 0, sizeof(*state));
  snprintf(state->status, sizeof(state->status), "%s", "booting");
}

void controller_application_state_set_status(ControllerApplicationState *state, const char *status) {
  snprintf(state->status, sizeof(state->status), "%s", status ? status : "");
}

void controller_application_state_set_error(ControllerApplicationState *state, const char *error) {
  snprintf(state->error, sizeof(state->error), "%s", error ? error : "");
}

void controller_application_state_clear_error(ControllerApplicationState *state) {
  controller_application_state_set_error(state, "");
}

void controller_application_state_reset_route_avoidance(ControllerApplicationState *state) {
  state->route_avoidance_time_sec = 0.0;
  state->route_avoidance_steps = 0;
}

void controller_application_state_tick_route_avoidance(
    ControllerApplicationState *state,
    int avoidance_active,
    double elapsed_seconds) {
  if (!avoidance_active) return;
  state->route_avoidance_time_sec += elapsed_seconds;
  ++state->route_avoidance_steps;
}

int controller_application_state_route_off_route(const ControllerApplicationState *state) {
  return state->route_avoidance_steps > 0;
}
