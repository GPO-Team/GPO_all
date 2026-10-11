#ifndef YOUBOT_WEB_CONTROLLER_MAPPING_STORE_H
#define YOUBOT_WEB_CONTROLLER_MAPPING_STORE_H

#include "controller_types.h"

#define CONTROLLER_MAPPING_STORE_MAX_PERSISTENT 4096
#define CONTROLLER_MAPPING_STORE_MAX_CAMERA 2048
#define CONTROLLER_MAPPING_STORE_MAX_CAMERA_FREE 4096

typedef struct {
  MapCell persistent_map[CONTROLLER_MAPPING_STORE_MAX_PERSISTENT];
  int persistent_count;
  int persistent_dirty;
  MapCell camera_map[CONTROLLER_MAPPING_STORE_MAX_CAMERA];
  int camera_count;
  MapCell camera_free_map[CONTROLLER_MAPPING_STORE_MAX_CAMERA_FREE];
  int camera_free_count;
  int camera_dirty;
} ControllerMappingStore;

typedef struct {
  const MapCell *persistent_map;
  int persistent_count;
  const MapCell *camera_map;
  int camera_count;
  const MapCell *camera_free_map;
  int camera_free_count;
} ControllerMappingStoreSnapshot;

typedef struct {
  const char *map_path;
  const char *map_temp_path;
  const char *map_csv_path;
  const char *map_csv_temp_path;
  const char *camera_path;
  const char *camera_temp_path;
  const char *camera_csv_path;
  const char *camera_csv_temp_path;
} ControllerMappingStorePaths;

void controller_mapping_store_init(ControllerMappingStore *store);
ControllerMappingStoreSnapshot controller_mapping_store_snapshot(const ControllerMappingStore *store);
void controller_mapping_store_clear(ControllerMappingStore *store, const ControllerMappingStorePaths *paths);
void controller_mapping_store_forget_rectangle(ControllerMappingStore *store,
    double x, double y, double size_x, double size_y, double margin);
int controller_mapping_store_write(
    ControllerMappingStore *store,
    const ControllerMappingStorePaths *paths,
    double map_cell_size,
    double camera_cell_size);

#endif
