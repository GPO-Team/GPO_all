#include "controller_avoidance_lifecycle.h"

#include <cmath>
#include <string.h>

void controller_avoidance_lifecycle_evaluate(
    const ControllerAvoidanceState *state,
    const ControllerAvoidanceLifecycleConfig *config,
    const ControllerAvoidanceLifecycleInput *input,
    ControllerAvoidanceLifecycleDecision *decision) {
  if (!state || !config || !input || !decision) return;
  memset(decision, 0, sizeof(*decision));

  const double free_corridor_needed =
      fmin(input->target_distance + 0.16, config->avoid_stop_range + 0.60);

  const double rejoin_heading_limit =
      input->mapping_survey ? config->leave_heading_rad : 0.85;

  const int target_line_clear =
      fabs(input->heading_error) < rejoin_heading_limit &&
      input->near_front_range > free_corridor_needed &&
      input->center_obstacle_range > free_corridor_needed + 0.08;

  const int required_contour_steps =
      input->mapping_survey ? config->min_contour_steps : 12;

  const int corner_cleared =
      state->clear_steps >= (input->mapping_survey ? config->clear_steps : 5) &&
      state->no_obstacle_steps >= (input->mapping_survey ? config->free_space_recovery_steps / 2 : 3);

  decision->can_rejoin_route =
      state->hold_steps <= 0 &&
      state->contour_steps >= required_contour_steps &&
      corner_cleared &&
      target_line_clear &&
      (!input->mapping_survey ||
       state->hit_target_distance - input->target_distance > config->leave_progress);

  decision->orbiting_same_object =
      state->heading_accum_rad > config->orbit_heading_rad &&
      state->no_progress_steps > config->no_progress_steps;

  if (input->mapping_survey) {
    const int should_consider_replan =
        input->replan_cooldown_steps <= 0 &&
        (state->contour_steps > config->replan_steps || decision->orbiting_same_object);

    if (should_consider_replan) {
      const double dx = input->x - state->start_x;
      const double dz = input->z - state->start_z;
      const double distance_from_start = sqrt(dx * dx + dz * dz);
      const int looped_near_entry =
          distance_from_start < config->loop_radius &&
          state->no_progress_steps > config->no_progress_steps / 2;
      const int lost_progress = state->no_progress_steps > config->no_progress_steps;
      const int timed_out = state->contour_steps > config->max_steps;
      decision->should_handle_mapping_loop =
          looped_near_entry || lost_progress || timed_out || decision->orbiting_same_object;
    }
  } else {
    decision->should_handle_mapping_loop = 0;
  }

  const int safe_free_space_heading =
      fabs(input->heading_error) < rejoin_heading_limit * 1.15 ||
      state->no_obstacle_steps > config->free_space_recovery_steps * 2;

  decision->can_recover_free_space =
      state->no_obstacle_steps > config->free_space_recovery_steps &&
      state->hold_steps <= 0 &&
      state->clear_steps >= (input->mapping_survey ? config->clear_steps : 5) &&
      state->contour_steps >= required_contour_steps &&
      input->near_front_range > free_corridor_needed &&
      input->center_obstacle_range > free_corridor_needed + 0.08 &&
      safe_free_space_heading;
}

void controller_avoidance_lifecycle_finish(
    ControllerAvoidanceState *state, double start_x, double start_z) {
  if (!state) return;
  state->active = 0;
  state->mode = AVOID_MODE_NONE;
  state->obstacle_side = 0;
  state->release_steps = 0;
  state->contour_steps = 0;
  state->clear_steps = 0;
  state->escape_steps = 0;
  state->stuck_steps = 0;
  state->hit_target_distance = 0.0;
  state->state_heading = 0.0;
  state->start_x = start_x;
  state->start_z = start_z;
  state->best_target_distance = 0.0;
  state->no_progress_steps = 0;
  state->prev_heading = 0.0;
  state->heading_accum_rad = 0.0;
  state->detour_active = 0;
  state->detour_x = start_x;
  state->detour_z = start_z;
}