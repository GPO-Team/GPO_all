#include "controller_mapping_survey_lifecycle_service.h"

int controller_mapping_survey_lifecycle_service_ensure_default_route(
    const char *route_path,
    long long route_mtime,
    const ControllerSurveyDefaultRouteConfig *config,
    void (*clear_map)(void),
    void (*set_status)(const char *status)) {
  if (route_mtime >= 0 || !controller_survey_default_route_write(route_path, config)) return 0;
  if (clear_map) clear_map();
  if (set_status) set_status("survey_route_generated");
  return 1;
}
