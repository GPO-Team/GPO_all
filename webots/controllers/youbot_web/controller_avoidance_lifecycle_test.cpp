#include "controller_avoidance_lifecycle.h"

int main(void) {
  const ControllerAvoidanceLifecycleConfig config = {
      .min_contour_steps = 18,
      .leave_progress = 0.16,
      .leave_heading_rad = 0.44,
      .avoid_stop_range = 0.31,
      .orbit_heading_rad = 6.75,
      .no_progress_steps = 60,
      .replan_steps = 140,
      .max_steps = 360,
      .loop_radius = 0.48,
      .free_space_recovery_steps = 10,
      .clear_steps = 12,
  };
  ControllerAvoidanceState state{};
  state.active = 1;
  state.turn_sign = -1.0;
  state.hold_steps = 0;
  state.contour_steps = 18;
  state.clear_steps = 12;
  state.no_obstacle_steps = 11;
  state.hit_target_distance = 2.0;
  state.start_x = 1.0;
  state.start_z = 2.0;
  const ControllerAvoidanceLifecycleInput input = {
      .mapping_survey = 1,
      .replan_cooldown_steps = 0,
      .x = 1.1,
      .z = 2.1,
      .target_distance = 1.7,
      .heading_error = 0.1,
      .near_front_range = 0.5,
      .center_obstacle_range = 0.5,
  };
  ControllerAvoidanceLifecycleDecision decision;
  controller_avoidance_lifecycle_evaluate(&state, &config, &input, &decision);
  if (!decision.can_rejoin_route || !decision.can_recover_free_space) return 1;
  if (decision.should_handle_mapping_loop) return 2;

  state.contour_steps = 150;
  state.no_progress_steps = 61;
  state.heading_accum_rad = 7.0;
  controller_avoidance_lifecycle_evaluate(&state, &config, &input, &decision);
  if (!decision.orbiting_same_object || !decision.should_handle_mapping_loop) return 3;

  state.hold_steps = 5;
  state.no_obstacle_steps = 7;
  controller_avoidance_lifecycle_finish(&state, 0.0, 0.0);
  if (state.active || state.mode != AVOID_MODE_NONE || state.detour_active) return 4;
  if (state.turn_sign != -1.0 || state.hold_steps != 5 || state.no_obstacle_steps != 7) return 5;
  if (state.start_x != 0.0 || state.start_z != 0.0) return 6;

  return 0;
}
