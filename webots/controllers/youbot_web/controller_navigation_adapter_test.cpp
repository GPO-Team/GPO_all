#include "controller_navigation_adapter.h"

#include <assert.h>

int main(void) {
  ControllerRuntimeNavigationResult result = {.action = CONTROLLER_RUNTIME_ACTION_WAIT_FOR_ROUTE};
  ControllerNavigationAdapterEffect effect;
  assert(controller_navigation_adapter_terminal_effect(&result, &effect));
  assert(effect.stop && effect.reset_navigation && effect.clear_route_finished);
  assert(effect.distance_to_target == 0.0);
  result.action = CONTROLLER_RUNTIME_ACTION_RELOCALIZE;
  result.navigation.session.session.segment_start_x = 3.0;
  result.navigation.session.session.segment_start_z = 4.0;
  result.navigation.session.session.distance_to_target = 5.0;
  assert(controller_navigation_adapter_terminal_effect(&result, &effect));
  assert(effect.relocalize && effect.segment_start_x == 3.0 && effect.distance_to_target == 5.0);
  return 0;
}
