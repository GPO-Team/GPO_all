#include "controller_webots_zone_sync.h"

void controller_webots_zone_sync_limit_zones(
    const ControllerWebotsZoneSyncContext *context, const ZoneData *zones) {
  if (!context) return;
  controller_webots_simulation_sync_limit_zones(
      context->root_children_field, context->limit_zone_registry, zones,
      context->max_limit_zone_nodes, context->wall_thickness, context->wall_height);
}

void controller_webots_zone_sync_surface_zones(
    const ControllerWebotsZoneSyncContext *context, const SurfaceZoneData *zones) {
  if (!context) return;
  controller_webots_simulation_sync_surface_zones(
      context->root_children_field, context->surface_zone_registry, zones,
      context->max_surface_zone_nodes);
}

void controller_webots_zone_sync_spawn_obstacle(
    const ControllerWebotsZoneSyncContext *context, const RuntimeCommand *command) {
  if (!context) return;
  controller_webots_simulation_spawn_runtime_obstacle(
      context->root_children_field, context->runtime_obstacle_registry, command,
      context->max_runtime_obstacle_nodes, context->min_x, context->max_x,
      context->min_y, context->max_y);
}

void controller_webots_zone_sync_remove_all(const ControllerWebotsZoneSyncContext *context) {
  if (!context) return;
  controller_webots_simulation_registry_remove_all(context->limit_zone_registry);
  controller_webots_simulation_registry_remove_all(context->surface_zone_registry);
  controller_webots_simulation_registry_remove_all(context->runtime_obstacle_registry);
}
