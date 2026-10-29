#include "controller_mapping_store.h"

int main(void) {
  ControllerMappingStore store;
  controller_mapping_store_init(&store);
  const ControllerMappingStoreSnapshot snapshot = controller_mapping_store_snapshot(&store);
  if (!snapshot.persistent_map || snapshot.persistent_count != 0 ||
      !snapshot.camera_map || snapshot.camera_count != 0 ||
      !snapshot.camera_free_map || snapshot.camera_free_count != 0) return 1;
  store.persistent_map[0] = MapCell{2.0, 3.0, 4};
  store.persistent_map[1] = MapCell{2.7, 3.0, 4};
  store.persistent_map[2] = MapCell{8.0, 9.0, 6};
  store.persistent_count = 3;
  store.camera_map[0] = MapCell{2.0, 3.0, 4};
  store.camera_map[1] = MapCell{-8.0, 9.0, 5};
  store.camera_count = 2;
  store.camera_free_count = 1;
  controller_mapping_store_forget_rectangle(&store, 2.0, 3.0, 1.0, 1.0, 0.25);
  if (store.persistent_count != 1 || store.camera_count != 1 || store.camera_free_count != 1) return 2;
  if (store.persistent_map[0].x != 8.0 || store.camera_map[0].x != -8.0) return 3;
  if (!store.persistent_dirty || !store.camera_dirty) return 4;
  return 0;
}
