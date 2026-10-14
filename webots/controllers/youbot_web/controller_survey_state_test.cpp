#include "controller_survey_state.h"

#include <cmath>

int main(void) {
  ControllerMappingSurveyState state;
  controller_mapping_survey_state_init(&state);
  if (state.route_active || state.room_zone_index != -1 || state.mode != MAPPING_SURVEY_MODE_SNAKE ||
      state.interior_start_index != 0 || state.obstacle_scan_active ||
      state.obstacle_scan_end_index != -1 || state.obstacle_scan_cooldown_steps != 0 ||
      state.replan_cooldown_steps != 0 || state.last_scan_x != 1e30 || state.last_scan_y != 1e30) {
    return 1;
  }

  state.room_zone_index = 4;
  state.interior_start_index = 12;
  state.replan_cooldown_steps = 8;
  controller_mapping_survey_state_prepare(&state, MAPPING_SURVEY_MODE_DOUBLE);
  if (state.mode != MAPPING_SURVEY_MODE_DOUBLE || state.interior_start_index != 0 ||
      state.obstacle_scan_active || state.obstacle_scan_end_index != -1 ||
      state.obstacle_scan_cooldown_steps != 0 || state.last_scan_x != 1e30 ||
      state.last_scan_y != 1e30 || state.room_zone_index != 4 ||
      state.replan_cooldown_steps != 8) {
    return 2;
  }

  controller_mapping_survey_state_begin_scan(&state, 17, 2.5, -1.5);
  if (!state.obstacle_scan_active || state.obstacle_scan_end_index != 17 ||
      state.last_scan_x != 2.5 || state.last_scan_y != -1.5) {
    return 3;
  }
  if (controller_mapping_survey_state_complete_scan(&state, 17, 20)) return 4;
  if (!controller_mapping_survey_state_complete_scan(&state, 18, 20)) return 5;
  if (state.obstacle_scan_active || state.obstacle_scan_end_index != -1 ||
      state.obstacle_scan_cooldown_steps != 20) {
    return 6;
  }

  state.replan_cooldown_steps = 2;
  controller_mapping_survey_state_tick(&state);
  if (state.obstacle_scan_cooldown_steps != 19 || state.replan_cooldown_steps != 1) return 7;

  state.mode = MAPPING_SURVEY_MODE_DOUBLE;
  state.replan_cooldown_steps = 9;
  controller_mapping_survey_state_activate_route(&state, MAPPING_SURVEY_MODE_SNAKE);
  if (!state.route_active || state.mode != MAPPING_SURVEY_MODE_SNAKE) return 8;
  controller_mapping_survey_state_reset_route(&state);
  if (state.route_active || state.room_zone_index != -1 || state.interior_start_index != 0 ||
      state.obstacle_scan_active || state.obstacle_scan_end_index != -1 ||
      state.obstacle_scan_cooldown_steps != 0 || state.mode != MAPPING_SURVEY_MODE_SNAKE ||
      state.replan_cooldown_steps != 9) {
    return 9;
  }

  return 0;
}
