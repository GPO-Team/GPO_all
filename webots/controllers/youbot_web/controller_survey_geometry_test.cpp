#include "controller_survey_geometry.h"
#include "controller_survey_intervals.h"
#include "controller_survey_coverage_bounds.h"

#include <cmath>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  double min_x = 10.0;
  double max_x = -10.0;
  double min_y = 8.0;
  double max_y = -8.0;
  controller_survey_expand_bounds(2.0, -3.0, &min_x, &max_x, &min_y, &max_y);
  if (!nearly_equal(min_x, 2.0) || !nearly_equal(max_x, 2.0) ||
      !nearly_equal(min_y, -3.0) || !nearly_equal(max_y, -3.0)) {
    return 1;
  }

  SurveyPoint route[4];
  int route_count = 0;
  controller_survey_route_add(route, &route_count, 4, 0.18, 0.0, 0.0);
  controller_survey_route_add(route, &route_count, 4, 0.18, 0.10, 0.0);
  if (route_count != 1 || !nearly_equal(route[0].x, 0.10)) return 2;
  controller_survey_route_add(route, &route_count, 4, 0.18, 1.0, 0.0);
  if (route_count != 2) return 3;

  route_count = 0;
  controller_survey_route_add_segment(
      route, &route_count, 4, 0.18, 1.45,
      SurveyPoint{0.0, 0.0}, SurveyPoint{3.0, 0.0});
  if (route_count != 3 || !nearly_equal(route[0].x, 1.0) ||
      !nearly_equal(route[1].x, 2.0) || !nearly_equal(route[2].x, 3.0)) {
    return 4;
  }

  double values[] = {3.0, -1.0, 2.0, 2.0};
  controller_survey_sort_values(values, 4);
  if (!nearly_equal(values[0], -1.0) || !nearly_equal(values[1], 2.0) ||
      !nearly_equal(values[2], 2.0) || !nearly_equal(values[3], 3.0)) {
    return 5;
  }

  SurveyInterval intervals[4] = {{0.0, 10.0}};
  int interval_count = 1;
  controller_survey_subtract_interval(intervals, &interval_count, 4, 7.0, 3.0);
  if (interval_count != 2 || !nearly_equal(intervals[0].start, 0.0) ||
      !nearly_equal(intervals[0].end, 3.0) || !nearly_equal(intervals[1].start, 7.0) ||
      !nearly_equal(intervals[1].end, 10.0)) {
    return 6;
  }

  static SurveyGrid grid;
  grid.min_x = 0.0;
  grid.min_y = 0.0;
  grid.cell = 1.0;
  grid.width = 3;
  grid.height = 3;
  grid.count = 9;
  if (controller_survey_grid_index_for_point(&grid, 1.6, -1.0) != 2) return 7;
  const SurveyPoint grid_point = controller_survey_grid_point(&grid, 5);
  if (!nearly_equal(grid_point.x, 2.0) || !nearly_equal(grid_point.y, 1.0)) return 8;

  grid.free_cell[1] = 1;
  grid.free_cell[4] = 1;
  grid.free_cell[7] = 1;
  if (controller_survey_flood_component(&grid, 1.0, 1.0) != 3) return 9;
  if (!grid.component_cell[1] || !grid.component_cell[4] || !grid.component_cell[7]) return 10;
  if (!controller_survey_cell_is_boundary(&grid, 4)) return 11;

  for (int i = 0; i < 9; ++i) grid.component_cell[i] = 1;
  if (controller_survey_cell_is_boundary(&grid, 4)) return 12;
  if (!controller_survey_cell_is_boundary(&grid, 0)) return 13;

  const SurveyPoint nearly_straight[] = {{0.0, 0.0}, {1.0, 0.1}, {2.0, 0.0}};
  unsigned char keep[3] = {1, 0, 1};
  controller_survey_rdp_keep(nearly_straight, 0, 2, 0.34, keep);
  if (keep[1]) return 14;
  const SurveyPoint bent[] = {{0.0, 0.0}, {1.0, 1.0}, {2.0, 0.0}};
  controller_survey_rdp_keep(bent, 0, 2, 0.34, keep);
  if (!keep[1]) return 15;

  static SurveyGrid path_grid;
  path_grid.min_x = 0.0;
  path_grid.min_y = 0.0;
  path_grid.cell = 1.0;
  path_grid.width = 5;
  path_grid.height = 1;
  path_grid.count = 5;
  for (int i = 0; i < 5; ++i) path_grid.component_cell[i] = 1;
  SurveyPoint path[8];
  int path_count = 0;
  if (!controller_survey_find_grid_path(
          &path_grid, SurveyPoint{0.0, 0.0}, SurveyPoint{4.0, 0.0},
          path, &path_count, 8)) {
    return 16;
  }
  if (path_count != 3 || !nearly_equal(path[0].x, 0.0) ||
      !nearly_equal(path[1].x, 3.0) || !nearly_equal(path[2].x, 4.0)) {
    return 17;
  }
  path_grid.component_cell[4] = 0;
  if (controller_survey_find_grid_path(
          &path_grid, SurveyPoint{0.0, 0.0}, SurveyPoint{4.0, 0.0},
          path, &path_count, 8)) {
    return 18;
  }

  static SurveyGrid long_path_grid;
  long_path_grid.min_x = 0.0;
  long_path_grid.min_y = 0.0;
  long_path_grid.cell = 1.0;
  long_path_grid.width = 1500;
  long_path_grid.height = 1;
  long_path_grid.count = 1500;
  for (int i = 0; i < long_path_grid.count; ++i) {
    long_path_grid.component_cell[i] = 1;
  }
  SurveyPoint long_path[600];
  int long_path_count = 0;
  if (!controller_survey_find_grid_path(
          &long_path_grid, SurveyPoint{0.0, 0.0}, SurveyPoint{1499.0, 0.0},
          long_path, &long_path_count, 600)) {
    return 25;
  }
  if (long_path_count <= 1 || !nearly_equal(long_path[0].x, 0.0) ||
      !nearly_equal(long_path[long_path_count - 1].x, 1499.0)) {
    return 26;
  }

  long_path_count = 0;
  if (controller_survey_find_grid_path(
          &long_path_grid, SurveyPoint{0.0, 0.0}, SurveyPoint{1499.0, 0.0},
          long_path, &long_path_count, 100)) {
    return 27;
  }

  static SurveyGrid boundary_grid;
  boundary_grid.min_x = 0.0;
  boundary_grid.min_y = 0.0;
  boundary_grid.cell = 1.0;
  boundary_grid.width = 4;
  boundary_grid.height = 4;
  boundary_grid.count = 16;
  for (int i = 0; i < 16; ++i) boundary_grid.component_cell[i] = 1;
  SurveyPoint boundary_route[64];
  int boundary_route_count = 0;
  if (!controller_survey_append_boundary_contour(
          &boundary_grid, boundary_route, &boundary_route_count, 64, 64,
          0.0, 0.0, 0.18, 1.45, 3.2, 0.34)) {
    return 19;
  }
  if (boundary_route_count < 3) return 20;

  const SurveyInterval raw_intervals[] = {{-2.0, 2.0}, {3.0, 3.4}, {4.0, 8.0}};
  SurveyInterval clipped[4];
  int clipped_count = controller_survey_clip_intervals(
      raw_intervals, 3, -1.0, 6.0, 0.65, clipped, 4);
  if (clipped_count != 2 || !nearly_equal(clipped[0].start, -1.0) ||
      !nearly_equal(clipped[0].end, 2.0) || !nearly_equal(clipped[1].start, 4.0) ||
      !nearly_equal(clipped[1].end, 6.0)) {
    return 21;
  }
  controller_survey_reverse_intervals(clipped, clipped_count);
  if (!nearly_equal(clipped[0].start, 4.0) || !nearly_equal(clipped[1].start, -1.0)) return 22;

  int start_from_low = 0;
  double start_distance = 0.0;
  controller_survey_choose_snake_start(
      SurveyPoint{0.0, 0.0}, SurveyPoint{-1.0, 0.0}, SurveyPoint{3.0, 0.0},
      &start_from_low, &start_distance);
  if (!start_from_low || !nearly_equal(start_distance, 1.0)) return 23;
  controller_survey_choose_snake_start(
      SurveyPoint{3.0, 0.0}, SurveyPoint{-1.0, 0.0}, SurveyPoint{3.0, 0.0},
      &start_from_low, &start_distance);
  if (start_from_low || !nearly_equal(start_distance, 0.0)) return 24;

  LimitZone obstacle = {0};
  obstacle.point_count = 4;
  obstacle.points[0].x = -1.0;
  obstacle.points[0].y = -1.0;
  obstacle.points[1].x = 1.0;
  obstacle.points[1].y = -1.0;
  obstacle.points[2].x = 1.0;
  obstacle.points[2].y = 1.0;
  obstacle.points[3].x = -1.0;
  obstacle.points[3].y = 1.0;

  SurveyInterval horizontal[4] = {{-3.0, 3.0}};
  int horizontal_count = 1;
  controller_survey_subtract_zone_horizontal_band(
      horizontal, &horizontal_count, 4, &obstacle, 0.0, 0.2, 1e-9);
  if (horizontal_count != 2 || !nearly_equal(horizontal[0].end, -1.2) ||
      !nearly_equal(horizontal[1].start, 1.2)) {
    return 28;
  }

  SurveyInterval vertical[4] = {{-3.0, 3.0}};
  int vertical_count = 1;
  controller_survey_subtract_zone_vertical_band(
      vertical, &vertical_count, 4, &obstacle, 0.0, 0.2, 1e-9);
  if (vertical_count != 2 || !nearly_equal(vertical[0].end, -1.2) ||
      !nearly_equal(vertical[1].start, 1.2)) {
    return 29;
  }

  ZoneData coverage_zones = {0};
  coverage_zones.count = 1;
  coverage_zones.zones[0] = obstacle;
  SurveyInterval coverage[4];
  const int horizontal_coverage_count = controller_survey_build_horizontal_intervals(
      0.0, 0, NULL, &coverage_zones, NULL, 0, 0.2, 0.5, 1e-9, coverage, 4);
  if (horizontal_coverage_count != 1 ||
      !nearly_equal(coverage[0].start, -0.8) ||
      !nearly_equal(coverage[0].end, 0.8)) {
    return 30;
  }
  const int vertical_coverage_count = controller_survey_build_vertical_intervals(
      0.0, 0, NULL, &coverage_zones, NULL, 0, 0.2, 0.5, 1e-9, coverage, 4);
  if (vertical_coverage_count != 1 ||
      !nearly_equal(coverage[0].start, -0.8) ||
      !nearly_equal(coverage[0].end, 0.8)) {
    return 31;
  }

  double coverage_min_x = 0.0;
  double coverage_max_x = 0.0;
  double coverage_min_y = 0.0;
  double coverage_max_y = 0.0;
  controller_survey_get_coverage_bounds(
      &grid, NULL, -1, 0.2,
      &coverage_min_x, &coverage_max_x, &coverage_min_y, &coverage_max_y);
  if (!nearly_equal(coverage_min_x, 0.2) || !nearly_equal(coverage_max_x, 1.8) ||
      !nearly_equal(coverage_min_y, 0.2) || !nearly_equal(coverage_max_y, 1.8)) {
    return 32;
  }
  controller_survey_get_coverage_bounds(
      &grid, &coverage_zones, 0, 0.2,
      &coverage_min_x, &coverage_max_x, &coverage_min_y, &coverage_max_y);
  if (!nearly_equal(coverage_min_x, -0.8) || !nearly_equal(coverage_max_x, 0.8) ||
      !nearly_equal(coverage_min_y, -0.8) || !nearly_equal(coverage_max_y, 0.8)) {
    return 33;
  }

  int sweep_from_high = 0;
  int start_positive = 0;
  controller_survey_select_sweep_start(
      1, 1, 4.0, 1, 0, 2.0, &sweep_from_high, &start_positive);
  if (!sweep_from_high || start_positive) return 34;

  LimitZone contour_room = {0};
  contour_room.point_count = 4;
  contour_room.points[0].x = -2.0;
  contour_room.points[0].y = -2.0;
  contour_room.points[1].x = 2.0;
  contour_room.points[1].y = -2.0;
  contour_room.points[2].x = 2.0;
  contour_room.points[2].y = 2.0;
  contour_room.points[3].x = -2.0;
  contour_room.points[3].y = 2.0;
  SurveyPoint inset_contour[4];
  int inset_count = 0;
  if (!controller_survey_build_offset_contour(
          &contour_room, 0.5, inset_contour, 4, &inset_count)) {
    return 35;
  }
  if (inset_count != 4 || !nearly_equal(inset_contour[0].x, -1.5) ||
      !nearly_equal(inset_contour[0].y, -1.5) ||
      !nearly_equal(inset_contour[2].x, 1.5) ||
      !nearly_equal(inset_contour[2].y, 1.5)) {
    return 36;
  }
  if (controller_survey_nearest_point_index(
          inset_contour, inset_count, 1.4, 1.4) != 2) {
    return 37;
  }

  return 0;
}
