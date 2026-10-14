#include "controller_mapping_survey_coverage_service.h"

#include <assert.h>

int main(void) {
  ZoneData zones = {0};
  zones.count = 1;
  zones.zones[0].point_count = 4;
  zones.zones[0].points[0].x = -3.0;
  zones.zones[0].points[0].y = -3.0;
  zones.zones[0].points[1].x = 3.0;
  zones.zones[0].points[1].y = -3.0;
  zones.zones[0].points[2].x = 3.0;
  zones.zones[0].points[2].y = 3.0;
  zones.zones[0].points[3].x = -3.0;
  zones.zones[0].points[3].y = 3.0;
  SurveyGrid grid = {0};
  grid.min_x = -3.0;
  grid.min_y = -3.0;
  grid.cell = 0.5;
  grid.width = 13;
  grid.height = 13;
  grid.count = grid.width * grid.height;
  for (int index = 0; index < grid.count; ++index) {
    grid.free_cell[index] = 1;
    grid.component_cell[index] = 1;
  }
  SurveyPoint route[MAX_WAYPOINTS] = {0};
  int route_count = 0;
  const ControllerMappingSurveyCoverageService service = {
      {&zones, NULL, 0, NULL, 0, 0.0, 10.0, 0.2, 10.0, 0.1},
      0.2, 0.3, 1.0, 0.18, 1e-6, MAX_WAYPOINTS};

  controller_mapping_survey_coverage_service_append_horizontal(
      &service, &grid, route, &route_count, 0);
  assert(route_count > 2);
  return 0;
}
