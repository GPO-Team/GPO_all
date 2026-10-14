#include "controller_mapping_survey_route_generation_service.h"

#include <assert.h>

static void clear_map(void *context) { (void)context; }
static void prepare(void *context, MappingSurveyMode mode) { (void)context; (void)mode; }
static SurveyPoint read_robot(void *context) { (void)context; return SurveyPoint{0.0, 0.0}; }
static int find_room(void *context, SurveyPoint robot) { (void)context; (void)robot; return 0; }
static int build_grid(void *context, SurveyPoint robot, int room) { (void)context; (void)robot; (void)room; return 0; }
static int flood_grid(void *context, SurveyPoint robot) { (void)context; (void)robot; return 0; }
static int build_route(void *context, MappingSurveyMode mode, SurveyPoint robot, int room, SurveyPoint *route, int *count, int *start) { (void)context; (void)mode; (void)robot; (void)room; (void)route; (void)count; (void)start; return 0; }
static void write_route(void *context, MappingSurveyMode mode, const SurveyPoint *route, int count) { (void)context; (void)mode; (void)route; (void)count; }
static void set_error(const char *message) { (void)message; }

int main(void) {
  const ControllerSurveyGeneratorCallbacks callbacks = {
      clear_map, prepare, read_robot, find_room, build_grid, flood_grid, build_route, write_route};
  const ControllerMappingSurveyRouteGenerationService service = {&callbacks, NULL, set_error};
  int room = -1;
  int start = -1;
  assert(!controller_mapping_survey_route_generation_service_generate(
      &service, 0, MAPPING_SURVEY_MODE_SNAKE, &room, &start));
  return 0;
}
