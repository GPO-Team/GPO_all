#include "controller_mapping_scan_service.h"

int controller_mapping_scan_service_start(
    const ControllerMappingScanServiceConfig *config,
    const ControllerMappingScanServiceInput *input,
    ControllerMappingScanPointAllowed point_allowed,
    void *point_allowed_context,
    ControllerMappingScanServiceOutput *output) {
  if (!config || !input || !output || !input->mapping_survey ||
      !input->route || !input->state || !input->target ||
      !input->lidar_context ||
      input->current_waypoint_index < input->state->interior_start_index ||
      input->state->obstacle_scan_active ||
      input->state->obstacle_scan_cooldown_steps > 0 ||
      !input->lidar_context->has_closest_unexpected ||
      config->max_scan_points <= 0 || config->max_scan_points > MAX_WAYPOINTS ||
      input->route->count + config->max_scan_points > MAX_WAYPOINTS) {
    return 0;
  }

  SurveyPoint scan_points[MAX_WAYPOINTS];
  const ControllerMappingScanInput scan_input = {
      .robot_x = input->robot_x,
      .robot_y = input->robot_y,
      .heading = input->heading,
      .obstacle_range = input->lidar_context->closest_unexpected_range,
      .obstacle_beam_angle = input->lidar_context->closest_unexpected_beam_angle,
      .last_scan_x = input->state->last_scan_x,
      .last_scan_y = input->state->last_scan_y,
      .turn_sign = input->turn_sign,
      .segment_start_x = input->segment_start_x,
      .segment_start_y = input->segment_start_y,
      .target_x = input->target->x,
      .target_y = input->target->z,
  };
  if (!controller_mapping_scan_build(
          &config->scan,
          &scan_input,
          point_allowed,
          point_allowed_context,
          scan_points,
          config->max_scan_points,
          &output->scan_point_count,
          &output->obstacle_x,
          &output->obstacle_y)) {
    return 0;
  }
  if (!controller_mapping_scan_insert_route(
          input->route,
          input->current_waypoint_index,
          scan_points,
          output->scan_point_count)) {
    return 0;
  }
  controller_mapping_survey_state_begin_scan(
      input->state,
      input->current_waypoint_index + output->scan_point_count - 1,
      output->obstacle_x,
      output->obstacle_y);
  return 1;
}
