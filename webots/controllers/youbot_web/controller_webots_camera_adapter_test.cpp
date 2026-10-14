#include "controller_webots_camera_adapter.h"

#include <stdio.h>

int main(void) {
  const char *temp_path = "camera_adapter_test.tmp";
  const char *final_path = "camera_adapter_test.bmp";
  FILE *file = fopen(temp_path, "wb");
  if (!file) return 1;
  fputs("frame", file);
  fclose(file);

  ControllerWebotsCameraFrameMetadata metadata = {0};
  if (!controller_webots_camera_adapter_publish_frame(
          temp_path, final_path, "camera_frame.bmp", "image/bmp", 4.5, &metadata)) {
    return 2;
  }
  if (metadata.sequence != 1 || metadata.time != 4.5 ||
      metadata.file_name[0] == '\0' || metadata.mime_type[0] == '\0') return 3;
  remove(final_path);
  return 0;
}
