#include "controller_mapping_survey_safety_service.h"

#include "controller_mapping_survey_escape.h"
#include "controller_mapping_survey_escape_safety.h"

typedef struct {
  const ControllerMappingSurveySafetyService *service;
  SurveyPoint robot;
  double now;
  double obstacle_clearance;
  double segment_clearance;
  double ignore_radius;
} ControllerMappingSurveyEscapeServiceContext;

void controller_mapping_survey_safety_service_init(
    ControllerMappingSurveySafetyService *service,
    const ControllerRuntime *runtime,
    const ControllerMappingRuntime *mapping_runtime,
    const ControllerPerceptionRuntime *perception_runtime,
    ControllerMappingSurveySafetyServiceConfig config) {
  if (!service) return;
  *service = ControllerMappingSurveySafetyService{
      runtime,
      mapping_runtime,
      perception_runtime,
      config,
  };
}

ControllerMappingSurveySafetyContext controller_mapping_survey_safety_service_context(
    const ControllerMappingSurveySafetyService *service,
    double now) {
  if (!service || !service->runtime || !service->mapping_runtime || !service->perception_runtime) {
    return ControllerMappingSurveySafetyContext{0};
  }
  const ControllerMappingStore *store = &service->mapping_runtime->store;
  return ControllerMappingSurveySafetyContext{
      &service->runtime->limit_zones,
      store->persistent_map,
      store->persistent_count,
      service->perception_runtime->trace,
      service->perception_runtime->trace_count,
      now,
      service->config.trace_ttl_seconds,
      service->config.trace_clearance,
      service->config.max_extent_x,
      service->config.max_extent_y,
      service->config.obstacle_clearance,
      service->config.grid_cell,
  };
}

int controller_mapping_survey_safety_service_point_safe(
    const ControllerMappingSurveySafetyService *service,
    double x,
    double y,
    int room_zone_index,
    double clearance,
    double now) {
  const ControllerMappingSurveySafetyContext context =
      controller_mapping_survey_safety_service_context(service, now);
  return controller_mapping_survey_runtime_point_safe(&context, x, y, room_zone_index, clearance);
}

int controller_mapping_survey_safety_service_scan_point_allowed(
    const ControllerMappingSurveySafetyService *service,
    double x,
    double y,
    int room_zone_index,
    double boundary_clearance,
    double obstacle_clearance,
    double now) {
  const ControllerMappingSurveySafetyContext context =
      controller_mapping_survey_safety_service_context(service, now);
  return controller_mapping_survey_runtime_scan_point_allowed(
      &context, x, y, room_zone_index, boundary_clearance, obstacle_clearance);
}

static int escape_candidate_allowed(void *context, const Waypoint *candidate) {
  const ControllerMappingSurveyEscapeServiceContext *escape = static_cast<const ControllerMappingSurveyEscapeServiceContext *>(context);
  if (!escape || !candidate || !escape->service || !escape->service->runtime) return 0;
  const ControllerMappingSurveyEscapeSafetyContext safety = {
      controller_mapping_survey_safety_service_context(escape->service, escape->now),
      escape->service->runtime->mapping_survey.room_zone_index,
      escape->service->config.grid_cell,
      escape->obstacle_clearance,
      escape->segment_clearance,
      escape->ignore_radius,
  };
  return controller_mapping_survey_escape_candidate_allowed(&safety, escape->robot, candidate);
}

int controller_mapping_survey_safety_service_find_escape_waypoint(
    const ControllerMappingSurveySafetyService *service,
    double robot_x,
    double robot_y,
    int start_index,
    double minimum_distance,
    int scan_ahead,
    double obstacle_clearance,
    double segment_clearance,
    double ignore_radius,
    double now) {
  if (!service || !service->runtime) return -1;
  const ControllerMappingSurveyEscapeInput input = {
      &service->runtime->route,
      service->runtime->mapping_survey.route_active,
      start_index,
      robot_x,
      robot_y,
      minimum_distance,
      scan_ahead,
  };
  const ControllerMappingSurveyEscapeServiceContext context = {
      service,
      {robot_x, robot_y},
      now,
      obstacle_clearance,
      segment_clearance,
      ignore_radius,
  };
  return controller_mapping_survey_find_escape_waypoint(
      &input, escape_candidate_allowed, (void *)&context);
}
