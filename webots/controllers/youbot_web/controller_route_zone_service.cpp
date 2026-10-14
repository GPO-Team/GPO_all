#include "controller_route_zone_service.h"

#include "controller_io.h"
#include "controller_route.h"
#include "controller_zones.h"

#include <cmath>
#include <string.h>

static int route_data_equal(const RouteData *left, const RouteData *right) {
  if (!left || !right || left->count != right->count) return 0;
  if (strcmp(left->command_id, right->command_id) != 0) return 0;
  for (int index = 0; index < left->count; ++index) {
    const Waypoint *a = &left->waypoints[index];
    const Waypoint *b = &right->waypoints[index];
    if (fabs(a->x - b->x) > 1e-6 || fabs(a->z - b->z) > 1e-6 ||
        fabs(a->heading_rad - b->heading_rad) > 1e-6 ||
        a->has_heading != b->has_heading) {
      return 0;
    }
  }
  return 1;
}

static ControllerRouteZoneStatus route_status_from_load_result(
    ControllerRouteLoadResult result) {
  if (result == CONTROLLER_ROUTE_LOAD_OK) return CONTROLLER_ROUTE_ZONE_STATUS_OK;
  if (result == CONTROLLER_ROUTE_LOAD_EMPTY) return CONTROLLER_ROUTE_ZONE_STATUS_ROUTE_EMPTY;
  return CONTROLLER_ROUTE_ZONE_STATUS_ROUTE_CANNOT_OPEN;
}

static ControllerRouteZoneStatus zone_status_from_load_result(
    ControllerZoneLoadResult result) {
  if (result == CONTROLLER_ZONE_LOAD_OK) {
    return CONTROLLER_ROUTE_ZONE_STATUS_OK;
  }
  if (result == CONTROLLER_ZONE_LOAD_INVALID_HEADER) {
    return CONTROLLER_ROUTE_ZONE_STATUS_ZONE_INVALID_HEADER;
  }
  if (result == CONTROLLER_ZONE_LOAD_INVALID_ENTRY) {
    return CONTROLLER_ROUTE_ZONE_STATUS_ZONE_INVALID_ENTRY;
  }
  if (result == CONTROLLER_ZONE_LOAD_UNEXPECTED_END) {
    return CONTROLLER_ROUTE_ZONE_STATUS_ZONE_UNEXPECTED_END;
  }
  return CONTROLLER_ROUTE_ZONE_STATUS_ZONE_INVALID_POINT;
}

void controller_route_zone_service_init(ControllerRouteZoneService *service) {
  if (!service) return;
  service->route_last_checked = -2;
  service->limit_zones_last_checked = -2;
  service->surface_zones_last_checked = -2;
}

void controller_route_zone_service_ignore_existing(
    ControllerRouteZoneService *service,
    const ControllerRouteZoneServicePaths *paths) {
  if (!service || !paths) return;
  service->route_last_checked = get_file_mtime(paths->route_path);
  service->limit_zones_last_checked = get_file_mtime(paths->limit_zones_path);
  service->surface_zones_last_checked = get_file_mtime(paths->surface_zones_path);
}

ControllerRouteZoneServiceResult controller_route_zone_service_reload(
    ControllerRouteZoneService *service,
    const ControllerRouteZoneServicePaths *paths,
    const ControllerRouteZoneServiceReloadRequest *request,
    const RouteData *current_route,
    const ZoneData *current_limit_zones,
    const SurfaceZoneData *current_surface_zones) {
  ControllerRouteZoneServiceResult result = {
      .route_status = CONTROLLER_ROUTE_ZONE_STATUS_NOT_CHECKED,
      .limit_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_NOT_CHECKED,
      .surface_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_NOT_CHECKED,
  };
  if (!service || !paths || !request || !paths->route_path || !paths->limit_zones_path ||
      !paths->surface_zones_path || !current_route || !current_limit_zones ||
      !current_surface_zones) {
    result.route_status = CONTROLLER_ROUTE_ZONE_STATUS_INVALID_ARGUMENT;
    result.limit_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_INVALID_ARGUMENT;
    result.surface_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_INVALID_ARGUMENT;
    return result;
  }

  if (request->reload_route) {
    const long long route_mtime = get_file_mtime(paths->route_path);
    if (route_mtime == service->route_last_checked) {
      result.route_status = CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED;
    } else {
      const ControllerRouteLoadResult load_result =
          controller_route_load_file(paths->route_path, &result.route);
      result.route_status = route_status_from_load_result(load_result);
      if (result.route_status == CONTROLLER_ROUTE_ZONE_STATUS_OK) service->route_last_checked = route_mtime;
      result.route_changed = result.route_status == CONTROLLER_ROUTE_ZONE_STATUS_OK &&
                             !route_data_equal(current_route, &result.route);
    }
  }

  if (request->reload_limit_zones) {
    const long long limit_mtime = get_file_mtime(paths->limit_zones_path);
    if (limit_mtime == service->limit_zones_last_checked) {
      result.limit_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED;
    } else {
      const ControllerZoneLoadResult load_result =
          controller_limit_zones_load_file(paths->limit_zones_path, &result.limit_zones);
      result.limit_zones_status = zone_status_from_load_result(load_result);
      if (result.limit_zones_status == CONTROLLER_ROUTE_ZONE_STATUS_OK) service->limit_zones_last_checked = limit_mtime;
      result.limit_zones_changed =
          result.limit_zones_status == CONTROLLER_ROUTE_ZONE_STATUS_OK &&
          !controller_zone_data_equal(current_limit_zones, &result.limit_zones);
    }
  }

  if (request->reload_surface_zones) {
    const long long surface_mtime = get_file_mtime(paths->surface_zones_path);
    if (surface_mtime == service->surface_zones_last_checked) {
      result.surface_zones_status = CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED;
    } else {
      const ControllerZoneLoadResult load_result = controller_surface_zones_load_file(
          paths->surface_zones_path, &result.surface_zones);
      result.surface_zones_status = zone_status_from_load_result(load_result);
      if (result.surface_zones_status == CONTROLLER_ROUTE_ZONE_STATUS_OK) service->surface_zones_last_checked = surface_mtime;
      result.surface_zones_changed =
          result.surface_zones_status == CONTROLLER_ROUTE_ZONE_STATUS_OK &&
          !controller_surface_zone_data_equal(
              current_surface_zones, &result.surface_zones);
    }
  }

  return result;
}
