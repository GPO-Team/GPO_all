#include "controller_camera_map.h"

#include <cmath>
#include <stddef.h>

static int clamp_confidence(int confidence) {
  if (confidence < 0) return 0;
  if (confidence > 255) return 255;
  return confidence;
}

static int cell_matches(
    const MapCell *cell,
    double x,
    double y,
    double half_cell) {
  return fabs(cell->x - x) < half_cell && fabs(cell->y - y) < half_cell;
}

int controller_camera_map_append_obstacle(
    MapCell *obstacles,
    int *obstacle_count,
    int obstacle_capacity,
    MapCell *free_cells,
    int *free_count,
    double cell_size,
    double epsilon,
    double x,
    double y,
    int confidence_boost) {
  if (!obstacles || !obstacle_count || *obstacle_count < 0 ||
      ((free_cells == NULL) != (free_count == NULL)) ||
      (free_count && *free_count < 0) ||
      obstacle_capacity < 0 || cell_size <= 0.0) {
    return 0;
  }

  const double cell_x = round(x / cell_size) * cell_size;
  const double cell_y = round(y / cell_size) * cell_size;
  const double half_cell = cell_size * 0.5 + epsilon;
  const int boost = confidence_boost < 1 ? 1 : confidence_boost;

  if (free_cells && free_count) {
    int write_index = 0;
    for (int i = 0; i < *free_count; ++i) {
      if (!cell_matches(&free_cells[i], cell_x, cell_y, half_cell)) {
        free_cells[write_index++] = free_cells[i];
      }
    }
    *free_count = write_index;
  }

  for (int i = 0; i < *obstacle_count; ++i) {
    if (cell_matches(&obstacles[i], cell_x, cell_y, half_cell)) {
      obstacles[i].confidence = clamp_confidence(obstacles[i].confidence + boost);
      return 1;
    }
  }

  if (*obstacle_count >= obstacle_capacity) return 0;
  obstacles[*obstacle_count] = MapCell{cell_x, cell_y, boost};
  *obstacle_count += 1;
  return 1;
}

int controller_camera_map_append_free(
    const MapCell *obstacles,
    int obstacle_count,
    MapCell *free_cells,
    int *free_count,
    int free_capacity,
    double cell_size,
    double epsilon,
    double x,
    double y,
    int confidence_boost) {
  if (!obstacles || obstacle_count < 0 || !free_cells || !free_count ||
      *free_count < 0 || free_capacity < 0 || cell_size <= 0.0) {
    return 0;
  }

  const double cell_x = round(x / cell_size) * cell_size;
  const double cell_y = round(y / cell_size) * cell_size;
  const double half_cell = cell_size * 0.5 + epsilon;
  const int boost = confidence_boost < 1 ? 1 : confidence_boost;

  for (int i = 0; i < obstacle_count; ++i) {
    if (cell_matches(&obstacles[i], cell_x, cell_y, half_cell)) return 0;
  }

  for (int i = 0; i < *free_count; ++i) {
    if (cell_matches(&free_cells[i], cell_x, cell_y, half_cell)) {
      free_cells[i].confidence = clamp_confidence(free_cells[i].confidence + boost);
      return 1;
    }
  }

  if (*free_count >= free_capacity) return 0;
  free_cells[*free_count] = MapCell{cell_x, cell_y, boost};
  *free_count += 1;
  return 1;
}
