#include "controller_survey_generator.h"

ControllerSurveyGenerateResult controller_survey_generate(
    int clear_map_before_start,
    MappingSurveyMode mode,
    int *room_zone_index,
    int *interior_start_index,
    const ControllerSurveyGeneratorCallbacks *callbacks,
    void *context) {
  if (!room_zone_index || !interior_start_index || !callbacks ||
      !callbacks->clear_map || !callbacks->prepare || !callbacks->read_robot ||
      !callbacks->find_room || !callbacks->build_grid || !callbacks->flood_grid ||
      !callbacks->build_route || !callbacks->write_route) {
    return CONTROLLER_SURVEY_GENERATE_GRID_FAILED;
  }
  if (clear_map_before_start) callbacks->clear_map(context);
  callbacks->prepare(context, mode);
  const SurveyPoint robot = callbacks->read_robot(context);
  *room_zone_index = callbacks->find_room(context, robot);
  if (!callbacks->build_grid(context, robot, *room_zone_index)) {
    return CONTROLLER_SURVEY_GENERATE_GRID_FAILED;
  }
  if (callbacks->flood_grid(context, robot) <= 0) {
    return CONTROLLER_SURVEY_GENERATE_NO_COMPONENT;
  }

  SurveyPoint route[MAX_WAYPOINTS];
  int route_count = 0;
  if (!callbacks->build_route(
          context, mode, robot, *room_zone_index,
          route, &route_count, interior_start_index)) {
    return CONTROLLER_SURVEY_GENERATE_EMPTY_ROUTE;
  }
  callbacks->write_route(context, mode, route, route_count);
  return CONTROLLER_SURVEY_GENERATE_OK;
}
