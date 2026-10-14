#include "controller_mapping_survey_escape.h"

#include <cmath>

int controller_mapping_survey_find_escape_waypoint(
    const ControllerMappingSurveyEscapeInput *input,
    ControllerMappingSurveyEscapeAllowed allowed,
    void *context) {
  if (!input || !input->route || !input->route_active || input->route->count <= 0 ||
      input->scan_ahead <= 0) return -1;
  const int first = input->start_index + 1 < 0 ? 0 : input->start_index + 1;
  const int last = input->route->count < first + input->scan_ahead
      ? input->route->count : first + input->scan_ahead;
  for (int i = first; i < last; ++i) {
    const Waypoint *candidate = &input->route->waypoints[i];
    if (hypot(candidate->x - input->robot_x, candidate->z - input->robot_y) <
        input->minimum_distance) continue;
    if (!allowed || allowed(context, candidate)) return i;
  }
  return -1;
}
