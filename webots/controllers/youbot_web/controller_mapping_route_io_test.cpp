#include "controller_mapping_route_io.h"

#include <stdio.h>
#include <string.h>

int main(void) {
  const char *path = "controller_mapping_route_io_test.csv";
  const SurveyPoint route[2] = {{1.25, -2.5}, {3.0, 4.125}};
  if (!controller_mapping_route_write(path, route, 2, MAPPING_SURVEY_MODE_DOUBLE, "survey-1")) return 1;

  FILE *file = fopen(path, "r");
  if (!file) return 2;
  char buffer[256] = {0};
  const size_t size = fread(buffer, 1, sizeof(buffer) - 1, file);
  fclose(file);
  remove(path);
  buffer[size] = '\0';
  if (strcmp(
          buffer,
          "# command survey-1\n"
          "# Auto-generated mapping survey route: perimeter first, then double coverage\n"
          "# x,y\n"
          "1.250,-2.500\n"
          "3.000,4.125\n") != 0) {
    return 3;
  }
  return 0;
}
