#include "controller_route_zone_reload_service.h"

#include "controller_survey_lifecycle.h"
#include "controller_io.h"

#include <string.h>

static int status_is_error(ControllerRouteZoneStatus status) {
  return status != CONTROLLER_ROUTE_ZONE_STATUS_OK &&
         status != CONTROLLER_ROUTE_ZONE_STATUS_UNCHANGED;
}

void controller_route_zone_reload_service_init(
    ControllerRouteZoneReloadService *service,
    ControllerRouteZoneService *route_zone_service,
    ControllerRuntime *runtime,
    ControllerWebotsZoneSyncContext *zone_sync,
    ControllerRouteZoneServicePaths paths,
    void (*set_status)(const char *status),
    void (*set_error)(const char *error),
    void (*reset_avoidance_metrics)(void),
    void (*reset_navigation)(void)) {
  if (!service) return;
  *service = (ControllerRouteZoneReloadService){
      route_zone_service,
      runtime,
      zone_sync,
      paths,
      set_status,
      set_error,
      reset_avoidance_metrics,
      reset_navigation,
  };
}

void controller_route_zone_reload_service_apply_limit_result(
    ControllerRouteZoneReloadService *service,
    const ControllerRouteZoneServiceResult *result) {
  if (!service || !service->runtime || !result) return;
  if (status_is_error(result->limit_zones_status)) {
    if (service->set_error) service->set_error("Cannot parse limit_zones.txt");
    return;
  }
  if (!result->limit_zones_changed) return;
  service->runtime->limit_zones = result->limit_zones;
  if (service->zone_sync) {
    controller_webots_zone_sync_limit_zones(service->zone_sync, &service->runtime->limit_zones);
  }
  if (service->set_status) {
    service->set_status(service->runtime->limit_zones.count > 0 ? "zones_synced" : "zones_cleared");
  }
}

void controller_route_zone_reload_service_apply_surface_result(
    ControllerRouteZoneReloadService *service,
    const ControllerRouteZoneServiceResult *result) {
  if (!service || !service->runtime || !result) return;
  if (status_is_error(result->surface_zones_status)) {
    if (service->set_error) service->set_error("Cannot parse surface_zones.txt");
    return;
  }
  if (!result->surface_zones_changed) return;
  service->runtime->surface_zones = result->surface_zones;
  if (service->zone_sync) {
    controller_webots_zone_sync_surface_zones(
        service->zone_sync, &service->runtime->surface_zones);
  }
  if (service->set_status) {
    service->set_status(
        service->runtime->surface_zones.count > 0 ? "surfaces_synced" : "surfaces_cleared");
  }
}

void controller_route_zone_reload_service_apply_route_result(
    ControllerRouteZoneReloadService *service,
    const ControllerRouteZoneServiceResult *result) {
  if (!service || !service->runtime || !result) return;
  if (service->motion_blocked && service->motion_blocked()) return;
  if (result->route_status == CONTROLLER_ROUTE_ZONE_STATUS_ROUTE_CANNOT_OPEN) {
    if (service->set_error) service->set_error("Cannot open route.csv");
    return;
  }
  if (result->route_status == CONTROLLER_ROUTE_ZONE_STATUS_ROUTE_EMPTY) {
    if (service->set_error) service->set_error("Route file is empty");
    return;
  }
  if (!result->route_changed) return;
  controller_survey_lifecycle_accept_route(
      &service->runtime->route,
      &result->route,
      &service->runtime->current_waypoint_index,
      &service->runtime->route_finished,
      &service->runtime->mapping_survey,
      0,
      service->runtime->mapping_survey.mode);
  if (service->reset_avoidance_metrics) service->reset_avoidance_metrics();
  if (service->reset_navigation) service->reset_navigation();
  if (service->set_status) service->set_status("route_reloaded");
}

void controller_route_zone_reload_service_reload_limit(ControllerRouteZoneReloadService *service) {
  if (!service || !service->route_zone_service || !service->runtime) return;
  const ControllerRouteZoneServiceReloadRequest request = {0, 1, 0};
  const ControllerRouteZoneServiceResult result = controller_route_zone_service_reload(
      service->route_zone_service, &service->paths, &request, &service->runtime->route,
      &service->runtime->limit_zones, &service->runtime->surface_zones);
  controller_route_zone_reload_service_apply_limit_result(service, &result);
}

void controller_route_zone_reload_service_reload_surface(ControllerRouteZoneReloadService *service) {
  if (!service || !service->route_zone_service || !service->runtime) return;
  const ControllerRouteZoneServiceReloadRequest request = {0, 0, 1};
  const ControllerRouteZoneServiceResult result = controller_route_zone_service_reload(
      service->route_zone_service, &service->paths, &request, &service->runtime->route,
      &service->runtime->limit_zones, &service->runtime->surface_zones);
  controller_route_zone_reload_service_apply_surface_result(service, &result);
}

void controller_route_zone_reload_service_reload_route(ControllerRouteZoneReloadService *service) {
  if (!service || !service->route_zone_service || !service->runtime) return;
  if (service->motion_blocked && service->motion_blocked()) {
    // Ignore a foreign launch seen while the arm owns motion; do not replay it later.
    service->route_zone_service->route_last_checked = get_file_mtime(service->paths.route_path);
    return;
  }
  const ControllerRouteZoneServiceReloadRequest request = {1, 0, 0};
  const ControllerRouteZoneServiceResult result = controller_route_zone_service_reload(
      service->route_zone_service, &service->paths, &request, &service->runtime->route,
      &service->runtime->limit_zones, &service->runtime->surface_zones);
  controller_route_zone_reload_service_apply_route_result(service, &result);
}
