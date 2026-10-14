#include "controller_mapping_runtime.h"

#include "controller_lidar_trace.h"

static int controller_mapping_runtime_has_paths(const ControllerMappingRuntime *runtime) {
  return runtime && runtime->config.paths.map_path && runtime->config.paths.map_temp_path &&
         runtime->config.paths.map_csv_path && runtime->config.paths.map_csv_temp_path &&
         runtime->config.paths.camera_path && runtime->config.paths.camera_temp_path &&
         runtime->config.paths.camera_csv_path && runtime->config.paths.camera_csv_temp_path;
}

void controller_mapping_runtime_init(
    ControllerMappingRuntime *runtime,
    const ControllerMappingRuntimeConfig *config) {
  if (!runtime) return;
  runtime->config = config ? *config : ControllerMappingRuntimeConfig{0};
  controller_mapping_store_init(&runtime->store);
}

ControllerMappingRuntimeMaps controller_mapping_runtime_maps(
    ControllerMappingRuntime *runtime) {
  if (!runtime) return ControllerMappingRuntimeMaps{0};
  return ControllerMappingRuntimeMaps{
      runtime->store.persistent_map,
      &runtime->store.persistent_count,
      &runtime->store.persistent_dirty,
      runtime->store.camera_map,
      &runtime->store.camera_count,
      runtime->store.camera_free_map,
      &runtime->store.camera_free_count,
      &runtime->store.camera_dirty,
  };
}

void controller_mapping_runtime_clear(ControllerMappingRuntime *runtime) {
  if (!runtime) return;
  if (controller_mapping_runtime_has_paths(runtime)) {
    controller_mapping_store_clear(&runtime->store, &runtime->config.paths);
    return;
  }
  controller_mapping_store_init(&runtime->store);
}

int controller_mapping_runtime_write(ControllerMappingRuntime *runtime, int due) {
  if (!runtime || !due || !controller_mapping_runtime_has_paths(runtime)) return 0;
  return controller_mapping_store_write(
      &runtime->store,
      &runtime->config.paths,
      runtime->config.map_cell_size,
      runtime->config.camera_cell_size);
}

void controller_mapping_runtime_merge_trace(
    ControllerMappingRuntime *runtime,
    const ObstacleTracePoint *trace,
    int trace_count,
    double now_time,
    double max_age_seconds,
    int min_hit_count,
    double epsilon) {
  if (!runtime) return;
  controller_lidar_trace_merge_into_map(
      trace,
      trace_count,
      now_time,
      max_age_seconds,
      min_hit_count,
      runtime->store.persistent_map,
      &runtime->store.persistent_count,
      CONTROLLER_MAPPING_STORE_MAX_PERSISTENT,
      runtime->config.map_cell_size,
      epsilon,
      &runtime->store.persistent_dirty);
}
