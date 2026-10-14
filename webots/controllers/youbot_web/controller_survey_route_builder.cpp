#include "controller_survey_route_builder.h"

int controller_survey_build_route_phases(
    MappingSurveyMode mode,
    SurveyPoint robot,
    int *route_count,
    int *interior_start_index,
    const ControllerSurveyRouteCallbacks *callbacks,
    void *context) {
  if (!route_count || !interior_start_index || !callbacks ||
      !callbacks->start_is_safe || !callbacks->add_start ||
      !callbacks->append_room_contour || !callbacks->append_grid_boundary ||
      !callbacks->append_horizontal_coverage || !callbacks->append_vertical_coverage) {
    return 0;
  }

  if (callbacks->start_is_safe(context, robot)) callbacks->add_start(context, robot);
  if (!callbacks->append_room_contour(context)) callbacks->append_grid_boundary(context);
  *interior_start_index = *route_count;

  callbacks->append_horizontal_coverage(context);
  if (mode == MAPPING_SURVEY_MODE_DOUBLE) callbacks->append_vertical_coverage(context);
  return *route_count >= 2;
}
