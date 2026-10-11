#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_SIMULATION_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_SIMULATION_H

#include "controller_types.h"
#include "controller_webots_simulation_format.h"
#include "controller_webots_simulation_registry.h"

#include <webots/supervisor.h>

void controller_webots_simulation_registry_remove_at(
    ControllerWebotsSimulationNodeRegistry *registry,
    int index);
void controller_webots_simulation_registry_remove_all(
    ControllerWebotsSimulationNodeRegistry *registry);
int controller_webots_simulation_get_obstacle_geometry(long long obstacle_id, RuntimeCommand *geometry);
void controller_webots_simulation_sync_limit_zones(
    WbFieldRef root_children_field,
    ControllerWebotsSimulationNodeRegistry *registry,
    const ZoneData *zones,
    int capacity,
    double wall_thickness,
    double wall_height);
void controller_webots_simulation_sync_surface_zones(
    WbFieldRef root_children_field,
    ControllerWebotsSimulationNodeRegistry *registry,
    const SurfaceZoneData *zones,
    int capacity);
void controller_webots_simulation_spawn_runtime_obstacle(
    WbFieldRef root_children_field,
    ControllerWebotsSimulationNodeRegistry *registry,
    const RuntimeCommand *command,
    int capacity,
    double min_x,
    double max_x,
    double min_y,
    double max_y);

#endif
