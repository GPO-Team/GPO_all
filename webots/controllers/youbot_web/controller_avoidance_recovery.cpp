#include "controller_avoidance_recovery.h"

#include <string.h>

void controller_avoidance_recovery_resolve(
    const ControllerAvoidanceLifecycleDecision *decision,
    int has_next_waypoint,
    ControllerAvoidanceRecoveryOutput *output) {
  if (!output) return;
  memset(output, 0, sizeof(*output));
  if (!decision) return;
  output->rejoin_route = decision->can_rejoin_route;
  output->attempt_orbit_escape = decision->should_handle_mapping_loop;
  output->reacquire_free_space = decision->can_recover_free_space;
  (void)has_next_waypoint;
}

ControllerAvoidanceRecoveryAfterOrbit controller_avoidance_recovery_after_orbit(
    int orbit_escape_succeeded,
    int has_next_waypoint) {
  if (orbit_escape_succeeded)
    return CONTROLLER_AVOIDANCE_RECOVERY_STOP_AFTER_ESCAPE;
  return has_next_waypoint
             ? CONTROLLER_AVOIDANCE_RECOVERY_SKIP_LOOPED_WAYPOINT
             : CONTROLLER_AVOIDANCE_RECOVERY_CONTINUE;
}
