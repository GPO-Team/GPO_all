#include "controller_zones.h"

#include <stdio.h>
#include <string.h>

int main(void) {
  const char *limit_path = "controller_limit_zones_test.tmp";
  const char *surface_path = "controller_surface_zones_test.tmp";
  FILE *file = fopen(limit_path, "w");
  if (!file) return 1;
  fprintf(file, "zone_count 1\nzone 4\n0 0\n2 0\n2 2\n0 2\n");
  fclose(file);

  ZoneData zones = {0};
  if (controller_limit_zones_load_file(limit_path, &zones) != CONTROLLER_ZONE_LOAD_OK) return 2;
  remove(limit_path);
  if (zones.count != 1 || zones.zones[0].point_count != 4) return 3;
  if (strcmp(zones.zones[0].id, "zone-1") != 0) return 4;
  ZoneData zones_copy = zones;
  if (!controller_zone_data_equal(&zones, &zones_copy)) return 5;
  zones_copy.zones[0].points[0].x += 0.01;
  if (controller_zone_data_equal(&zones, &zones_copy)) return 6;

  file = fopen(surface_path, "w");
  if (!file) return 7;
  fprintf(file, "surface_zone_count 1\nsurface_zone 3 rough loading-area\n0 0\n1 0\n0 1\n");
  fclose(file);

  SurfaceZoneData surfaces = {0};
  if (controller_surface_zones_load_file(surface_path, &surfaces) != CONTROLLER_ZONE_LOAD_OK) return 8;
  remove(surface_path);
  if (surfaces.count != 1 || surfaces.zones[0].point_count != 3) return 9;
  if (strcmp(surfaces.zones[0].surface_key, "rough") != 0) return 10;
  if (strcmp(surfaces.zones[0].id, "loading-area") != 0) return 11;
  SurfaceZoneData surfaces_copy = surfaces;
  if (!controller_surface_zone_data_equal(&surfaces, &surfaces_copy)) return 12;
  strcpy(surfaces_copy.zones[0].surface_key, "slippery");
  if (controller_surface_zone_data_equal(&surfaces, &surfaces_copy)) return 13;

  if (controller_limit_zones_load_file("missing-zones.txt", &zones) != CONTROLLER_ZONE_LOAD_NO_DATA) return 14;
  if (zones.count != 0) return 15;
  file = fopen(limit_path, "w");
  if (!file) return 16;
  fprintf(file, "zone_count %d\n", MAX_ZONES + 1);
  fclose(file);
  if (controller_limit_zones_load_file(limit_path, &zones) == CONTROLLER_ZONE_LOAD_OK) return 17;
  file = fopen(limit_path, "w");
  if (!file) return 18;
  fprintf(file, "zone_count 1\nzone %d\n", MAX_ZONE_POINTS + 1);
  for (int i = 0; i <= MAX_ZONE_POINTS; ++i) fprintf(file, "%d 0\n", i);
  fclose(file);
  if (controller_limit_zones_load_file(limit_path, &zones) == CONTROLLER_ZONE_LOAD_OK) return 19;
  remove(limit_path);
  return 0;
}
