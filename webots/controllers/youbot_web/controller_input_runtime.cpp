#include "controller_input_runtime.h"

#include "controller_app_config.h"
#include "controller_app_internal.h"
#include "controller_io.h"
#include "controller_mapping_route_io.h"
#include "controller_motion_profile_reload_service.h"
#include "controller_route_zone_reload_service.h"
#include "controller_route.h"
#include "controller_runtime_command_reload_service.h"
#include "controller_webots_motion_state.h"
#include "controller_webots_zone_sync.h"

void set_error(const char *message) {
  controller_application_state_set_error(&application_state, message);
}

void clear_error(void) {
  controller_application_state_clear_error(&application_state);
}

void set_status(const char *status) {
  controller_application_state_set_status(&application_state, status);
}

void spawn_runtime_obstacle(const RuntimeCommand *command) {
  controller_webots_zone_sync_spawn_obstacle(&webots_zone_sync, command);
}

ControllerInputMotionReloadResult reload_motion_profile_input(void *context) {
  (void)context;
  return controller_motion_profile_reload_service_run(
             &motion_profile_reload_service, step_counter, MOTION_RELOAD_INTERVAL) ==
                 CONTROLLER_MOTION_PROFILE_RELOAD_CHANGED
             ? CONTROLLER_INPUT_MOTION_RELOAD_CHANGED
             : CONTROLLER_INPUT_MOTION_RELOAD_UNCHANGED;
}

void reload_runtime_command_input(void *context) {
  (void)context;
  controller_runtime_command_reload_service_run(
      &runtime_command_reload_service, step_counter, RUNTIME_COMMAND_RELOAD_INTERVAL);
}

void reload_limit_zones_input(void *context) {
  (void)context;
  controller_route_zone_reload_service_reload_limit(&route_zone_reload_service);
}

void reload_surface_zones_input(void *context) {
  (void)context;
  controller_route_zone_reload_service_reload_surface(&route_zone_reload_service);
}

void reload_route_input(void *context) {
  (void)context;
  const auto &transfer = object_transfer_runtime.service.state;
  if(transfer.status == CONTROLLER_TRANSFER_RUNNING ||
      transfer.status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) {
    route_zone_service.route_last_checked = get_file_mtime(ROUTE_PATH);
    return;
  }
  controller_route_zone_reload_service_reload_route(&route_zone_reload_service);
}

void set_input_status(void *context, const char *status) {
  (void)context;
  set_status(status);
}

void maybe_reload_runtime_command(void) {
  controller_input_orchestration_reload_runtime_command(&input_orchestration, step_counter);
}

void maybe_reload_motion_profile(void) {
  controller_input_orchestration_reload_motion(&input_orchestration, step_counter);
}

void maybe_reload_zones(void) {
  controller_input_orchestration_reload_zones(&input_orchestration, step_counter);
}

void maybe_reload_surface_zones(void) {
  controller_input_orchestration_reload_surface_zones(&input_orchestration, step_counter);
}

int load_route(RouteData *route) {
  const ControllerRouteLoadResult result =
      controller_route_load_file(ROUTE_PATH, route);
  if (result == CONTROLLER_ROUTE_LOAD_CANNOT_OPEN) {
    set_error("Cannot open route.csv");
    return 0;
  }
  if (result == CONTROLLER_ROUTE_LOAD_EMPTY) {
    set_error("Route file is empty");
    return 0;
  }
  clear_error();
  return 1;
}

void maybe_reload_route(void) {
  controller_input_orchestration_reload_route(&input_orchestration, step_counter);
}
