#include "controller_avoidance_state.h"
#include "controller_math.h"

#include <cmath>
#include <string.h>

static double s_signed_heading_accum = 0.0;

void controller_avoidance_state_reset(
    ControllerAvoidanceState *state,
    double start_x,
    double start_z) {
  if (!state) return;
  s_signed_heading_accum = 0.0;
  memset(state, 0, sizeof(*state));
  state->mode = AVOID_MODE_NONE;
  state->turn_sign = 1.0;
  state->prev_x = start_x;
  state->prev_z = start_z;
  state->start_x = start_x;
  state->start_z = start_z;
  state->detour_x = start_x;
  state->detour_z = start_z;
}

void controller_avoidance_state_begin(
    ControllerAvoidanceState *state,
    double x, double z, double heading,
    double target_distance, double turn_sign, int hold_steps) {
  if (!state) return;
  s_signed_heading_accum = 0.0;
  state->active = 1;
  state->mode = AVOID_MODE_FACE_CLEAR;
  state->hold_steps = hold_steps;
  state->turn_sign = turn_sign >= 0.0 ? 1.0 : -1.0;
  state->obstacle_side = state->turn_sign > 0.0 ? -1 : 1;
  state->release_steps = 0;
  state->contour_steps = 0;
  state->clear_steps = 0;
  state->escape_steps = 0;
  state->stuck_steps = 0;
  state->no_obstacle_steps = 0;
  state->prev_x = x;
  state->prev_z = z;
  state->prev_target_distance = target_distance;
  state->hit_target_distance = target_distance;
  state->state_heading = heading;
  state->start_x = x;
  state->start_z = z;
  state->best_target_distance = target_distance;
  state->no_progress_steps = 0;
  state->prev_heading = heading;
  state->heading_accum_rad = 0.0;
}

void controller_avoidance_set_detour(
    ControllerAvoidanceState *state,
    double x, double z, double heading,
    const LidarObstacleContext *context,
    double turn_sign,
    const ControllerAvoidanceDetourConfig *config) {
  if (!state || !config) return;
  double detour_heading = heading + turn_sign * 0.92;
  double detour_distance = config->forward_distance;

  if (context && context->has_best_gap) {
    detour_heading = heading - context->best_gap_beam_angle;
    detour_distance = clamp_value(
        context->best_gap_range * 0.72,
        config->forward_distance,
        config->max_distance);
  }

  const double side_x = -sin(heading) * turn_sign;
  const double side_z = cos(heading) * turn_sign;
  state->detour_x =
      x + cos(detour_heading) * detour_distance + side_x * config->side_distance * 0.28;
  state->detour_z =
      z + sin(detour_heading) * detour_distance + side_z * config->side_distance * 0.28;
  state->detour_active = 1;
}

void controller_avoidance_update_progress(
    ControllerAvoidanceState *state,
    const ControllerAvoidanceProgressInput *input,
    const ControllerAvoidanceProgressConfig *config) {
  if (!state || !input || !config) return;
  const double moved_since_last = hypot(
      input->x - state->prev_x,
      input->z - state->prev_z);
  const double signed_heading_delta = wrap_angle(input->heading - state->prev_heading);
  const double heading_delta = fabs(signed_heading_delta);

  state->contour_steps += 1;
  if (state->hold_steps > 0) state->hold_steps -= 1;
  s_signed_heading_accum += signed_heading_delta;
  state->heading_accum_rad = fabs(s_signed_heading_accum);
  state->prev_heading = input->heading;

  if (moved_since_last < config->stuck_pose_epsilon * 1.5 &&
      heading_delta < 0.015) {
    state->stuck_steps += 1;
  } else if (moved_since_last > config->stuck_pose_epsilon * 4.0) {
    state->stuck_steps = 0;
  } else if (state->stuck_steps > 0) {
    state->stuck_steps -= 1;
  }

  state->prev_x = input->x;
  state->prev_z = input->z;
  state->prev_target_distance = input->target_distance;

  if (input->target_distance < state->best_target_distance - config->best_progress_epsilon) {
    state->best_target_distance = input->target_distance;
    state->no_progress_steps = 0;
  } else if (state->contour_steps > config->min_contour_steps &&
             moved_since_last < config->stuck_pose_epsilon * 2.5) {
    state->no_progress_steps += 1;
  }

  if (!input->obstacle_context_present) {
    state->no_obstacle_steps += 1;
    state->clear_steps += 1;
    state->mode = AVOID_MODE_SEARCH_EDGE;
  } else {
    state->no_obstacle_steps = 0;
    state->clear_steps = 0;
    state->mode = state->contour_steps < config->min_contour_steps / 2
                      ? AVOID_MODE_FACE_CLEAR
                      : AVOID_MODE_FOLLOW_EDGE;
  }

  if (state->detour_active &&
      (input->detour_distance < config->detour_reached_distance ||
       state->contour_steps >= config->min_contour_steps ||
       state->clear_steps >= 4)) {
    state->detour_active = 0;
  }
}