#include "controller_mapping_store.h"

#include "controller_camera_map_io.h"
#include "controller_obstacle_map.h"

void controller_mapping_store_init(ControllerMappingStore *store) {
  if (!store) return;
  *store = ControllerMappingStore{0};
}

ControllerMappingStoreSnapshot controller_mapping_store_snapshot(const ControllerMappingStore *store) {
  if (!store) return ControllerMappingStoreSnapshot{0};
  return ControllerMappingStoreSnapshot{
      store->persistent_map, store->persistent_count,
      store->camera_map, store->camera_count,
      store->camera_free_map, store->camera_free_count};
}

void controller_mapping_store_clear(ControllerMappingStore *store, const ControllerMappingStorePaths *paths) {
  if (!store) return;
  controller_mapping_store_init(store);
  if (!paths) return;
  controller_obstacle_map_clear_files(paths->map_path, paths->map_temp_path,
                                      paths->map_csv_path, paths->map_csv_temp_path);
  controller_camera_map_io_clear_files(paths->camera_path, paths->camera_temp_path,
                                       paths->camera_csv_path, paths->camera_csv_temp_path);
}

int controller_mapping_store_write(
    ControllerMappingStore *store, const ControllerMappingStorePaths *paths,
    double map_cell_size, double camera_cell_size) {
  if (!store || !paths) return 0;
  int written = 0;
  if (store->persistent_dirty && controller_obstacle_map_write(
          paths->map_path, paths->map_temp_path, paths->map_csv_path, paths->map_csv_temp_path,
          map_cell_size, store->persistent_map, store->persistent_count)) {
    store->persistent_dirty = 0; written = 1;
  }
  if (store->camera_dirty && controller_camera_map_io_write(
          paths->camera_path, paths->camera_temp_path, paths->camera_csv_path, paths->camera_csv_temp_path,
          camera_cell_size, store->camera_map, store->camera_count,
          store->camera_free_map, store->camera_free_count)) {
    store->camera_dirty = 0; written = 1;
  }
  return written;
}
