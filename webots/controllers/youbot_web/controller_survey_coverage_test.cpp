#include "controller_survey_coverage.h"

#include <assert.h>
#include <cmath>
#include <stdio.h>

typedef struct {
  int *route_count;
  SurveyPoint starts[4];
  SurveyPoint ends[4];
  int segment_count;
} TestContext;

static int build_interval(
    void *context,
    double coordinate,
    SurveyInterval *intervals,
    int capacity) {
  (void)context;
  (void)coordinate;
  if (capacity <= 0) return 0;
  intervals[0] = SurveyInterval{-1.0, 1.0};
  return 1;
}

static void append_segment(void *context, SurveyPoint start, SurveyPoint end) {
  TestContext *test = static_cast<TestContext *>(context);
  test->starts[test->segment_count] = start;
  test->ends[test->segment_count] = end;
  test->segment_count += 1;
  *test->route_count += 2;
}

int main(void) {
  int route_count = 0;
  TestContext context = {.route_count = &route_count};
  controller_survey_append_axis_coverage(
      0.0,
      2.0,
      1.0,
      0,
      1,
      0,
      &route_count,
      32,
      4,
      build_interval,
      append_segment,
      &context);

  assert(context.segment_count == 3);
  assert(fabs(context.starts[0].x + 1.0) < 1e-9);
  assert(fabs(context.ends[0].x - 1.0) < 1e-9);
  assert(fabs(context.starts[0].y - 0.0) < 1e-9);
  assert(fabs(context.starts[1].x - 1.0) < 1e-9);
  assert(fabs(context.ends[1].x + 1.0) < 1e-9);
  assert(fabs(context.starts[1].y - 1.0) < 1e-9);
  assert(fabs(context.starts[2].x + 1.0) < 1e-9);
  assert(fabs(context.starts[2].y - 2.0) < 1e-9);

  int start_positive = 1;
  double start_distance = 0.0;
  assert(controller_survey_choose_axis_start(
      0.0,
      2.0,
      1.0,
      0,
      0,
      SurveyPoint{0.8, 0.0},
      4,
      build_interval,
      NULL,
      &start_positive,
      &start_distance));
  assert(!start_positive);
  assert(fabs(start_distance - 0.2) < 1e-9);

  route_count = 0;
  context.segment_count = 0;
  controller_survey_append_best_axis_coverage(
      0.0,
      2.0,
      1.0,
      0,
      SurveyPoint{0.8, 2.0},
      &route_count,
      32,
      4,
      build_interval,
      append_segment,
      &context);
  assert(context.segment_count == 3);
  assert(fabs(context.starts[0].y - 2.0) < 1e-9);
  assert(fabs(context.starts[0].x - 1.0) < 1e-9);
  assert(fabs(context.ends[0].x + 1.0) < 1e-9);

  puts("controller_survey_coverage_test: OK");
  return 0;
}
