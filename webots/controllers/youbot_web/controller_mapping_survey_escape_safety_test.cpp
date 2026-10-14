#include "controller_mapping_survey_escape_safety.h"

#include <stddef.h>

int main(void) {
  ZoneData zones = {0};
  zones.count = 1;
  zones.zones[0].point_count = 4;
  zones.zones[0].points[0].x = -2.0; zones.zones[0].points[0].y = -2.0;
  zones.zones[0].points[1].x = 2.0; zones.zones[0].points[1].y = -2.0;
  zones.zones[0].points[2].x = 2.0; zones.zones[0].points[2].y = 2.0;
  zones.zones[0].points[3].x = -2.0; zones.zones[0].points[3].y = 2.0;
  const ControllerMappingSurveyEscapeSafetyContext context = {
      {&zones, NULL, 0, NULL, 0, 1.0, 10.0, 0.18, 3.0, 3.0, 0.18, 0.25},
      0, 0.25, 0.20, 0.20, 0.10};
  const SurveyPoint robot = {0.0, 0.0};
  const Waypoint allowed = {1.0, 0.0, 0.0, 0};
  const Waypoint outside = {3.0, 0.0, 0.0, 0};
  if (!controller_mapping_survey_escape_candidate_allowed(&context, robot, &allowed)) return 1;
  if (controller_mapping_survey_escape_candidate_allowed(&context, robot, &outside)) return 2;
  return 0;
}
