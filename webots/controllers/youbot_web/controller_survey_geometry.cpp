#include "controller_survey_geometry.h"
#include "controller_survey_intervals.h"

#include "controller_zone_geometry.h"

#include <cmath>
#include <stddef.h>
#include <string.h>

int controller_survey_append_boundary_contour(
    const SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int route_capacity,
    int boundary_capacity,
    double robot_x,
    double robot_y,
    double min_route_spacing,
    double max_route_step,
    double max_join_cell_factor,
    double rdp_epsilon) {
  if (!grid || !route || !route_count || boundary_capacity < 3) return 0;
  if (boundary_capacity > CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS) {
    boundary_capacity = CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS;
  }
  SurveyPoint boundary[CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS];
  unsigned char used[CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS];
  int boundary_count = 0;
  for (int i = 0; i < grid->count && boundary_count < boundary_capacity; ++i) {
    if (!controller_survey_cell_is_boundary(grid, i)) continue;
    boundary[boundary_count++] = controller_survey_grid_point(grid, i);
  }
  if (boundary_count < 3) return 0;

  memset(used, 0, (size_t)boundary_count);
  SurveyPoint ordered[CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS];
  int ordered_count = 0;
  int current = 0;
  double best_dist = 1e30;
  for (int i = 0; i < boundary_count; ++i) {
    const double distance = hypot(boundary[i].x - robot_x, boundary[i].y - robot_y);
    if (distance < best_dist) {
      best_dist = distance;
      current = i;
    }
  }
  while (ordered_count < boundary_count) {
    ordered[ordered_count++] = boundary[current];
    used[current] = 1;
    int next = -1;
    double next_dist = 1e30;
    for (int i = 0; i < boundary_count; ++i) {
      if (used[i]) continue;
      const double distance = hypot(
          boundary[i].x - boundary[current].x, boundary[i].y - boundary[current].y);
      if (distance < next_dist) {
        next_dist = distance;
        next = i;
      }
    }
    if (next < 0 || next_dist > grid->cell * max_join_cell_factor) break;
    current = next;
  }
  if (ordered_count < 3) return 0;

  unsigned char keep[CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS];
  memset(keep, 0, (size_t)ordered_count);
  keep[0] = 1;
  keep[ordered_count - 1] = 1;
  controller_survey_rdp_keep(ordered, 0, ordered_count - 1, rdp_epsilon, keep);
  SurveyPoint simplified[CONTROLLER_SURVEY_MAX_BOUNDARY_POINTS];
  int simplified_count = 0;
  for (int i = 0; i < ordered_count; ++i) {
    if (keep[i]) simplified[simplified_count++] = ordered[i];
  }
  if (simplified_count < 3) return 0;

  controller_survey_route_add(
      route, route_count, route_capacity, min_route_spacing,
      simplified[0].x, simplified[0].y);
  for (int i = 1; i < simplified_count; ++i) {
    controller_survey_route_add_segment(
        route, route_count, route_capacity, min_route_spacing, max_route_step,
        simplified[i - 1], simplified[i]);
  }
  controller_survey_route_add_segment(
      route, route_count, route_capacity, min_route_spacing, max_route_step,
      simplified[simplified_count - 1], simplified[0]);
  return 1;
}

int controller_survey_clip_intervals(
    const SurveyInterval *raw,
    int raw_count,
    double min_value,
    double max_value,
    double min_length,
    SurveyInterval *clipped,
    int capacity) {
  if (!raw || raw_count <= 0 || !clipped || capacity <= 0) return 0;
  int count = 0;
  for (int i = 0; i < raw_count && count < capacity; ++i) {
    const double start = fmax(raw[i].start, min_value);
    const double end = fmin(raw[i].end, max_value);
    if (end - start < min_length) continue;
    clipped[count++] = SurveyInterval{start, end};
  }
  return count;
}

void controller_survey_reverse_intervals(SurveyInterval *intervals, int count) {
  if (!intervals || count <= 1) return;
  for (int low = 0, high = count - 1; low < high; ++low, --high) {
    const SurveyInterval temporary = intervals[low];
    intervals[low] = intervals[high];
    intervals[high] = temporary;
  }
}

void controller_survey_choose_snake_start(
    SurveyPoint current,
    SurveyPoint low_endpoint,
    SurveyPoint high_endpoint,
    int *start_from_low,
    double *best_distance) {
  if (!start_from_low || !best_distance) return;
  const double low_distance = hypot(low_endpoint.x - current.x, low_endpoint.y - current.y);
  const double high_distance = hypot(high_endpoint.x - current.x, high_endpoint.y - current.y);
  *start_from_low = low_distance <= high_distance ? 1 : 0;
  *best_distance = fmin(low_distance, high_distance);
}
