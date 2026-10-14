#include "controller_mapping_survey_escape.h"

#include <assert.h>

static int allow_after_first(void *context, const Waypoint *candidate) {
  (void)context;
  return candidate->x >= 2.0;
}

int main(void) {
  RouteData route = {0};
  route.count = 3;
  route.waypoints[0] = Waypoint{0.2, 0.0, 0.0, 0};
  route.waypoints[1] = Waypoint{1.0, 0.0, 0.0, 0};
  route.waypoints[2] = Waypoint{2.0, 0.0, 0.0, 0};
  const ControllerMappingSurveyEscapeInput input = {
      .route = &route, .route_active = 1, .start_index = 0,
      .robot_x = 0.0, .robot_y = 0.0, .minimum_distance = 0.72,
      .scan_ahead = 72};
  assert(controller_mapping_survey_find_escape_waypoint(&input, 0, 0) == 1);
  assert(controller_mapping_survey_find_escape_waypoint(&input, allow_after_first, 0) == 2);
  const ControllerMappingSurveyEscapeInput exhausted = {
      .route = &route, .route_active = 1, .start_index = 2,
      .robot_x = 0.0, .robot_y = 0.0, .minimum_distance = 0.72,
      .scan_ahead = 72};
  assert(controller_mapping_survey_find_escape_waypoint(&exhausted, 0, 0) == -1);
  return 0;
}
