#include "controller_zones.h"

#include <cmath>
#include <stdio.h>
#include <string.h>

int controller_zone_data_equal(const ZoneData *left, const ZoneData *right) {
  if (!left || !right || left->count != right->count) return 0;
  for (int zone_index = 0; zone_index < left->count; ++zone_index) {
    if (left->zones[zone_index].point_count != right->zones[zone_index].point_count) return 0;
    for (int point_index = 0; point_index < left->zones[zone_index].point_count; ++point_index) {
      if (fabs(left->zones[zone_index].points[point_index].x - right->zones[zone_index].points[point_index].x) > 1e-6 ||
          fabs(left->zones[zone_index].points[point_index].y - right->zones[zone_index].points[point_index].y) > 1e-6) return 0;
    }
  }
  return 1;
}

int controller_surface_zone_data_equal(const SurfaceZoneData *left, const SurfaceZoneData *right) {
  if (!left || !right || left->count != right->count) return 0;
  for (int zone_index = 0; zone_index < left->count; ++zone_index) {
    if (strcmp(left->zones[zone_index].surface_key, right->zones[zone_index].surface_key) != 0 ||
        left->zones[zone_index].point_count != right->zones[zone_index].point_count) return 0;
    for (int point_index = 0; point_index < left->zones[zone_index].point_count; ++point_index) {
      if (fabs(left->zones[zone_index].points[point_index].x - right->zones[zone_index].points[point_index].x) > 1e-6 ||
          fabs(left->zones[zone_index].points[point_index].y - right->zones[zone_index].points[point_index].y) > 1e-6) return 0;
    }
  }
  return 1;
}

ControllerZoneLoadResult controller_limit_zones_load_file(const char *path, ZoneData *zones) {
  if (!path || !zones) return CONTROLLER_ZONE_LOAD_INVALID_HEADER;
  zones->count = 0;
  FILE *file = fopen(path, "r");
  if (!file) return CONTROLLER_ZONE_LOAD_NO_DATA;

  char line[256];
  if (!fgets(line, sizeof(line), file)) {
    fclose(file);
    return CONTROLLER_ZONE_LOAD_NO_DATA;
  }
  int declared_zone_count = 0;
  if (sscanf(line, " zone_count %d", &declared_zone_count) != 1) {
    fclose(file);
    return CONTROLLER_ZONE_LOAD_INVALID_HEADER;
  }

  if (declared_zone_count < 0 || declared_zone_count > MAX_ZONES) { fclose(file); return CONTROLLER_ZONE_LOAD_INVALID_HEADER; }
  for (int zone_index = 0; zone_index < declared_zone_count; ++zone_index) {
    if (!fgets(line, sizeof(line), file)) { fclose(file); return CONTROLLER_ZONE_LOAD_UNEXPECTED_END; }
    int declared_point_count = 0;
    if (sscanf(line, " zone %d", &declared_point_count) != 1) {
      fclose(file);
      return CONTROLLER_ZONE_LOAD_INVALID_ENTRY;
    }
    if (declared_point_count < 3 || declared_point_count > MAX_ZONE_POINTS) { fclose(file); return CONTROLLER_ZONE_LOAD_INVALID_ENTRY; }
    LimitZone *zone = &zones->zones[zones->count];
    snprintf(zone->id, sizeof(zone->id), "zone-%d", zones->count + 1);
    zone->point_count = 0;
    for (int point_index = 0; point_index < declared_point_count; ++point_index) {
      if (!fgets(line, sizeof(line), file)) {
        fclose(file);
        return CONTROLLER_ZONE_LOAD_UNEXPECTED_END;
      }
      double x = 0.0;
      double y = 0.0;
      if (sscanf(line, " %lf %lf", &x, &y) != 2 || !std::isfinite(x) || !std::isfinite(y)) {
        fclose(file);
        return CONTROLLER_ZONE_LOAD_INVALID_POINT;
      }
      if (zone->point_count < MAX_ZONE_POINTS) {
        zone->points[zone->point_count].x = x;
        zone->points[zone->point_count].y = y;
        zone->point_count += 1;
      }
    }
    if (zone->point_count >= 3) zones->count += 1;
  }
  fclose(file);
  return CONTROLLER_ZONE_LOAD_OK;
}

ControllerZoneLoadResult controller_surface_zones_load_file(const char *path, SurfaceZoneData *zones) {
  if (!path || !zones) return CONTROLLER_ZONE_LOAD_INVALID_HEADER;
  zones->count = 0;
  FILE *file = fopen(path, "r");
  if (!file) return CONTROLLER_ZONE_LOAD_NO_DATA;

  char line[256];
  if (!fgets(line, sizeof(line), file)) {
    fclose(file);
    return CONTROLLER_ZONE_LOAD_NO_DATA;
  }
  int declared_zone_count = 0;
  if (sscanf(line, " surface_zone_count %d", &declared_zone_count) != 1) {
    fclose(file);
    return CONTROLLER_ZONE_LOAD_INVALID_HEADER;
  }

  if (declared_zone_count < 0 || declared_zone_count > MAX_ZONES) { fclose(file); return CONTROLLER_ZONE_LOAD_INVALID_HEADER; }
  for (int zone_index = 0; zone_index < declared_zone_count; ++zone_index) {
    if (!fgets(line, sizeof(line), file)) { fclose(file); return CONTROLLER_ZONE_LOAD_UNEXPECTED_END; }
    int declared_point_count = 0;
    char surface_key[32] = "neutral";
    char zone_id[64] = "";
    if (sscanf(line, " surface_zone %d %31s %63s", &declared_point_count, surface_key, zone_id) < 2) {
      fclose(file);
      return CONTROLLER_ZONE_LOAD_INVALID_ENTRY;
    }
    if (declared_point_count < 3 || declared_point_count > MAX_ZONE_POINTS) { fclose(file); return CONTROLLER_ZONE_LOAD_INVALID_ENTRY; }
    SurfaceZone *zone = &zones->zones[zones->count];
    snprintf(zone->id, sizeof(zone->id), "%s", zone_id[0] ? zone_id : "surface-zone");
    snprintf(zone->surface_key, sizeof(zone->surface_key), "%s", surface_key);
    zone->point_count = 0;
    for (int point_index = 0; point_index < declared_point_count; ++point_index) {
      if (!fgets(line, sizeof(line), file)) {
        fclose(file);
        return CONTROLLER_ZONE_LOAD_UNEXPECTED_END;
      }
      double x = 0.0;
      double y = 0.0;
      if (sscanf(line, " %lf %lf", &x, &y) != 2 || !std::isfinite(x) || !std::isfinite(y)) {
        fclose(file);
        return CONTROLLER_ZONE_LOAD_INVALID_POINT;
      }
      if (zone->point_count < MAX_ZONE_POINTS) {
        zone->points[zone->point_count].x = x;
        zone->points[zone->point_count].y = y;
        zone->point_count += 1;
      }
    }
    if (zone->point_count >= 3) zones->count += 1;
  }
  fclose(file);
  return CONTROLLER_ZONE_LOAD_OK;
}
