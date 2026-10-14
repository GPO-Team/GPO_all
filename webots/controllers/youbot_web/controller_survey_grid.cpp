#include "controller_survey_grid.h"

#include <cmath>
#include <stddef.h>
#include <string.h>

static double clamp_value(double value, double minimum, double maximum) {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

static void expand_bounds(
    double x,
    double y,
    double *min_x,
    double *max_x,
    double *min_y,
    double *max_y) {
  if (x < *min_x) *min_x = x;
  if (x > *max_x) *max_x = x;
  if (y < *min_y) *min_y = y;
  if (y > *max_y) *max_y = y;
}

int controller_survey_grid_build(
    SurveyGrid *grid,
    const ControllerSurveyGridConfig *config,
    const ControllerSurveyGridInput *input,
    ControllerSurveyPointSafeFn point_is_safe,
    void *context) {
  if (!grid || !config || !input || !point_is_safe || config->base_cell <= 0.0 ||
      config->max_cells <= 0 || config->max_cells > MAPPING_SURVEY_MAX_GRID_CELLS) {
    return 0;
  }

  double min_x = input->has_field_bounds ? input->field_min_x : config->default_min_x;
  double max_x = input->has_field_bounds ? input->field_max_x : config->default_max_x;
  double min_y = input->has_field_bounds ? input->field_min_y : config->default_min_y;
  double max_y = input->has_field_bounds ? input->field_max_y : config->default_max_y;

  expand_bounds(input->robot_x, input->robot_y, &min_x, &max_x, &min_y, &max_y);
  if (input->zones && input->room_zone_index >= 0 &&
      input->room_zone_index < input->zones->count) {
    const LimitZone *room = &input->zones->zones[input->room_zone_index];
    if (room->point_count > 0) {
      min_x = max_x = room->points[0].x;
      min_y = max_y = room->points[0].y;
      for (int i = 1; i < room->point_count; ++i) {
        expand_bounds(room->points[i].x, room->points[i].y, &min_x, &max_x, &min_y, &max_y);
      }
    }
  } else {
    if (input->zones) {
      for (int zone_index = 0; zone_index < input->zones->count; ++zone_index) {
        const LimitZone *zone = &input->zones->zones[zone_index];
        for (int point_index = 0; point_index < zone->point_count; ++point_index) {
          expand_bounds(
              zone->points[point_index].x,
              zone->points[point_index].y,
              &min_x,
              &max_x,
              &min_y,
              &max_y);
        }
      }
    }
    for (int i = 0; input->map && i < input->map_count; ++i) {
      expand_bounds(input->map[i].x, input->map[i].y, &min_x, &max_x, &min_y, &max_y);
    }
  }

  const double margin = input->clearance + 1.0;
  min_x = clamp_value(min_x - margin, -config->max_extent_x, config->max_extent_x);
  max_x = clamp_value(max_x + margin, -config->max_extent_x, config->max_extent_x);
  min_y = clamp_value(min_y - margin, -config->max_extent_y, config->max_extent_y);
  max_y = clamp_value(max_y + margin, -config->max_extent_y, config->max_extent_y);

  double cell = config->base_cell;
  int width = (int)ceil((max_x - min_x) / cell) + 1;
  int height = (int)ceil((max_y - min_y) / cell) + 1;
  while (width * height > config->max_cells) {
    cell *= 1.18;
    width = (int)ceil((max_x - min_x) / cell) + 1;
    height = (int)ceil((max_y - min_y) / cell) + 1;
  }

  grid->min_x = min_x;
  grid->min_y = min_y;
  grid->cell = cell;
  grid->width = width;
  grid->height = height;
  grid->count = width * height;
  memset(grid->free_cell, 0, (size_t)grid->count);
  memset(grid->component_cell, 0, (size_t)grid->count);

  for (int y = 0; y < height; ++y) {
    for (int x = 0; x < width; ++x) {
      const int index = y * width + x;
      const double world_x = min_x + (double)x * cell;
      const double world_y = min_y + (double)y * cell;
      grid->free_cell[index] = point_is_safe(
          context,
          world_x,
          world_y,
          input->room_zone_index,
          input->clearance) ? 1 : 0;
    }
  }

  return grid->count > 0;
}
