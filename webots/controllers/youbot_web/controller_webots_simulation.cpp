#include "controller_webots_simulation.h"

#include <stdio.h>

void controller_webots_simulation_registry_remove_at(
    ControllerWebotsSimulationNodeRegistry *registry,
    int index) {
  if (!registry || index < 0 || index >= registry->count) return;
  if (registry->defs[index][0] != '\0') {
    WbNodeRef node = wb_supervisor_node_get_from_def(registry->defs[index]);
    if (node) wb_supervisor_node_remove(node);
  }
  controller_webots_simulation_registry_forget(registry, index);
}

void controller_webots_simulation_registry_remove_all(
    ControllerWebotsSimulationNodeRegistry *registry) {
  if (!registry) return;
  while (registry->count > 0) {
    controller_webots_simulation_registry_remove_at(registry, 0);
  }
}

void controller_webots_simulation_sync_limit_zones(
    WbFieldRef root_children_field,
    ControllerWebotsSimulationNodeRegistry *registry,
    const ZoneData *zones,
    int capacity,
    double wall_thickness,
    double wall_height) {
  controller_webots_simulation_registry_remove_all(registry);
  if (!root_children_field || !registry || !zones) return;

  for (int zone_index = 0; zone_index < zones->count; ++zone_index) {
    const LimitZone *zone = &zones->zones[zone_index];
    for (int point_index = 0; point_index < zone->point_count; ++point_index) {
      const int next = (point_index + 1) % zone->point_count;
      char def_name[64];
      char node_string[1024];
      snprintf(def_name, sizeof(def_name), "WEB_LIMIT_%d_%d", zone_index, point_index);
      if (!controller_webots_simulation_format_limit_wall(
              node_string,
              sizeof(node_string),
              def_name,
              zone->points[point_index].x,
              zone->points[point_index].y,
              zone->points[next].x,
              zone->points[next].y,
              wall_thickness,
              wall_height)) {
        continue;
      }

      const int insert_at = wb_supervisor_field_get_count(root_children_field);
      wb_supervisor_field_import_mf_node_from_string(root_children_field, insert_at, node_string);
      controller_webots_simulation_registry_track(registry, capacity, def_name);
    }
  }
}

void controller_webots_simulation_sync_surface_zones(
    WbFieldRef root_children_field,
    ControllerWebotsSimulationNodeRegistry *registry,
    const SurfaceZoneData *zones,
    int capacity) {
  controller_webots_simulation_registry_remove_all(registry);
  if (!root_children_field || !registry || !zones) return;

  for (int zone_index = 0; zone_index < zones->count; ++zone_index) {
    const SurfaceZone *zone = &zones->zones[zone_index];
    char def_name[64];
    char node_string[4096];
    snprintf(def_name, sizeof(def_name), "WEB_SURFACE_%d", zone_index);
    if (!controller_webots_simulation_format_surface_zone(
            node_string, sizeof(node_string), zone, zone_index)) {
      continue;
    }

    const int insert_at = wb_supervisor_field_get_count(root_children_field);
    wb_supervisor_field_import_mf_node_from_string(root_children_field, insert_at, node_string);
    controller_webots_simulation_registry_track(registry, capacity, def_name);
  }
}

void controller_webots_simulation_spawn_runtime_obstacle(
    WbFieldRef root_children_field,
    ControllerWebotsSimulationNodeRegistry *registry,
    const RuntimeCommand *command,
    int capacity,
    double min_x,
    double max_x,
    double min_y,
    double max_y) {
  if (!root_children_field || !registry || !command || !command->has_spawn_obstacle) return;

  if (registry->count >= capacity) {
    controller_webots_simulation_registry_remove_at(registry, 0);
  }

  const long long compact_id = command->id >= 0 ? command->id : 0;
  char def_name[64];
  char node_string[1024];
  snprintf(def_name, sizeof(def_name), "WEB_OBS_%lld", compact_id);
  if (!controller_webots_simulation_format_runtime_obstacle(
          node_string, sizeof(node_string), command, min_x, max_x, min_y, max_y)) {
    return;
  }

  WbNodeRef existing = wb_supervisor_node_get_from_def(def_name);
  if (existing) wb_supervisor_node_remove(existing);

  const int insert_at = wb_supervisor_field_get_count(root_children_field);
  wb_supervisor_field_import_mf_node_from_string(root_children_field, insert_at, node_string);
  controller_webots_simulation_registry_track(registry, capacity, def_name);
}
