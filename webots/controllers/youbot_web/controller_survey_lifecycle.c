#include "controller_survey_lifecycle.h"
#include <string.h>

void controller_survey_lifecycle_accept_route(
    RouteData *active_route,
    const RouteData *loaded_route,
    int *current_waypoint_index,
    int *route_finished,
    ControllerMappingSurveyState *state,
    int mapping_survey_route,
    MappingSurveyMode mode) {
  if (!active_route || !loaded_route || !current_waypoint_index ||
      !route_finished || !state) {
    return;
  }
  *active_route = *loaded_route;
  *current_waypoint_index = 0;
  *route_finished = 0;
  if (mapping_survey_route) {
    controller_mapping_survey_state_activate_route(state, mode);
  } else {
    controller_mapping_survey_state_reset_route(state);
  }
}

int controller_survey_lifecycle_start(
    const RuntimeCommand *command,
    RouteData *active_route,
    int *current_waypoint_index,
    int *route_finished,
    ControllerMappingSurveyState *state,
    const ControllerSurveyStartCallbacks *callbacks,
    void *context) {
  if (!command || !active_route || !current_waypoint_index || !route_finished ||
      !state || !callbacks || !callbacks->clear_error || !callbacks->apply_speed ||
      !callbacks->generate || !callbacks->load_route || !callbacks->reset_avoidance ||
      !callbacks->reset_navigation || !callbacks->mark_started) {
    return 0;
  }
  callbacks->clear_error(context);
  if (command->survey_speed_mps > 0.0) {
    callbacks->apply_speed(context, command->survey_speed_mps);
  }
  if (!callbacks->generate(context, command)) return 0;

  RouteData loaded_route = {0};
  if (!callbacks->load_route(context, &loaded_route)) return 0;
  strcpy(loaded_route.command_id, command->mission_id);
  controller_survey_lifecycle_accept_route(
      active_route,
      &loaded_route,
      current_waypoint_index,
      route_finished,
      state,
      1,
      command->survey_mode);
  callbacks->reset_avoidance(context);
  callbacks->reset_navigation(context);
  callbacks->mark_started(context);
  return 1;
}

int controller_survey_lifecycle_replan(
    SurveyPoint robot,
    RouteData *active_route,
    int *current_waypoint_index,
    int *route_finished,
    ControllerMappingSurveyState *state,
    int cooldown_steps,
    const ControllerSurveyReplanCallbacks *callbacks,
    void *context) {
  if (!active_route || !current_waypoint_index || !route_finished || !state ||
      !callbacks || !callbacks->merge_map || !callbacks->generate ||
      !callbacks->load_route || !callbacks->find_escape ||
      !callbacks->reset_navigation || !callbacks->clear_error ||
      !callbacks->mark_replanned || !state->route_active) {
    return 0;
  }

  callbacks->merge_map(context);
  if (!callbacks->generate(context)) {
    state->replan_cooldown_steps = cooldown_steps;
    return 0;
  }
  RouteData loaded_route = {0};
  if (!callbacks->load_route(context, &loaded_route)) {
    state->replan_cooldown_steps = cooldown_steps;
    return 0;
  }

  strcpy(loaded_route.command_id, active_route->command_id);
  *active_route = loaded_route;
  const int escape_index = callbacks->find_escape(context, robot, 0);
  *current_waypoint_index = escape_index >= 0 ? escape_index : 0;
  *route_finished = 0;
  controller_mapping_survey_state_activate_route(state, state->mode);
  callbacks->reset_navigation(context);
  state->replan_cooldown_steps = cooldown_steps;
  callbacks->clear_error(context);
  callbacks->mark_replanned(context);
  return 1;
}

int controller_survey_lifecycle_escape_orbit(
    SurveyPoint robot,
    int route_count,
    int *current_waypoint_index,
    ControllerMappingSurveyState *state,
    int cooldown_steps,
    const ControllerSurveyOrbitCallbacks *callbacks,
    void *context) {
  if (!current_waypoint_index || !state || !state->route_active || !callbacks ||
      !callbacks->merge_map || !callbacks->find_escape ||
      !callbacks->clear_navigation || !callbacks->begin_navigation ||
      !callbacks->update_distance || !callbacks->clear_error ||
      !callbacks->mark_skipped || !callbacks->replan) {
    return 0;
  }

  callbacks->merge_map(context);
  int escape_index = callbacks->find_escape(context, robot, *current_waypoint_index);
  if (escape_index < 0 && *current_waypoint_index + 1 < route_count) {
    escape_index = callbacks->find_escape(context, robot, *current_waypoint_index + 1);
  }
  if (escape_index < 0) return callbacks->replan(context);

  *current_waypoint_index = escape_index;
  callbacks->clear_navigation(context);
  callbacks->begin_navigation(context, escape_index, robot);
  state->replan_cooldown_steps = cooldown_steps;
  callbacks->update_distance(context, escape_index, robot);
  callbacks->clear_error(context);
  callbacks->mark_skipped(context);
  return 1;
}
