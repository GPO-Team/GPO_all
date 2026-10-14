#include "controller_route_zone_service.h"

#include <stdio.h>
#include <string.h>

static int write_text_file(const char *path, const char *contents) {
  FILE *file = fopen(path, "w");
  if (!file) return 0;
  fputs(contents, file);
  return fclose(file) == 0;
}

int main(void) {
  const char *route_path = "controller_route_zone_service_route.csv";
  const char *limit_path = "controller_route_zone_service_limit_zones.txt";
  const char *surface_path = "controller_route_zone_service_surface_zones.txt";
  const ControllerRouteZoneServicePaths paths = {
      route_path,
      limit_path,
      surface_path,
  };
  const ControllerRouteZoneServiceReloadRequest request = {1, 1, 1};
  ControllerRouteZoneService service;
  RouteData route = {0};
  ZoneData limit_zones = {0};
  SurfaceZoneData surface_zones = {0};

  if (!write_text_file(route_path, "x,z\n1.0,2.0\n")) return 1;
  if (!write_text_file(limit_path, "zone_count 1\nzone 3\n0 0\n1 0\n0 1\n")) return 2;
  if (!write_text_file(surface_path,
                       "surface_zone_count 1\nsurface_zone 3 grass north\n0 0\n1 0\n0 1\n")) {
    return 3;
  }

  controller_route_zone_service_init(&service);
  controller_route_zone_service_ignore_existing(&service, &paths);
  const ControllerRouteZoneServiceResult ignored_result =
      controller_route_zone_service_reload(
          &service, &paths, &request, &route, &limit_zones, &surface_zones);
  if (ignored_result.route_status != CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED ||
      ignored_result.limit_zones_status != CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED ||
      ignored_result.surface_zones_status != CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED ||
      ignored_result.route_changed || ignored_result.limit_zones_changed ||
      ignored_result.surface_zones_changed) {
    return 4;
  }

  controller_route_zone_service_init(&service);
  const ControllerRouteZoneServiceResult result =
      controller_route_zone_service_reload(
          &service, &paths, &request, &route, &limit_zones, &surface_zones);

  route = result.route;
  if (!write_text_file(route_path, "x,y\n# command repeat-1\n1.0,2.0\n")) return 8;
  service.route_last_checked = -2;
  ControllerRouteZoneServiceResult repeat = controller_route_zone_service_reload(&service, &paths, &request, &route, &limit_zones, &surface_zones);
  if (!repeat.route_changed || strcmp(repeat.route.command_id, "repeat-1")) return 9;
  route = repeat.route;
  if (!write_text_file(route_path, "x,y\n# command repeat-2\n1.0,2.0\n")) return 10;
  service.route_last_checked = -2;
  repeat = controller_route_zone_service_reload(&service, &paths, &request, &route, &limit_zones, &surface_zones);
  if (!repeat.route_changed) return 11;
  if (!write_text_file(route_path, "x,y\n1,broken\n")) return 12;
  service.route_last_checked = -2;
  repeat = controller_route_zone_service_reload(&service, &paths, &request, &route, &limit_zones, &surface_zones);
  if (repeat.route_changed || service.route_last_checked != -2) return 13;
  remove(route_path);
  remove(limit_path);
  remove(surface_path);

  if (result.route_status != CONTROLLER_ROUTE_ZONE_STATUS_OK ||
      result.limit_zones_status != CONTROLLER_ROUTE_ZONE_STATUS_OK ||
      result.surface_zones_status != CONTROLLER_ROUTE_ZONE_STATUS_OK) {
    return 5;
  }
  if (!result.route_changed || !result.limit_zones_changed ||
      !result.surface_zones_changed) {
    return 6;
  }
  if (result.route.count != 1 || result.limit_zones.count != 1 ||
      result.surface_zones.count != 1 ||
      strcmp(result.surface_zones.zones[0].surface_key, "grass") != 0) {
    return 7;
  }
  return 0;
}
