#include "controller_survey_geometry.h"

#include <cmath>

int controller_survey_nearest_point_index(
    const SurveyPoint *points, int count, double x, double y) {
  if (!points || count <= 0) return -1;
  int nearest = 0;
  double best_distance = 1e30;
  for (int i = 0; i < count; ++i) {
    const double distance = hypot(points[i].x - x, points[i].y - y);
    if (distance < best_distance) {
      best_distance = distance;
      nearest = i;
    }
  }
  return nearest;
}

void controller_survey_expand_bounds(
    double x, double y, double *min_x, double *max_x, double *min_y, double *max_y) {
  if (!min_x || !max_x || !min_y || !max_y) return;
  if (x < *min_x) *min_x = x;
  if (x > *max_x) *max_x = x;
  if (y < *min_y) *min_y = y;
  if (y > *max_y) *max_y = y;
}

void controller_survey_route_add(
    SurveyPoint *route, int *count, int capacity, double min_spacing, double x, double y) {
  if (!route || !count || *count < 0 || *count >= capacity) return;
  if (*count > 0) {
    SurveyPoint *last = &route[*count - 1];
    if (hypot(last->x - x, last->y - y) < min_spacing) {
      last->x = x;
      last->y = y;
      return;
    }
  }
  route[*count] = SurveyPoint{x, y};
  *count += 1;
}

void controller_survey_route_add_segment(
    SurveyPoint *route, int *count, int capacity, double min_spacing, double max_step,
    SurveyPoint from, SurveyPoint to) {
  if (max_step <= 0.0) return;
  const double length = hypot(to.x - from.x, to.y - from.y);
  const int steps = (int)fmax(1.0, ceil(length / max_step));
  for (int i = 1; i <= steps; ++i) {
    const double t = (double)i / (double)steps;
    controller_survey_route_add(
        route, count, capacity, min_spacing,
        from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
  }
}
