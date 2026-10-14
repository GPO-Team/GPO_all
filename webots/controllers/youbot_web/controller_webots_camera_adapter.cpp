#include "controller_webots_camera_adapter.h"

#include "controller_io.h"

#include <stdio.h>
#include <string.h>

int controller_webots_camera_adapter_publish_frame(
    const char *temp_path,
    const char *final_path,
    const char *file_name,
    const char *mime_type,
    double time,
    ControllerWebotsCameraFrameMetadata *metadata) {
  if (!temp_path || !final_path || !file_name || !mime_type || !metadata ||
      replace_file(temp_path, final_path) != 0) return 0;
  strncpy(metadata->file_name, file_name, sizeof(metadata->file_name) - 1);
  metadata->file_name[sizeof(metadata->file_name) - 1] = '\0';
  strncpy(metadata->mime_type, mime_type, sizeof(metadata->mime_type) - 1);
  metadata->mime_type[sizeof(metadata->mime_type) - 1] = '\0';
  metadata->sequence += 1;
  metadata->time = time;
  return 1;
}

void controller_webots_camera_adapter_remove_frames(
    const char *bmp_path,
    const char *bmp_temp_path,
    const char *jpeg_path,
    const char *jpeg_temp_path) {
  if (bmp_path) remove(bmp_path);
  if (bmp_temp_path) remove(bmp_temp_path);
  if (jpeg_path) remove(jpeg_path);
  if (jpeg_temp_path) remove(jpeg_temp_path);
}
