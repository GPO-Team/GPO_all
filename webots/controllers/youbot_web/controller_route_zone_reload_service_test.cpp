#include "controller_route_zone_reload_service.h"

#include <assert.h>
#include <string.h>

static char status[64];
static char error[128];
static int reset_metrics_calls;
static int reset_navigation_calls;
static int motion_blocked(void) { return 1; }

static void set_status(const char *value) {
  strcpy(status, value);
}

static void set_error(const char *value) {
  strcpy(error, value);
}

static void reset_metrics(void) {
  ++reset_metrics_calls;
}

static void reset_navigation(void) {
  ++reset_navigation_calls;
}

int main(void) {
  ControllerRuntime runtime;
  controller_runtime_init(&runtime);
  ControllerRouteZoneService route_zone_service;
  controller_route_zone_service_init(&route_zone_service);
  ControllerRouteZoneReloadService service;
  controller_route_zone_reload_service_init(
      &service,
      &route_zone_service,
      &runtime,
      NULL,
      ControllerRouteZoneServicePaths{"route.csv", "limit_zones.txt", "surface_zones.txt"},
      set_status,
      set_error,
      reset_metrics,
      reset_navigation);

  ControllerRouteZoneServiceResult limit_result = {0};
  limit_result.limit_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_OK;
  limit_result.limit_zones_changed = 1;
  limit_result.limit_zones.count = 2;
  controller_route_zone_reload_service_apply_limit_result(&service, &limit_result);
  assert(runtime.limit_zones.count == 2);
  assert(strcmp(status, "zones_synced") == 0);

  ControllerRouteZoneServiceResult route_result = {0};
  route_result.route_status = CONTROLLER_ROUTE_ZONE_STATUS_OK;
  route_result.route_changed = 1;
  route_result.route.count = 1;
  route_result.route.waypoints[0] = Waypoint{1.0, 2.0, 0.0, 0};
  controller_route_zone_reload_service_apply_route_result(&service, &route_result);
  assert(runtime.route.count == 1);
  assert(strcmp(status, "route_reloaded") == 0);
  assert(reset_metrics_calls == 1);
  assert(reset_navigation_calls == 1);
  service.motion_blocked = motion_blocked;
  strcpy(runtime.route.command_id, "arm-current");
  strcpy(route_result.route.command_id, "foreign-route");
  controller_route_zone_reload_service_apply_route_result(&service, &route_result);
  assert(strcmp(runtime.route.command_id, "arm-current") == 0);
  assert(reset_navigation_calls == 1);
  service.motion_blocked = NULL;

  ControllerRouteZoneServiceResult invalid_surface = {0};
  invalid_surface.surface_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_ZONE_INVALID_ENTRY;
  controller_route_zone_reload_service_apply_surface_result(&service, &invalid_surface);
  assert(strcmp(error, "Cannot parse surface_zones.txt") == 0);
  return 0;
}
