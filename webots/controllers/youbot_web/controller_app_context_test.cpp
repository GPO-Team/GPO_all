#include "controller_app_context.h"

#include <assert.h>
#include <string.h>

int main(void) {
  ControllerAppContext context;
  memset(&context, 0xA5, sizeof(context));

  controller_app_context_init(&context);

  assert(context.application_state.step_counter == 0);
  assert(context.motion_state.profile.cruise_speed_mps == 0.22);
  assert(context.motion_state.profile.payload_kg == 0.0);
  assert(context.motion_state.profile.battery_range_units == 100.0);
  assert(context.motion_state.limits.linear_speed_mps == 0.22);
  assert(context.motion_state.limits.angular_speed_rad_s == 1.6);
  assert(context.motion_state.limits.battery_speed_factor == 1.0);
  assert(context.mapping_runtime.store.persistent_count == 0);
  assert(context.perception_runtime.trace_count == 0);
  return 0;
}
