#ifndef CONTROLLER_ROUTE_ZONE_RELOAD_SERVICE_H
#define CONTROLLER_ROUTE_ZONE_RELOAD_SERVICE_H

#include "controller_route_zone_service.h"
#include "controller_runtime.h"
#include "controller_webots_zone_sync.h"

typedef struct {
  ControllerRouteZoneService *route_zone_service;
  ControllerRuntime *runtime;
  ControllerWebotsZoneSyncContext *zone_sync;
  ControllerRouteZoneServicePaths paths;
  void (*set_status)(const char *status);
  void (*set_error)(const char *error);
  void (*reset_avoidance_metrics)(void);
  void (*reset_navigation)(void);
  int (*motion_blocked)(void);
} ControllerRouteZoneReloadService;

void controller_route_zone_reload_service_init(
    ControllerRouteZoneReloadService *service,
    ControllerRouteZoneService *route_zone_service,
    ControllerRuntime *runtime,
    ControllerWebotsZoneSyncContext *zone_sync,
    ControllerRouteZoneServicePaths paths,
    void (*set_status)(const char *status),
    void (*set_error)(const char *error),
    void (*reset_avoidance_metrics)(void),
    void (*reset_navigation)(void));
void controller_route_zone_reload_service_apply_limit_result(
    ControllerRouteZoneReloadService *service,
    const ControllerRouteZoneServiceResult *result);
void controller_route_zone_reload_service_apply_surface_result(
    ControllerRouteZoneReloadService *service,
    const ControllerRouteZoneServiceResult *result);
void controller_route_zone_reload_service_apply_route_result(
    ControllerRouteZoneReloadService *service,
    const ControllerRouteZoneServiceResult *result);
void controller_route_zone_reload_service_reload_limit(ControllerRouteZoneReloadService *service);
void controller_route_zone_reload_service_reload_surface(ControllerRouteZoneReloadService *service);
void controller_route_zone_reload_service_reload_route(ControllerRouteZoneReloadService *service);

#endif
