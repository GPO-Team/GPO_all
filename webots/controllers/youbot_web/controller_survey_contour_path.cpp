#include "controller_survey_geometry.h"

#include <cmath>
#include <stddef.h>
#include <string.h>

static double point_segment_distance(SurveyPoint point, SurveyPoint start, SurveyPoint end) {
  const double dx = end.x - start.x;
  const double dy = end.y - start.y;
  const double length_sq = dx * dx + dy * dy;
  if (length_sq <= 1e-12) return hypot(point.x - start.x, point.y - start.y);
  double t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length_sq;
  if (t < 0.0) t = 0.0;
  if (t > 1.0) t = 1.0;
  return hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

void controller_survey_rdp_keep(
    const SurveyPoint *points, int first, int last, double epsilon, unsigned char *keep) {
  if (!points || !keep || first < 0 || last <= first + 1) return;
  double best_distance = 0.0;
  int best_index = -1;
  for (int i = first + 1; i < last; ++i) {
    const double distance = point_segment_distance(points[i], points[first], points[last]);
    if (distance > best_distance) {
      best_distance = distance;
      best_index = i;
    }
  }
  if (best_index >= 0 && best_distance > epsilon) {
    keep[best_index] = 1;
    controller_survey_rdp_keep(points, first, best_index, epsilon, keep);
    controller_survey_rdp_keep(points, best_index, last, epsilon, keep);
  }
}

int controller_survey_find_grid_path(
    SurveyGrid *grid,
    SurveyPoint from,
    SurveyPoint to,
    SurveyPoint *path,
    int *path_count,
    int max_path_count) {
  if (!grid || !path || !path_count || max_path_count <= 0) return 0;
  const int start = controller_survey_grid_index_for_point(grid, from.x, from.y);
  const int goal = controller_survey_grid_index_for_point(grid, to.x, to.y);
  if (start < 0 || goal < 0 || !grid->component_cell[start] || !grid->component_cell[goal]) return 0;

  memset(grid->visited_cell, 0, (size_t)grid->count);
  for (int i = 0; i < grid->count; ++i) grid->parent[i] = -1;
  int head = 0;
  int tail = 0;
  grid->queue[tail++] = start;
  grid->visited_cell[start] = 1;
  const int dx[8] = {1, -1, 0, 0, 1, 1, -1, -1};
  const int dy[8] = {0, 0, 1, -1, 1, -1, 1, -1};
  while (head < tail && !grid->visited_cell[goal]) {
    const int current = grid->queue[head++];
    const int cx = current % grid->width;
    const int cy = current / grid->width;
    for (int direction = 0; direction < 8; ++direction) {
      const int nx = cx + dx[direction];
      const int ny = cy + dy[direction];
      if (nx < 0 || nx >= grid->width || ny < 0 || ny >= grid->height) continue;
      const int neighbor = ny * grid->width + nx;
      if (!grid->component_cell[neighbor] || grid->visited_cell[neighbor]) continue;
      grid->visited_cell[neighbor] = 1;
      grid->parent[neighbor] = current;
      grid->queue[tail++] = neighbor;
    }
  }
  if (!grid->visited_cell[goal]) return 0;

  int *reverse = grid->queue;
  int reverse_count = 0;
  int reached_start = 0;
  for (int current = goal;
       current >= 0 && reverse_count < MAPPING_SURVEY_MAX_GRID_CELLS;
       current = grid->parent[current]) {
    reverse[reverse_count++] = current;
    if (current == start) {
      reached_start = 1;
      break;
    }
  }
  if (reverse_count <= 0 || !reached_start) return 0;

  *path_count = 0;
  for (int i = reverse_count - 1; i >= 0; i -= 3) {
    if (*path_count >= max_path_count) {
      *path_count = 0;
      return 0;
    }
    path[*path_count] = controller_survey_grid_point(grid, reverse[i]);
    *path_count += 1;
  }
  if (path[*path_count - 1].x != to.x || path[*path_count - 1].y != to.y) {
    if (*path_count >= max_path_count) {
      *path_count = 0;
      return 0;
    }
    path[*path_count] = to;
    *path_count += 1;
  }
  return 1;
}

