#include "controller_mapping_survey_safety.h"

#include <assert.h>

static int reject_middle(void *context, double x, double y, double clearance) {
  (void)context; (void)y; (void)clearance;
  return x < 0.45 || x > 0.55;
}

int main(void) {
  assert(!controller_mapping_survey_segment_safe(
      0.0, 0.0, 1.0, 0.0, 0.25, 0.1, reject_middle, 0));
  assert(controller_mapping_survey_segment_safe(
      0.0, 0.0, 0.2, 0.0, 0.25, 0.1, reject_middle, 0));
  LimitZone room = {.point_count = 4, .points = {{0, 0}, {2, 0}, {2, 2}, {0, 2}}};
  assert(controller_mapping_survey_segment_stays_in_room(&room, 0.2, 0.2, 1.8, 1.8, 0.25));
  assert(!controller_mapping_survey_segment_stays_in_room(&room, 0.2, 0.2, 2.2, 0.2, 0.25));
  return 0;
}
