#include "controller_survey_generator.h"

#include <assert.h>
#include <stdio.h>

typedef struct {
  char calls[12];
  int call_count;
  int grid_ok;
  int written_count;
} TestContext;

static void record(void *value, char call) {
  TestContext *test = static_cast<TestContext *>(value);
  test->calls[test->call_count++] = call;
}

static void clear_map(void *context) { record(context, 'C'); }
static void prepare(void *context, MappingSurveyMode mode) {
  assert(mode == MAPPING_SURVEY_MODE_DOUBLE);
  record(context, 'P');
}
static SurveyPoint read_robot(void *context) {
  record(context, 'R');
  return SurveyPoint{1.0, 2.0};
}
static int find_room(void *context, SurveyPoint robot) {
  assert(robot.x == 1.0 && robot.y == 2.0);
  record(context, 'F');
  return 3;
}
static int build_grid(void *context, SurveyPoint robot, int room_zone_index) {
  (void)robot;
  assert(room_zone_index == 3);
  record(context, 'G');
  return static_cast<TestContext *>(context)->grid_ok;
}
static int flood_grid(void *context, SurveyPoint robot) {
  (void)robot;
  record(context, 'L');
  return 5;
}
static int build_route(
    void *context,
    MappingSurveyMode mode,
    SurveyPoint robot,
    int room_zone_index,
    SurveyPoint *route,
    int *route_count,
    int *interior_start_index) {
  (void)mode;
  (void)robot;
  (void)room_zone_index;
  record(context, 'B');
  route[0] = SurveyPoint{0.0, 0.0};
  route[1] = SurveyPoint{1.0, 0.0};
  *route_count = 2;
  *interior_start_index = 1;
  return 1;
}
static void write_route(
    void *context,
    MappingSurveyMode mode,
    const SurveyPoint *route,
    int route_count) {
  (void)mode;
  (void)route;
  record(context, 'W');
  static_cast<TestContext *>(context)->written_count = route_count;
}

int main(void) {
  const ControllerSurveyGeneratorCallbacks callbacks = {
      clear_map, prepare, read_robot, find_room, build_grid,
      flood_grid, build_route, write_route};
  TestContext context = {.grid_ok = 1};
  int room_zone_index = -1;
  int interior_start_index = -1;
  assert(controller_survey_generate(
      1, MAPPING_SURVEY_MODE_DOUBLE, &room_zone_index, &interior_start_index,
      &callbacks, &context) == CONTROLLER_SURVEY_GENERATE_OK);
  assert(room_zone_index == 3);
  assert(interior_start_index == 1);
  assert(context.written_count == 2);
  assert(context.call_count == 8);

  context = TestContext{0};
  assert(controller_survey_generate(
      0, MAPPING_SURVEY_MODE_DOUBLE, &room_zone_index, &interior_start_index,
      &callbacks, &context) == CONTROLLER_SURVEY_GENERATE_GRID_FAILED);
  assert(context.call_count == 4);

  puts("controller_survey_generator_test: OK");
  return 0;
}
