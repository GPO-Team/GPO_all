#include "controller_survey_geometry.h"

#include <cmath>

int controller_survey_grid_index_for_point(const SurveyGrid *grid, double x, double y) {
  if (!grid || grid->cell <= 0.0 || grid->width <= 0 || grid->height <= 0) return -1;
  int gx = (int)round((x - grid->min_x) / grid->cell);
  int gy = (int)round((y - grid->min_y) / grid->cell);
  if (gx < 0) gx = 0;
  if (gx >= grid->width) gx = grid->width - 1;
  if (gy < 0) gy = 0;
  if (gy >= grid->height) gy = grid->height - 1;
  return gy * grid->width + gx;
}

SurveyPoint controller_survey_grid_point(const SurveyGrid *grid, int index) {
  if (!grid || grid->width <= 0 || index < 0 || index >= grid->count) {
    return SurveyPoint{0.0, 0.0};
  }
  const int gx = index % grid->width;
  const int gy = index / grid->width;
  return SurveyPoint{
      grid->min_x + (double)gx * grid->cell,
      grid->min_y + (double)gy * grid->cell,
  };
}

int controller_survey_flood_component(SurveyGrid *grid, double robot_x, double robot_y) {
  if (!grid || grid->count <= 0) return 0;
  int start = controller_survey_grid_index_for_point(grid, robot_x, robot_y);
  if (start < 0) return 0;
  if (!grid->free_cell[start]) {
    double best_dist = 1e30;
    for (int i = 0; i < grid->count; ++i) {
      if (!grid->free_cell[i]) continue;
      const SurveyPoint point = controller_survey_grid_point(grid, i);
      const double dist = hypot(point.x - robot_x, point.y - robot_y);
      if (dist < best_dist) {
        best_dist = dist;
        start = i;
      }
    }
    if (!grid->free_cell[start]) return 0;
  }

  int head = 0;
  int tail = 0;
  grid->queue[tail++] = start;
  grid->component_cell[start] = 1;
  int component_count = 0;
  const int dx[4] = {1, -1, 0, 0};
  const int dy[4] = {0, 0, 1, -1};
  while (head < tail) {
    const int current = grid->queue[head++];
    component_count += 1;
    const int cx = current % grid->width;
    const int cy = current / grid->width;
    for (int direction = 0; direction < 4; ++direction) {
      const int nx = cx + dx[direction];
      const int ny = cy + dy[direction];
      if (nx < 0 || nx >= grid->width || ny < 0 || ny >= grid->height) continue;
      const int neighbor = ny * grid->width + nx;
      if (!grid->free_cell[neighbor] || grid->component_cell[neighbor]) continue;
      grid->component_cell[neighbor] = 1;
      grid->queue[tail++] = neighbor;
    }
  }
  return component_count;
}

int controller_survey_cell_is_boundary(const SurveyGrid *grid, int index) {
  if (!grid || index < 0 || index >= grid->count || !grid->component_cell[index]) return 0;
  const int cx = index % grid->width;
  const int cy = index / grid->width;
  for (int oy = -1; oy <= 1; ++oy) {
    for (int ox = -1; ox <= 1; ++ox) {
      if (ox == 0 && oy == 0) continue;
      const int nx = cx + ox;
      const int ny = cy + oy;
      if (nx < 0 || nx >= grid->width || ny < 0 || ny >= grid->height) return 1;
      if (!grid->component_cell[ny * grid->width + nx]) return 1;
    }
  }
  return 0;
}
