#include "controller_mapping_survey_coverage_service.h"

#include "controller_survey_coverage.h"
#include "controller_survey_coverage_bounds.h"
#include "controller_survey_geometry.h"

typedef struct {
  const ControllerMappingSurveyCoverageService *service;
  SurveyGrid *grid;
  SurveyPoint *route;
  int *route_count;
  int room_zone_index;
  double interval_min;
  double interval_max;
  int vertical;
} CoverageContext;

static int build_intervals(
    void *context,
    double coordinate,
    SurveyInterval *intervals,
    int capacity) {
  CoverageContext *coverage = static_cast<CoverageContext *>(context);
  const ControllerMappingSurveyCoverageService *service = coverage->service;
  SurveyInterval raw[64];
  const int raw_count = coverage->vertical
                            ? controller_survey_build_vertical_intervals(
                                  coordinate, coverage->room_zone_index, coverage->grid,
                                  service->safety.zones, service->safety.persistent_map,
                                  service->safety.persistent_map_count,
                                  service->interior_offset, service->min_strip_length,
                                  service->epsilon, raw, 64)
                            : controller_survey_build_horizontal_intervals(
                                  coordinate, coverage->room_zone_index, coverage->grid,
                                  service->safety.zones, service->safety.persistent_map,
                                  service->safety.persistent_map_count,
                                  service->interior_offset, service->min_strip_length,
                                  service->epsilon, raw, 64);
  return controller_survey_clip_intervals(
      raw, raw_count, coverage->interval_min, coverage->interval_max,
      service->min_strip_length, intervals, capacity);
}

static void append_transition(CoverageContext *coverage, SurveyPoint target) {
  const ControllerMappingSurveyCoverageService *service = coverage->service;
  if (*coverage->route_count <= 0) {
    controller_survey_route_add(
        coverage->route, coverage->route_count, service->route_capacity,
        service->route_spacing, target.x, target.y);
    return;
  }
  const SurveyPoint from = coverage->route[*coverage->route_count - 1];
  if (controller_mapping_survey_runtime_segment_safe(
          &service->safety, from.x, from.y, target.x, target.y,
          coverage->room_zone_index, service->interior_offset)) {
    controller_survey_route_add(
        coverage->route, coverage->route_count, service->route_capacity,
        service->route_spacing, target.x, target.y);
    return;
  }
  SurveyPoint path[256];
  int path_count = 0;
  if (coverage->grid && controller_survey_find_grid_path(
      coverage->grid, from, target, path, &path_count, 256)) {
    for (int index = 1; index < path_count; ++index) {
      controller_survey_route_add(
          coverage->route, coverage->route_count, service->route_capacity,
          service->route_spacing, path[index].x, path[index].y);
    }
  }
}

static void append_segment(void *context, SurveyPoint start, SurveyPoint end) {
  CoverageContext *coverage = static_cast<CoverageContext *>(context);
  const ControllerMappingSurveyCoverageService *service = coverage->service;
  if (!controller_mapping_survey_runtime_point_safe(
          &service->safety, start.x, start.y, coverage->room_zone_index,
          service->interior_offset) ||
      !controller_mapping_survey_runtime_point_safe(
          &service->safety, end.x, end.y, coverage->room_zone_index,
          service->interior_offset)) {
    return;
  }
  append_transition(coverage, start);
  if (controller_mapping_survey_runtime_segment_safe(
          &service->safety, start.x, start.y, end.x, end.y,
          coverage->room_zone_index, service->interior_offset)) {
    controller_survey_route_add(
        coverage->route, coverage->route_count, service->route_capacity,
        service->route_spacing, end.x, end.y);
  } else {
    append_transition(coverage, end);
  }
}

static void append_coverage(
    const ControllerMappingSurveyCoverageService *service,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index,
    int vertical) {
  if (!service || !service->safety.zones || !grid || !route || !route_count ||
      room_zone_index < 0 || room_zone_index >= service->safety.zones->count) {
    return;
  }
  double min_x = 0.0;
  double max_x = 0.0;
  double min_y = 0.0;
  double max_y = 0.0;
  controller_survey_get_coverage_bounds(
      grid, service->safety.zones, room_zone_index, service->interior_offset,
      &min_x, &max_x, &min_y, &max_y);
  const SurveyPoint current = *route_count > 0 ? route[*route_count - 1] : SurveyPoint{min_x, min_y};
  CoverageContext context = {
      service, grid, route, route_count, room_zone_index,
      vertical ? min_y : min_x, vertical ? max_y : max_x, vertical};
  controller_survey_append_best_axis_coverage(
      vertical ? min_x : min_y, vertical ? max_x : max_y,
      service->strip_spacing, vertical, current,
      route_count, service->route_capacity, 64,
      build_intervals, append_segment, &context);
}

void controller_mapping_survey_coverage_service_append_horizontal(
    const ControllerMappingSurveyCoverageService *service,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index) {
  append_coverage(service, grid, route, route_count, room_zone_index, 0);
}

void controller_mapping_survey_coverage_service_append_vertical(
    const ControllerMappingSurveyCoverageService *service,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index) {
  append_coverage(service, grid, route, route_count, room_zone_index, 1);
}
