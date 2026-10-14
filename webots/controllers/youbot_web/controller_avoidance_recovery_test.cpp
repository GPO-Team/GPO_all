#include "controller_avoidance_recovery.h"

int main(void) {
  ControllerAvoidanceLifecycleDecision decision = {0};
  ControllerAvoidanceRecoveryOutput output = {0};

  decision.can_rejoin_route = 1;
  decision.can_recover_free_space = 1;
  controller_avoidance_recovery_resolve(&decision, 1, &output);
  if (!output.rejoin_route || !output.reacquire_free_space ||
      output.attempt_orbit_escape) return 1;

  decision = ControllerAvoidanceLifecycleDecision{0};
  decision.should_handle_mapping_loop = 1;
  controller_avoidance_recovery_resolve(&decision, 1, &output);
  if (!output.attempt_orbit_escape || output.rejoin_route ||
      output.reacquire_free_space) return 2;

  if (controller_avoidance_recovery_after_orbit(1, 1) !=
      CONTROLLER_AVOIDANCE_RECOVERY_STOP_AFTER_ESCAPE) return 3;
  if (controller_avoidance_recovery_after_orbit(0, 1) !=
      CONTROLLER_AVOIDANCE_RECOVERY_SKIP_LOOPED_WAYPOINT) return 4;
  if (controller_avoidance_recovery_after_orbit(0, 0) !=
      CONTROLLER_AVOIDANCE_RECOVERY_CONTINUE) return 5;

  return 0;
}
