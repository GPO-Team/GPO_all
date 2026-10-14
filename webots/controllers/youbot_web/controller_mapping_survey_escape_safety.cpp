#include "controller_mapping_survey_escape_safety.h"

#include "controller_mapping_survey_safety.h"
#include "controller_zone_geometry.h"

int controller_mapping_survey_escape_candidate_allowed(
    const ControllerMappingSurveyEscapeSafetyContext *context,
    SurveyPoint robot,
    const Waypoint *candidate) {
  if (!context || !context->safety.zones || !candidate) return 0;
  if (controller_mapping_survey_runtime_known_obstacle_near(
          &context->safety, candidate->x, candidate->z, context->obstacle_clearance)) return 0;
  if (context->room_zone_index >= 0 &&
      !controller_mapping_survey_segment_stays_in_room(
          &context->safety.zones->zones[context->room_zone_index],
          robot.x, robot.y, candidate->x, candidate->z, context->grid_cell)) return 0;
  if (controller_zone_geometry_segment_blocked(
          context->safety.zones, robot.x, robot.y, candidate->x, candidate->z,
          context->segment_clearance, context->room_zone_index)) return 0;
  return controller_mapping_survey_runtime_segment_clear(
      &context->safety, robot.x, robot.y, candidate->x, candidate->z,
      context->segment_clearance, context->ignore_radius);
}
