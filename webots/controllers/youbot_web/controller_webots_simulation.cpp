#include "controller_webots_simulation.h"

#include <stdio.h>
#include <string.h>

static void remove_generated_nodes(WbFieldRef children, const char *prefix) {
  if (!children) return;
  // Registries are empty after a controller restart, while the world keeps its nodes.
  for (int i = wb_supervisor_field_get_count(children) - 1; i >= 0; --i) {
    WbNodeRef node = wb_supervisor_field_get_mf_node(children, i);
    const char *def_name = node ? wb_supervisor_node_get_def(node) : NULL;
    if (def_name && strncmp(def_name, prefix, strlen(prefix)) == 0) wb_supervisor_node_remove(node);
  }
}

int controller_webots_simulation_get_obstacle_geometry(long long obstacle_id, RuntimeCommand *geometry) {
  if (!geometry || obstacle_id <= 0) return 0;
  char def_name[64];
  snprintf(def_name, sizeof(def_name), "WEB_OBS_%lld", obstacle_id);
  WbNodeRef node = wb_supervisor_node_get_from_def(def_name);
  WbFieldRef translation = node ? wb_supervisor_node_get_field(node, "translation") : NULL;
  WbFieldRef bounding = node ? wb_supervisor_node_get_field(node, "boundingObject") : NULL;
  WbNodeRef box = bounding ? wb_supervisor_field_get_sf_node(bounding) : NULL;
  WbFieldRef size = box ? wb_supervisor_node_get_field(box, "size") : NULL;
  if (!translation || !size) return 0;
  const double *position = wb_supervisor_field_get_sf_vec3f(translation);
  const double *dimensions = wb_supervisor_field_get_sf_vec3f(size);
  if (!position || !dimensions) return 0;
  geometry->x = position[0]; geometry->y = position[1];
  geometry->size_x = dimensions[0]; geometry->size_y = dimensions[1]; geometry->height = dimensions[2];
  return 1;
}

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
  remove_generated_nodes(root_children_field, "WEB_LIMIT_");

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
  remove_generated_nodes(root_children_field, "WEB_SURFACE_");

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
  if (!root_children_field || !registry || !command ||
      (!command->has_spawn_obstacle && !command->has_update_obstacle && !command->has_delete_obstacle)) return;

  const long long compact_id = command->obstacle_id > 0 ? command->obstacle_id : command->id >= 0 ? command->id : 0;
  char def_name[64];
  char node_string[1024];
  snprintf(def_name, sizeof(def_name), "WEB_OBS_%lld", compact_id);
  int tracked_index = -1;
  for (int i = 0; i < registry->count; ++i) {
    if (strcmp(registry->defs[i], def_name) == 0) { tracked_index = i; break; }
  }
  WbNodeRef existing = wb_supervisor_node_get_from_def(def_name);
  if (command->has_delete_obstacle) {
    if (existing) wb_supervisor_node_remove(existing);
    if (tracked_index >= 0) controller_webots_simulation_registry_forget(registry, tracked_index);
    return;
  }
  if (command->has_update_obstacle && !existing) return;
  if (!controller_webots_simulation_format_runtime_obstacle(
          node_string, sizeof(node_string), command, min_x, max_x, min_y, max_y)) {
    return;
  }

  if (tracked_index < 0 && registry->count >= capacity) {
    controller_webots_simulation_registry_remove_at(registry, 0);
  }
  if (existing) wb_supervisor_node_remove(existing);

  const int insert_at = wb_supervisor_field_get_count(root_children_field);
  wb_supervisor_field_import_mf_node_from_string(root_children_field, insert_at, node_string);
  if (tracked_index < 0) controller_webots_simulation_registry_track(registry, capacity, def_name);
}
