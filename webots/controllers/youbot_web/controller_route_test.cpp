#include "controller_route.h"

#include <cmath>
#include <stdio.h>

#define TEST_PI 3.14159265358979323846
#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const char *path = "controller_route_test.csv";
  FILE *file = fopen(path, "w");
  if (!file) return 1;
  fprintf(file, "x,y,headingDeg\n");
  fprintf(file, "# comment\n");
  fprintf(file, "1.5,2.5,90\n");
  fprintf(file, "3.5,4.5\n");
  fprintf(file, "# command launch-1\n");
  fclose(file);

  RouteData route = {0};
  if (controller_route_load_file(path, &route) != CONTROLLER_ROUTE_LOAD_OK) return 2;
  remove(path);

  if (route.count != 2) return 3;
  if (!nearly_equal(route.waypoints[0].x, 1.5)) return 4;
  if (!nearly_equal(route.waypoints[0].z, 2.5)) return 5;
  if (!nearly_equal(route.waypoints[0].heading_rad, TEST_PI / 2.0)) return 6;
  if (!route.waypoints[0].has_heading) return 7;
  if (route.waypoints[1].has_heading) return 8;
  if (route.last_modified < 0) return 9;

  if (controller_route_load_file("missing-route.csv", &route) != CONTROLLER_ROUTE_LOAD_CANNOT_OPEN) return 10;

  file = fopen(path, "w");
  if (!file) return 11;
  fprintf(file, "x,y,headingDeg\n");
  fclose(file);
  if (controller_route_load_file(path, &route) != CONTROLLER_ROUTE_LOAD_EMPTY) return 12;
  remove(path);

  file = fopen(path, "w");
  if (!file) return 13;
  for (int i = 0; i <= MAX_WAYPOINTS; ++i) fprintf(file, "%d,0\n", i);
  fclose(file);
  if (controller_route_load_file(path, &route) == CONTROLLER_ROUTE_LOAD_OK) return 14;
  remove(path);
  return 0;
}
