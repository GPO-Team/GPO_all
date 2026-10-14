#include "controller_survey_default_route.h"

#include <stdio.h>

int main(void) {
  const char *path = "controller_survey_default_route_test.csv";
  const ControllerSurveyDefaultRouteConfig config = {0.0, 1.0, 0.0, 1.0, 1.0};
  if (!controller_survey_default_route_write(path, &config)) return 1;
  FILE *file = fopen(path, "r");
  if (!file) return 2;
  char line[32] = {0};
  if (!fgets(line, sizeof(line), file) || line[0] != '0') return 3;
  fclose(file);
  remove(path);
  return 0;
}
