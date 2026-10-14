#include "controller_survey_geometry.h"
#include "controller_survey_intervals.h"

#include <cmath>

static double zone_primary(const LimitZone *zone, int index, int vertical) {
  return vertical ? zone->points[index].x : zone->points[index].y;
}

static double zone_secondary(const LimitZone *zone, int index, int vertical) {
  return vertical ? zone->points[index].y : zone->points[index].x;
}

static void subtract_zone_band(
    SurveyInterval *intervals,
    int *count,
    int capacity,
    const LimitZone *zone,
    double coordinate,
    double clearance,
    double epsilon,
    int vertical) {
  if (!intervals || !count || !zone || zone->point_count < 3 || *count <= 0) return;

  double min_primary = zone_primary(zone, 0, vertical);
  double max_primary = min_primary;
  double near_min = 1e30;
  double near_max = -1e30;
  int near_band_hit = 0;
  for (int i = 0; i < zone->point_count; ++i) {
    const double primary = zone_primary(zone, i, vertical);
    const double secondary = zone_secondary(zone, i, vertical);
    if (primary < min_primary) min_primary = primary;
    if (primary > max_primary) max_primary = primary;
    if (fabs(primary - coordinate) <= clearance) {
      if (secondary < near_min) near_min = secondary;
      if (secondary > near_max) near_max = secondary;
      near_band_hit = 1;
    }
  }
  if (coordinate < min_primary - clearance || coordinate > max_primary + clearance) return;

  static const double sample_offsets[] = {-1.0, -0.5, 0.0, 0.5, 1.0};
  for (int sample_index = 0; sample_index < 5; ++sample_index) {
    const double sample = coordinate + sample_offsets[sample_index] * clearance;
    double intersections[MAX_ZONE_POINTS];
    int intersection_count = 0;
    for (int i = 0; i < zone->point_count; ++i) {
      const int next = (i + 1) % zone->point_count;
      const double primary_a = zone_primary(zone, i, vertical);
      const double secondary_a = zone_secondary(zone, i, vertical);
      const double primary_b = zone_primary(zone, next, vertical);
      const double secondary_b = zone_secondary(zone, next, vertical);
      if (fabs(primary_a - primary_b) < epsilon) {
        if (fabs(primary_a - coordinate) <= clearance) {
          if (fmin(secondary_a, secondary_b) < near_min) near_min = fmin(secondary_a, secondary_b);
          if (fmax(secondary_a, secondary_b) > near_max) near_max = fmax(secondary_a, secondary_b);
          near_band_hit = 1;
        }
        continue;
      }
      if ((primary_a <= sample && primary_b > sample) ||
          (primary_b <= sample && primary_a > sample)) {
        intersections[intersection_count++] =
            secondary_a + (sample - primary_a) * (secondary_b - secondary_a) /
                (primary_b - primary_a);
      }
    }
    controller_survey_sort_values(intersections, intersection_count);
    for (int i = 0; i + 1 < intersection_count; i += 2) {
      controller_survey_subtract_interval(
          intervals,
          count,
          capacity,
          intersections[i] - clearance,
          intersections[i + 1] + clearance);
    }
  }
  if (near_band_hit && near_max >= near_min) {
    controller_survey_subtract_interval(
        intervals, count, capacity, near_min - clearance, near_max + clearance);
  }
}

void controller_survey_subtract_zone_horizontal_band(
    SurveyInterval *intervals,
    int *count,
    int capacity,
    const LimitZone *zone,
    double y,
    double clearance,
    double epsilon) {
  subtract_zone_band(intervals, count, capacity, zone, y, clearance, epsilon, 0);
}

void controller_survey_subtract_zone_vertical_band(
    SurveyInterval *intervals,
    int *count,
    int capacity,
    const LimitZone *zone,
    double x,
    double clearance,
    double epsilon) {
  subtract_zone_band(intervals, count, capacity, zone, x, clearance, epsilon, 1);
}

static int build_axis_intervals(
    double coordinate,
    int room_zone_index,
    const SurveyGrid *grid,
    const ZoneData *zones,
    const MapCell *map,
    int map_count,
    double interior_offset,
    double min_strip_length,
    double epsilon,
    SurveyInterval *intervals,
    int capacity,
    int vertical) {
  if (!intervals || capacity <= 0) return 0;
  int count = 0;
  if (zones && room_zone_index >= 0 && room_zone_index < zones->count) {
    const LimitZone *room = &zones->zones[room_zone_index];
    double intersections[MAX_ZONE_POINTS];
    int intersection_count = 0;
    for (int i = 0; i < room->point_count; ++i) {
      const int next = (i + 1) % room->point_count;
      const double primary_a = zone_primary(room, i, vertical);
      const double secondary_a = zone_secondary(room, i, vertical);
      const double primary_b = zone_primary(room, next, vertical);
      const double secondary_b = zone_secondary(room, next, vertical);
      if (fabs(primary_a - primary_b) < epsilon) continue;
      if ((primary_a <= coordinate && primary_b > coordinate) ||
          (primary_b <= coordinate && primary_a > coordinate)) {
        intersections[intersection_count++] =
            secondary_a + (coordinate - primary_a) * (secondary_b - secondary_a) /
                (primary_b - primary_a);
      }
    }
    controller_survey_sort_values(intersections, intersection_count);
    for (int i = 0; i + 1 < intersection_count && count < capacity; i += 2) {
      const double start = intersections[i] + interior_offset;
      const double end = intersections[i + 1] - interior_offset;
      if (end - start >= min_strip_length) intervals[count++] = SurveyInterval{start, end};
    }
  } else if (grid) {
    const double grid_origin = vertical ? grid->min_x : grid->min_y;
    const int fixed = (int)round((coordinate - grid_origin) / grid->cell);
    const int fixed_limit = vertical ? grid->width : grid->height;
    const int run_limit = vertical ? grid->height : grid->width;
    const double run_origin = vertical ? grid->min_y : grid->min_x;
    if (fixed >= 0 && fixed < fixed_limit) {
      int run_start = -1;
      for (int run = 0; run <= run_limit; ++run) {
        const int index = vertical ? run * grid->width + fixed : fixed * grid->width + run;
        const int in_component = run < run_limit && grid->component_cell[index];
        if (in_component && run_start < 0) run_start = run;
        if ((!in_component || run == run_limit) && run_start >= 0) {
          const int run_end = run - 1;
          const double start = run_origin + (double)run_start * grid->cell + interior_offset;
          const double end = run_origin + (double)run_end * grid->cell - interior_offset;
          if (end - start >= min_strip_length && count < capacity) {
            intervals[count++] = SurveyInterval{start, end};
          }
          run_start = -1;
        }
      }
    }
  }

  if (zones) {
    for (int zone_index = 0; zone_index < zones->count; ++zone_index) {
      if (zone_index == room_zone_index) continue;
      subtract_zone_band(
          intervals,
          &count,
          capacity,
          &zones->zones[zone_index],
          coordinate,
          interior_offset,
          epsilon,
          vertical);
    }
  }
  for (int i = 0; map && i < map_count; ++i) {
    const double primary = vertical ? map[i].x : map[i].y;
    const double secondary = vertical ? map[i].y : map[i].x;
    if (fabs(primary - coordinate) > interior_offset) continue;
    controller_survey_subtract_interval(
        intervals,
        &count,
        capacity,
        secondary - interior_offset,
        secondary + interior_offset);
  }

  int write = 0;
  for (int i = 0; i < count; ++i) {
    if (intervals[i].end - intervals[i].start < min_strip_length) continue;
    intervals[write++] = intervals[i];
  }
  return write;
}

int controller_survey_build_horizontal_intervals(
    double y,
    int room_zone_index,
    const SurveyGrid *grid,
    const ZoneData *zones,
    const MapCell *map,
    int map_count,
    double interior_offset,
    double min_strip_length,
    double epsilon,
    SurveyInterval *intervals,
    int capacity) {
  return build_axis_intervals(
      y, room_zone_index, grid, zones, map, map_count, interior_offset,
      min_strip_length, epsilon, intervals, capacity, 0);
}

int controller_survey_build_vertical_intervals(
    double x,
    int room_zone_index,
    const SurveyGrid *grid,
    const ZoneData *zones,
    const MapCell *map,
    int map_count,
    double interior_offset,
    double min_strip_length,
    double epsilon,
    SurveyInterval *intervals,
    int capacity) {
  return build_axis_intervals(
      x, room_zone_index, grid, zones, map, map_count, interior_offset,
      min_strip_length, epsilon, intervals, capacity, 1);
}

