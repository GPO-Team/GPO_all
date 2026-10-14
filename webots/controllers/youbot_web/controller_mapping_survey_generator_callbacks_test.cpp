#include "controller_mapping_survey_generator_callbacks.h"

#include <assert.h>

typedef struct {
  char trace[32];
  int trace_count;
  SurveyPoint robot;
  int room_zone_index;
  double start_clearance;
  const RuntimeCommand *command;
  const char *path;
  int write_route_count;
} TestContext;

static void trace(void *value, char event) {
  TestContext *context = static_cast<TestContext *>(value);
  context->trace[context->trace_count++] = event;
}

static void clear_map(void *context) { trace(context, 'C'); }
static void prepare(void *context, MappingSurveyMode mode) { (void)mode; trace(context, 'P'); }
static SurveyPoint read_robot(void *context) {
  trace(context, 'R');
  return static_cast<TestContext *>(context)->robot;
}
static int find_room(void *context, SurveyPoint robot) {
  TestContext *test = static_cast<TestContext *>(context);
  assert(robot.x == test->robot.x && robot.y == test->robot.y);
  trace(test, 'F');
  return test->room_zone_index;
}
static int build_grid(void *context, SurveyGrid *grid, SurveyPoint robot, int room, const RuntimeCommand *command) {
  TestContext *test = static_cast<TestContext *>(context);
  assert(grid && room == test->room_zone_index && robot.x == test->robot.x && command == test->command);
  trace(test, 'G');
  return 1;
}
static int flood_grid(void *context, SurveyGrid *grid, SurveyPoint robot) {
  TestContext *test = static_cast<TestContext *>(context);
  assert(grid && robot.y == test->robot.y);
  trace(test, 'L');
  return 1;
}
static int start_is_safe(void *context, SurveyPoint start, int room, double clearance) {
  TestContext *test = static_cast<TestContext *>(context);
  assert(start.x == test->robot.x && room == test->room_zone_index);
  test->start_clearance = clearance;
  trace(test, 'S');
  return 1;
}
static void add_route_point(void *context, SurveyPoint *route, int *count, SurveyPoint point) {
  trace(context, 'A');
  route[(*count)++] = point;
}
static int append_contour(void *context, SurveyGrid *grid, SurveyPoint *route, int *count, int room, SurveyPoint robot) {
  (void)grid; (void)route; (void)count; (void)room; (void)robot;
  trace(context, 'O');
  return 0;
}
static void append_boundary(void *context, SurveyGrid *grid, SurveyPoint *route, int *count, SurveyPoint robot) {
  (void)grid; (void)robot;
  trace(context, 'B');
  route[(*count)++] = SurveyPoint{1.0, 1.0};
}
static void append_horizontal(void *context, SurveyGrid *grid, SurveyPoint *route, int *count, int room) {
  (void)grid; (void)room;
  trace(context, 'H');
  route[(*count)++] = SurveyPoint{2.0, 2.0};
}
static void append_vertical(void *context, SurveyGrid *grid, SurveyPoint *route, int *count, int room) {
  (void)grid; (void)room;
  trace(context, 'V');
  route[(*count)++] = SurveyPoint{3.0, 3.0};
}
static void write_route(void *context, const char *path, MappingSurveyMode mode, const SurveyPoint *route, int count) {
  TestContext *test = static_cast<TestContext *>(context);
  assert(path == test->path && mode == MAPPING_SURVEY_MODE_DOUBLE && route[0].x == test->robot.x);
  test->write_route_count = count;
  trace(test, 'W');
}

int main(void) {
  RuntimeCommand command = {0};
  TestContext test = {{0}, 0, {4.0, -2.0}, 7, 0.0, &command, "route.csv", 0};
  const ControllerMappingSurveyGeneratorCallbackOperations operations = {
      clear_map, prepare, read_robot, find_room, build_grid, flood_grid,
      start_is_safe, add_route_point, append_contour, append_boundary,
      append_horizontal, append_vertical, write_route};
  ControllerMappingSurveyGeneratorCallbacksAdapter adapter;
  controller_mapping_survey_generator_callbacks_adapter_init(
      &adapter, &operations, &test, test.path, test.command, 0.315);

  int room = -1;
  int interior_start = -1;
  assert(controller_survey_generate(
      1, MAPPING_SURVEY_MODE_DOUBLE, &room, &interior_start,
      controller_mapping_survey_generator_callbacks_adapter_callbacks(&adapter), &adapter) ==
      CONTROLLER_SURVEY_GENERATE_OK);
  assert(room == 7 && interior_start == 2 && test.start_clearance == 0.315);
  assert(test.write_route_count == 4);
  assert(test.trace_count == 13);
  assert(test.trace[0] == 'C' && test.trace[1] == 'P' && test.trace[2] == 'R');
  assert(test.trace[3] == 'F' && test.trace[4] == 'G' && test.trace[5] == 'L');
  assert(test.trace[6] == 'S' && test.trace[7] == 'A' && test.trace[8] == 'O');
  assert(test.trace[9] == 'B' && test.trace[10] == 'H' && test.trace[11] == 'V');
  assert(test.trace[12] == 'W');
  return 0;
}
