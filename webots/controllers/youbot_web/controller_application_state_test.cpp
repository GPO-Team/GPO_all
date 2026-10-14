#include "controller_application_state.h"

#include <assert.h>
#include <string.h>

int main(void) {
  ControllerApplicationState state;
  controller_application_state_init(&state);

  assert(strcmp(state.status, "booting") == 0);
  assert(strcmp(state.error, "") == 0);
  assert(state.step_counter == 0);
  assert(!controller_application_state_route_off_route(&state));

  controller_application_state_set_status(&state, "tracking_route");
  controller_application_state_set_error(&state, "sensor unavailable");
  controller_application_state_tick_route_avoidance(&state, 1, 0.016);
  controller_application_state_tick_route_avoidance(&state, 1, 0.016);

  assert(strcmp(state.status, "tracking_route") == 0);
  assert(strcmp(state.error, "sensor unavailable") == 0);
  assert(controller_application_state_route_off_route(&state));
  assert(state.route_avoidance_steps == 2);
  assert(state.route_avoidance_time_sec > 0.031);

  controller_application_state_clear_error(&state);
  controller_application_state_reset_route_avoidance(&state);
  assert(strcmp(state.error, "") == 0);
  assert(!controller_application_state_route_off_route(&state));
  return 0;
}
