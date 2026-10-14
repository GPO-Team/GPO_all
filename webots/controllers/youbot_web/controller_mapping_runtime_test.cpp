#include "controller_mapping_runtime.h"

int main(void) {
  const ControllerMappingRuntimeConfig config = {
      .map_cell_size = 0.05,
      .camera_cell_size = 0.08,
  };
  ControllerMappingRuntime runtime;
  controller_mapping_runtime_init(&runtime, &config);

  ControllerMappingRuntimeMaps maps = controller_mapping_runtime_maps(&runtime);
  if (!maps.persistent_map || *maps.persistent_count != 0 || !maps.persistent_dirty) return 1;
  if (!maps.camera_map || *maps.camera_count != 0 || !maps.camera_dirty) return 2;

  maps.persistent_map[0] = MapCell{1.0, 2.0, 3};
  *maps.persistent_count = 1;
  *maps.persistent_dirty = 1;
  const ObstacleTracePoint trace[] = {{1.0, 2.0, 1.0, 3}};
  controller_mapping_runtime_merge_trace(&runtime, trace, 1, 1.1, 6.0, 1, 0.01);
  if (*maps.persistent_count != 1 || !*maps.persistent_dirty) return 3;

  controller_mapping_runtime_clear(&runtime);
  maps = controller_mapping_runtime_maps(&runtime);
  if (*maps.persistent_count != 0 || *maps.persistent_dirty) return 4;
  if (*maps.camera_count != 0 || *maps.camera_dirty) return 5;
  return 0;
}
