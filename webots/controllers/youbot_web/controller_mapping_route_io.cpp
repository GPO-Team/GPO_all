#include "controller_mapping_route_io.h"

#include <stdio.h>

int controller_mapping_route_write(
    const char *path,
    const SurveyPoint *route,
    int route_count,
    MappingSurveyMode mode,
    const char *mission_id) {
  if (!path || !route || route_count < 0) return 0;
  FILE *file = fopen(path, "w");
  if (!file) return 0;
  if (mission_id && mission_id[0]) fprintf(file, "# command %s\n", mission_id);

  fprintf(
      file,
      "# Auto-generated mapping survey route: perimeter first, then %s coverage\n",
      controller_mapping_survey_mode_to_string(mode));
  fprintf(file, "# x,y\n");
  for (int i = 0; i < route_count; ++i) {
    fprintf(file, "%.3f,%.3f\n", route[i].x, route[i].y);
  }
  const int failed = ferror(file);
  return fclose(file) == 0 && !failed;
}
