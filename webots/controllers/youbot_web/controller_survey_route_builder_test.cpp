#include "controller_survey_route_builder.h"

#include <assert.h>
#include <stdio.h>

typedef struct {
  int *route_count;
  char phases[8];
  int phase_count;
  int room_contour_available;
} TestContext;

static int start_is_safe(void *context, SurveyPoint point) {
  (void)context;
  (void)point;
  return 1;
}

static void add_start(void *context, SurveyPoint point) {
  (void)point;
  TestContext *test = static_cast<TestContext *>(context);
  test->phases[test->phase_count++] = 'S';
  *test->route_count += 1;
}

static int append_room(void *context) {
  TestContext *test = static_cast<TestContext *>(context);
  test->phases[test->phase_count++] = 'R';
  if (test->room_contour_available) *test->route_count += 3;
  return test->room_contour_available;
}

static void append_boundary(void *context) {
  TestContext *test = static_cast<TestContext *>(context);
  test->phases[test->phase_count++] = 'B';
  *test->route_count += 3;
}

static void append_horizontal(void *context) {
  TestContext *test = static_cast<TestContext *>(context);
  test->phases[test->phase_count++] = 'H';
  *test->route_count += 2;
}

static void append_vertical(void *context) {
  TestContext *test = static_cast<TestContext *>(context);
  test->phases[test->phase_count++] = 'V';
  *test->route_count += 2;
}

int main(void) {
  int route_count = 0;
  int interior_start = -1;
  TestContext context = {.route_count = &route_count};
  const ControllerSurveyRouteCallbacks callbacks = {
      start_is_safe,
      add_start,
      append_room,
      append_boundary,
      append_horizontal,
      append_vertical,
  };

  assert(controller_survey_build_route_phases(
      MAPPING_SURVEY_MODE_DOUBLE,
      SurveyPoint{0.0, 0.0},
      &route_count,
      &interior_start,
      &callbacks,
      &context));
  assert(interior_start == 4);
  assert(context.phase_count == 5);
  assert(context.phases[0] == 'S' && context.phases[1] == 'R' &&
      context.phases[2] == 'B' && context.phases[3] == 'H' &&
      context.phases[4] == 'V');

  route_count = 0;
  interior_start = -1;
  context.phase_count = 0;
  context.room_contour_available = 1;
  assert(controller_survey_build_route_phases(
      MAPPING_SURVEY_MODE_SNAKE,
      SurveyPoint{0.0, 0.0},
      &route_count,
      &interior_start,
      &callbacks,
      &context));
  assert(interior_start == 4);
  assert(context.phase_count == 3);
  assert(context.phases[0] == 'S' && context.phases[1] == 'R' &&
      context.phases[2] == 'H');

  puts("controller_survey_route_builder_test: OK");
  return 0;
}
