#include "controller_mapping_survey_safety_service.h"

#include <assert.h>

int main(void) {
  ControllerRuntime runtime;
  ControllerMappingRuntime mapping_runtime;
  ControllerPerceptionRuntime perception_runtime;
  controller_runtime_init(&runtime);
  controller_mapping_runtime_init(&mapping_runtime, NULL);
  controller_perception_runtime_init(&perception_runtime);

  runtime.route.count = 1;
  runtime.route.waypoints[0] = Waypoint{2.0, 0.0, 0.0, 0};
  runtime.mapping_survey.route_active = 1;

  ControllerMappingSurveySafetyService service;
  controller_mapping_survey_safety_service_init(
      &service,
      &runtime,
      &mapping_runtime,
      &perception_runtime,
      ControllerMappingSurveySafetyServiceConfig{6.0, 0.18, 22.0, 17.0, 0.45, 0.25});

  assert(controller_mapping_survey_safety_service_point_safe(
      &service, 0.0, 0.0, -1, 0.3, 0.0));
  assert(controller_mapping_survey_safety_service_scan_point_allowed(
      &service, 0.0, 0.0, -1, 0.3, 0.2, 0.0));
  assert(controller_mapping_survey_safety_service_find_escape_waypoint(
      &service, 0.0, 0.0, 0, 0.7, 10, 0.58, 0.46, 0.25, 0.0) == -1);
  return 0;
}
