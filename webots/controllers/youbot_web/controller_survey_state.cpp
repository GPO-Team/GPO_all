#include "controller_survey_state.h"

#include <stddef.h>

void controller_mapping_survey_state_init(ControllerMappingSurveyState *state) {
  if (!state) return;
  *state = ControllerMappingSurveyState{
      .room_zone_index = -1,
      .mode = MAPPING_SURVEY_MODE_SNAKE,
      .obstacle_scan_end_index = -1,
      .last_scan_x = 1e30,
      .last_scan_y = 1e30,
  };
}

void controller_mapping_survey_state_reset_route(ControllerMappingSurveyState *state) {
  if (!state) return;
  state->route_active = 0;
  state->room_zone_index = -1;
  state->interior_start_index = 0;
  state->obstacle_scan_active = 0;
  state->obstacle_scan_end_index = -1;
  state->obstacle_scan_cooldown_steps = 0;
}

void controller_mapping_survey_state_activate_route(
    ControllerMappingSurveyState *state, MappingSurveyMode mode) {
  if (!state) return;
  state->route_active = 1;
  state->mode = mode;
}

void controller_mapping_survey_state_prepare(
    ControllerMappingSurveyState *state, MappingSurveyMode mode) {
  if (!state) return;
  state->mode = mode;
  state->interior_start_index = 0;
  state->obstacle_scan_active = 0;
  state->obstacle_scan_end_index = -1;
  state->obstacle_scan_cooldown_steps = 0;
  state->last_scan_x = 1e30;
  state->last_scan_y = 1e30;
}

void controller_mapping_survey_state_tick(ControllerMappingSurveyState *state) {
  if (!state) return;
  if (state->obstacle_scan_cooldown_steps > 0) state->obstacle_scan_cooldown_steps -= 1;
  if (state->replan_cooldown_steps > 0) state->replan_cooldown_steps -= 1;
}

void controller_mapping_survey_state_begin_scan(
    ControllerMappingSurveyState *state, int end_index, double obstacle_x, double obstacle_y) {
  if (!state) return;
  state->obstacle_scan_active = 1;
  state->obstacle_scan_end_index = end_index;
  state->last_scan_x = obstacle_x;
  state->last_scan_y = obstacle_y;
}

int controller_mapping_survey_state_complete_scan(
    ControllerMappingSurveyState *state, int current_waypoint_index, int cooldown_steps) {
  if (!state || !state->obstacle_scan_active ||
      current_waypoint_index <= state->obstacle_scan_end_index) {
    return 0;
  }
  state->obstacle_scan_active = 0;
  state->obstacle_scan_end_index = -1;
  state->obstacle_scan_cooldown_steps = cooldown_steps;
  return 1;
}
