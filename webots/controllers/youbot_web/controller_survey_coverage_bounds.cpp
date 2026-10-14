#include "controller_survey_coverage_bounds.h"

static void expand_bounds(
    double x, double y, double *min_x, double *max_x, double *min_y, double *max_y) {
  if (x < *min_x) *min_x = x;
  if (x > *max_x) *max_x = x;
  if (y < *min_y) *min_y = y;
  if (y > *max_y) *max_y = y;
}

void controller_survey_get_coverage_bounds(
    const SurveyGrid *grid,
    const ZoneData *zones,
    int room_zone_index,
    double interior_offset,
    double *min_x,
    double *max_x,
    double *min_y,
    double *max_y) {
  if (!grid || !min_x || !max_x || !min_y || !max_y) return;
  *min_x = grid->min_x + interior_offset;
  *max_x = grid->min_x + (double)(grid->width - 1) * grid->cell - interior_offset;
  *min_y = grid->min_y + interior_offset;
  *max_y = grid->min_y + (double)(grid->height - 1) * grid->cell - interior_offset;
  if (!zones || room_zone_index < 0 || room_zone_index >= zones->count) return;
  const LimitZone *room = &zones->zones[room_zone_index];
  if (room->point_count <= 0) return;
  *min_x = *max_x = room->points[0].x;
  *min_y = *max_y = room->points[0].y;
  for (int i = 1; i < room->point_count; ++i) {
    expand_bounds(room->points[i].x, room->points[i].y, min_x, max_x, min_y, max_y);
  }
  *min_x += interior_offset;
  *max_x -= interior_offset;
  *min_y += interior_offset;
  *max_y -= interior_offset;
}

void controller_survey_select_sweep_start(
    int has_low, int low_positive, double low_distance,
    int has_high, int high_positive, double high_distance,
    int *sweep_from_high, int *start_positive) {
  if (!sweep_from_high || !start_positive) return;
  *sweep_from_high = has_high && (!has_low || high_distance < low_distance);
  *start_positive = *sweep_from_high ? high_positive : low_positive;
}
