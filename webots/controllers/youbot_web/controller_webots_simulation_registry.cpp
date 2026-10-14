#include "controller_webots_simulation_registry.h"

#include <string.h>

int controller_webots_simulation_registry_track(
    ControllerWebotsSimulationNodeRegistry *registry,
    int capacity,
    const char *def_name) {
  if (!registry || !def_name || capacity <= 0 ||
      capacity > CONTROLLER_WEBOTS_SIMULATION_MAX_NODE_REGISTRY ||
      registry->count >= capacity) {
    return 0;
  }
  strncpy(registry->defs[registry->count], def_name, sizeof(registry->defs[0]) - 1);
  registry->defs[registry->count][sizeof(registry->defs[0]) - 1] = '\0';
  registry->count += 1;
  return 1;
}

void controller_webots_simulation_registry_forget(
    ControllerWebotsSimulationNodeRegistry *registry,
    int index) {
  if (!registry || index < 0 || index >= registry->count) return;
  for (int i = index + 1; i < registry->count; ++i) {
    memcpy(registry->defs[i - 1], registry->defs[i], sizeof(registry->defs[0]));
  }
  registry->count -= 1;
  registry->defs[registry->count][0] = '\0';
}
