#include "controller_survey_contour.h"

#include "controller_survey_geometry.h"

int controller_survey_append_contour(
    const SurveyPoint *contour,
    int contour_count,
    double robot_x,
    double robot_y,
    int *route_count,
    ControllerSurveyContourPointSafeFn point_is_safe,
    ControllerSurveyContourAddPointFn add_point,
    ControllerSurveyContourAddSegmentFn add_segment,
    void *context) {
  if (!contour || contour_count < 3 || !route_count || !point_is_safe ||
      !add_point || !add_segment) {
    return 0;
  }
  const int start_index = controller_survey_nearest_point_index(
      contour, contour_count, robot_x, robot_y);
  if (start_index < 0) return 0;

  const SurveyPoint start = contour[start_index];
  if (point_is_safe(context, start)) add_point(context, start);

  SurveyPoint previous = start;
  for (int step = 1; step <= contour_count; ++step) {
    const int index = (start_index + step) % contour_count;
    const SurveyPoint next = contour[index];
    if (!point_is_safe(context, next)) continue;
    add_segment(context, previous, next);
    previous = next;
  }
  add_segment(context, previous, start);
  return *route_count > 2;
}
