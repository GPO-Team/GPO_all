#include "controller_mapping_survey_route_generation_service.h"

static void report_failure(
    const ControllerMappingSurveyRouteGenerationService *service,
    ControllerSurveyGenerateResult result) {
  if (!service || !service->set_error) return;
  if (result == CONTROLLER_SURVEY_GENERATE_GRID_FAILED) {
    service->set_error("Cannot build mapping survey occupancy grid");
  } else if (result == CONTROLLER_SURVEY_GENERATE_NO_COMPONENT) {
    service->set_error("Cannot find connected free room for mapping survey");
  } else if (result == CONTROLLER_SURVEY_GENERATE_EMPTY_ROUTE) {
    service->set_error("Mapping survey route is empty");
  }
}

int controller_mapping_survey_route_generation_service_generate(
    const ControllerMappingSurveyRouteGenerationService *service,
    int clear_map_before_start,
    MappingSurveyMode survey_mode,
    int *room_zone_index,
    int *interior_start_index) {
  if (!service) return 0;
  const ControllerSurveyGenerateResult result = controller_survey_generate(
      clear_map_before_start, survey_mode, room_zone_index, interior_start_index,
      service->callbacks, service->context);
  if (result != CONTROLLER_SURVEY_GENERATE_OK) report_failure(service, result);
  return result == CONTROLLER_SURVEY_GENERATE_OK;
}
