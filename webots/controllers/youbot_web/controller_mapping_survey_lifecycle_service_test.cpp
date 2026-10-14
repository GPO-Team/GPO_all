#include "controller_mapping_survey_lifecycle_service.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

static int clear_calls;
static char status[64];

static void clear_map(void) {
  ++clear_calls;
}

static void set_status(const char *value) {
  strcpy(status, value);
}

int main(void) {
  const char *path = "controller_mapping_survey_lifecycle_service_test.csv";
  remove(path);
  const ControllerSurveyDefaultRouteConfig config = {-1.0, 1.0, -1.0, 1.0, 1.0};
  assert(controller_mapping_survey_lifecycle_service_ensure_default_route(
      path, -1, &config, clear_map, set_status));
  assert(clear_calls == 1);
  assert(strcmp(status, "survey_route_generated") == 0);
  FILE *file = fopen(path, "r");
  assert(file);
  fclose(file);
  assert(!controller_mapping_survey_lifecycle_service_ensure_default_route(
      path, 1, &config, clear_map, set_status));
  assert(clear_calls == 1);
  remove(path);
  return 0;
}
