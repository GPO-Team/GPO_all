#include "controller_mapping_store.h"

int main(void) {
  ControllerMappingStore store;
  controller_mapping_store_init(&store);
  const ControllerMappingStoreSnapshot snapshot = controller_mapping_store_snapshot(&store);
  if (!snapshot.persistent_map || snapshot.persistent_count != 0 ||
      !snapshot.camera_map || snapshot.camera_count != 0 ||
      !snapshot.camera_free_map || snapshot.camera_free_count != 0) return 1;
  return 0;
}
