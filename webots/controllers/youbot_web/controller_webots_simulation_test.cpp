#include <assert.h>
#include <string.h>

#include "controller_types.h"
#include "controller_webots_simulation_format.h"
#include "controller_webots_simulation_registry.h"

int main(void) {
  ControllerWebotsSimulationNodeRegistry registry = {0};
  assert(controller_webots_simulation_registry_track(&registry, 2, "WEB_OBS_1"));
  assert(controller_webots_simulation_registry_track(&registry, 2, "WEB_OBS_2"));
  assert(!controller_webots_simulation_registry_track(&registry, 2, "WEB_OBS_3"));
  assert(registry.count == 2);
  controller_webots_simulation_registry_forget(&registry, 0);
  assert(registry.count == 1);
  assert(strcmp(registry.defs[0], "WEB_OBS_2") == 0);
  assert(registry.defs[1][0] == '\0');

  char node_string[1024] = {0};
  const int written = controller_webots_simulation_format_limit_wall(
      node_string,
      sizeof(node_string),
      "WEB_LIMIT_2_3",
      1.0,
      2.0,
      4.0,
      6.0,
      0.08,
      0.45);

  assert(written > 0);
  assert(strstr(node_string, "DEF WEB_LIMIT_2_3 Solid {") != NULL);
  assert(strstr(node_string, "translation 2.500000 4.000000 0.225000") != NULL);
  assert(strstr(node_string, "rotation 0 0 1 0.927295") != NULL);
  assert(strstr(node_string, "name \"dynamic_zone_wall\"") != NULL);
  assert(strstr(node_string, "baseColor 0.1176 0.4510 0.9725") != NULL);
  assert(strstr(node_string, "geometry Box { size 5.000000 0.080000 0.450000 }") != NULL);
  assert(strstr(node_string, "boundingObject Box { size 5.000000 0.080000 0.450000 }") != NULL);
  assert(strstr(node_string, "locked TRUE") != NULL);

  SurfaceZone surface = {0};
  strcpy(surface.surface_key, "rough");
  surface.point_count = 3;
  surface.points[0].x = 0.0;
  surface.points[0].y = 0.0;
  surface.points[1].x = 1.0;
  surface.points[1].y = 0.0;
  surface.points[2].x = 0.0;
  surface.points[2].y = 1.0;
  memset(node_string, 0, sizeof(node_string));
  const int surface_written = controller_webots_simulation_format_surface_zone(
      node_string, sizeof(node_string), &surface, 4);

  assert(surface_written > 0);
  assert(strstr(node_string, "DEF WEB_SURFACE_4 Pose {") != NULL);
  assert(strstr(node_string, "baseColor 0.9300 0.5400 0.0800") != NULL);
  assert(strstr(node_string, "point [ 0.000000 0.000000 0.016000, 1.000000 0.000000 0.016000, 0.000000 1.000000 0.016000,  ]") != NULL);
  assert(strstr(node_string, "coordIndex [ 0 1 2 -1 ]") != NULL);
  if (strstr(node_string, "solid FALSE") != NULL) return 1;

  RuntimeCommand obstacle = {0};
  obstacle.id = 37;
  obstacle.has_spawn_obstacle = 1;
  obstacle.x = 30.0;
  obstacle.y = -30.0;
  obstacle.size_x = 0.1;
  obstacle.size_y = 5.0;
  obstacle.height = 1.2;
  memset(node_string, 0, sizeof(node_string));
  const int obstacle_written = controller_webots_simulation_format_runtime_obstacle(
      node_string, sizeof(node_string), &obstacle, -21.5, 21.5, -16.5, 16.5);

  assert(obstacle_written > 0);
  assert(strstr(node_string, "DEF WEB_OBS_37 Solid {") != NULL);
  assert(strstr(node_string, "translation 21.500000 -16.500000 0.600000") != NULL);
  assert(strstr(node_string, "name \"runtime_obstacle\"") != NULL);
  assert(strstr(node_string, "baseColor 0.7608 0.2549 0.1451") != NULL);
  assert(strstr(node_string, "geometry Box { size 0.200000 3.500000 1.200000 }") != NULL);
  assert(strstr(node_string, "boundingObject Box { size 0.200000 3.500000 1.200000 }") != NULL);
  return 0;
}
