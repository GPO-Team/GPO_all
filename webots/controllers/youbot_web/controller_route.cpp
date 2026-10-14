#include "controller_route.h"
#include "controller_io.h"
#include <cmath>
#include <stdio.h>
#include <string.h>

#define CONTROLLER_ROUTE_PI 3.14159265358979323846

ControllerRouteLoadResult controller_route_load_file(const char *path, RouteData *route) {
  if (!path || !route) return CONTROLLER_ROUTE_LOAD_CANNOT_OPEN;
  FILE *file = fopen(path, "r");
  if (!file) return CONTROLLER_ROUTE_LOAD_CANNOT_OPEN;
  RouteData parsed = {0};
  char line[256];
  while (fgets(line, sizeof(line), file)) {
    if (sscanf(line, "# command %63s", parsed.command_id) == 1) continue;
    if (line[0] == '\n' || line[0] == '\r' || line[0] == '#') continue;
    if (strncmp(line, "x,", 2) == 0 || strncmp(line, "x ", 2) == 0) continue;
    double x = 0.0, z = 0.0, heading = 0.0;
    char extra;
    int fields = sscanf(line, " %lf , %lf , %lf %c", &x, &z, &heading, &extra);
    if (fields != 3) {
      fields = sscanf(line, " %lf , %lf %c", &x, &z, &extra);
      if (fields != 2) { fclose(file); return CONTROLLER_ROUTE_LOAD_INVALID; }
      heading = 0.0;
    }
    if (parsed.count >= MAX_WAYPOINTS || !std::isfinite(x) || !std::isfinite(z) || !std::isfinite(heading)) {
      fclose(file);
      return CONTROLLER_ROUTE_LOAD_INVALID;
    }
    parsed.waypoints[parsed.count++] = Waypoint{x, z, heading * CONTROLLER_ROUTE_PI / 180.0, fields == 3};
  }
  const int failed = ferror(file);
  fclose(file);
  if (failed) return CONTROLLER_ROUTE_LOAD_CANNOT_OPEN;
  if (!parsed.count) return CONTROLLER_ROUTE_LOAD_EMPTY;
  parsed.last_modified = get_file_mtime(path);
  *route = parsed;
  return CONTROLLER_ROUTE_LOAD_OK;
}
