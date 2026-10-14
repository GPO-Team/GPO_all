#include "controller_survey_contour.h"

#include <assert.h>
#include <stdio.h>

typedef struct {
  int *route_count;
  int point_calls;
  int segment_calls;
  SurveyPoint segment_ends[8];
} TestContext;

static int point_is_safe(void *context, SurveyPoint point) {
  (void)context;
  return !(point.x == 1.0 && point.y == 1.0);
}

static void add_point(void *context, SurveyPoint point) {
  (void)point;
  TestContext *test = static_cast<TestContext *>(context);
  test->point_calls += 1;
  *test->route_count += 1;
}

static void add_segment(void *context, SurveyPoint from, SurveyPoint to) {
  (void)from;
  TestContext *test = static_cast<TestContext *>(context);
  test->segment_ends[test->segment_calls++] = to;
  *test->route_count += 1;
}

int main(void) {
  const SurveyPoint contour[] = {
      {0.0, 0.0}, {1.0, 0.0}, {1.0, 1.0}, {0.0, 1.0}};
  int route_count = 0;
  TestContext context = {.route_count = &route_count};

  assert(controller_survey_append_contour(
      contour, 4, 0.1, 0.1, &route_count,
      point_is_safe, add_point, add_segment, &context));
  assert(context.point_calls == 1);
  assert(context.segment_calls == 4);
  assert(context.segment_ends[0].x == 1.0 && context.segment_ends[0].y == 0.0);
  assert(context.segment_ends[1].x == 0.0 && context.segment_ends[1].y == 1.0);
  assert(context.segment_ends[2].x == 0.0 && context.segment_ends[2].y == 0.0);

  puts("controller_survey_contour_test: OK");
  return 0;
}
