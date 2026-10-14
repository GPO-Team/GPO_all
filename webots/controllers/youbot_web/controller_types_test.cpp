#include "controller_types.h"

#include <string.h>

int main(void) {
  RouteData route = {0};
  ZoneData zones = {0};
  SurfaceZoneData surfaces = {0};
  SurveyGrid grid = {0};

  if ((int)(sizeof(route.waypoints) / sizeof(route.waypoints[0])) != MAX_WAYPOINTS) return 1;
  if ((int)(sizeof(zones.zones) / sizeof(zones.zones[0])) != MAX_ZONES) return 2;
  if ((int)(sizeof(zones.zones[0].points) / sizeof(zones.zones[0].points[0])) != MAX_ZONE_POINTS) return 3;
  if ((int)(sizeof(surfaces.zones) / sizeof(surfaces.zones[0])) != MAX_ZONES) return 4;
  if ((int)(sizeof(grid.free_cell) / sizeof(grid.free_cell[0])) != MAPPING_SURVEY_MAX_GRID_CELLS) return 5;

  if (controller_parse_mapping_survey_mode(NULL) != MAPPING_SURVEY_MODE_SNAKE) return 6;
  if (controller_parse_mapping_survey_mode("double") != MAPPING_SURVEY_MODE_DOUBLE) return 7;
  if (controller_parse_mapping_survey_mode("double_pass") != MAPPING_SURVEY_MODE_DOUBLE) return 8;
  if (controller_parse_mapping_survey_mode("unknown") != MAPPING_SURVEY_MODE_SNAKE) return 9;
  if (strcmp(controller_mapping_survey_mode_to_string(MAPPING_SURVEY_MODE_DOUBLE), "double") != 0) return 10;
  if (strcmp(controller_mapping_survey_mode_to_string(MAPPING_SURVEY_MODE_SNAKE), "snake") != 0) return 11;

  return 0;
}
