#include "controller_survey_default_route.h"

#include <stdio.h>

int controller_survey_default_route_write(
    const char *path,
    const ControllerSurveyDefaultRouteConfig *config) {
  if (!path || !config || config->strip <= 0.0) return 0;
  FILE *file = fopen(path, "w");
  if (!file) return 0;

  fprintf(file, "%.3f,%.3f\n", config->min_x, config->min_y);
  int forward = 1;
  for (double y = config->min_y; y <= config->max_y + 0.01; y += config->strip) {
    const double start_x = forward ? config->min_x : config->max_x;
    const double end_x = forward ? config->max_x : config->min_x;
    fprintf(file, "%.3f,%.3f\n", start_x, y);
    fprintf(file, "%.3f,%.3f\n", end_x, y);
    forward = !forward;
  }
  return fclose(file) == 0;
}
