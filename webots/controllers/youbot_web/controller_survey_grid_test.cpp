#include "controller_survey_grid.h"

#include <assert.h>
#include <cmath>
#include <stdio.h>

static int point_is_safe(
    void *context,
    double x,
    double y,
    int room_zone_index,
    double clearance) {
  (void)context;
  (void)room_zone_index;
  (void)clearance;
  return x >= -1.0 && x <= 1.0 && y >= -1.0 && y <= 1.0;
}

int main(void) {
  ZoneData zones = {0};
  zones.count = 1;
  zones.zones[0].point_count = 4;
  zones.zones[0].points[0].x = -1.0;
  zones.zones[0].points[0].y = -1.0;
  zones.zones[0].points[1].x = 1.0;
  zones.zones[0].points[1].y = -1.0;
  zones.zones[0].points[2].x = 1.0;
  zones.zones[0].points[2].y = 1.0;
  zones.zones[0].points[3].x = -1.0;
  zones.zones[0].points[3].y = 1.0;

  ControllerSurveyGridConfig config = {
      .default_min_x = -2.0,
      .default_max_x = 2.0,
      .default_min_y = -2.0,
      .default_max_y = 2.0,
      .max_extent_x = 5.0,
      .max_extent_y = 5.0,
      .base_cell = 0.25,
      .max_cells = MAPPING_SURVEY_MAX_GRID_CELLS,
  };
  ControllerSurveyGridInput input = {
      .zones = &zones,
      .room_zone_index = 0,
      .robot_x = 0.0,
      .robot_y = 0.0,
      .clearance = 0.2,
  };
  static SurveyGrid grid;

  assert(controller_survey_grid_build(&grid, &config, &input, point_is_safe, NULL));
  assert(fabs(grid.min_x + 2.2) < 1e-9);
  assert(fabs(grid.min_y + 2.2) < 1e-9);
  assert(fabs(grid.cell - 0.25) < 1e-9);
  assert(grid.count == grid.width * grid.height);

  const int center_x = (int)lround((0.0 - grid.min_x) / grid.cell);
  const int center_y = (int)lround((0.0 - grid.min_y) / grid.cell);
  assert(grid.free_cell[center_y * grid.width + center_x] == 1);
  assert(grid.free_cell[0] == 0);

  puts("controller_survey_grid_test: OK");
  return 0;
}
