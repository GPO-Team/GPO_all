#include "controller_perception_runtime.h"

#include <cmath>
#include <string.h>

int main(void) {
  ControllerPerceptionRuntime runtime;
  controller_perception_runtime_init(&runtime);
  if (strcmp(runtime.camera.frame.file_name, "camera_frame.bmp") != 0) return 1;
  if (strcmp(runtime.camera.frame.mime_type, "image/bmp") != 0) return 2;
  if (runtime.camera.obstacle_update_step != -1) return 3;

  const ControllerPerceptionSensorMetadata metadata = {
      .lidar_available = 1,
      .lidar_resolution = 3,
      .lidar_fov = 1.0,
      .lidar_max_range = 3.0,
      .camera_available = 1,
      .camera_virtual_mode = 1,
      .camera_width = 320,
      .camera_height = 180,
      .camera_fov = 1.05,
  };
  controller_perception_runtime_configure(&runtime, &metadata);
  if (!runtime.lidar.available || runtime.lidar.resolution != 3) return 4;
  if (!runtime.camera.available || !runtime.camera.virtual_mode) return 5;

  const ControllerPerceptionCameraObservation observation = {
      .visible = 1,
      .score = 0.4,
      .center_offset = -0.2,
      .angle = -0.1,
      .range = 0.8,
      .detection_count = 7,
      .update_step = 12,
  };
  controller_perception_runtime_update_camera(&runtime, &observation);
  const ControllerPerceptionFrame frame = controller_perception_runtime_frame(&runtime);
  if (!frame.camera->obstacle_visible || frame.camera->detection_count != 7) return 6;
  if (fabs(frame.camera->obstacle_range - 0.8) > 1e-9) return 7;

  const ControllerCameraPublicationRequest request =
      controller_perception_runtime_camera_publication_request(&runtime, 1);
  if (!request.requested || !request.virtual_mode) return 8;
  if (request.width != 320 || request.height != 180) return 9;

  const float ranges[] = {INFINITY, 0.8f, INFINITY};
  const ControllerLidarScanConfig scan = {
      .sample_stride = 1,
      .min_trace_range = 0.12,
      .max_trace_range = 3.0,
      .range_jump_tolerance = 1.0,
      .sensor_local_x = 0.0,
      .sensor_local_y = 0.0,
      .front_sector_rad = 0.5,
      .center_sector_rad = 0.2,
      .front_corner_min_rad = 0.2,
      .front_corner_max_rad = 0.5,
      .near_robot_ignore_radius = 0.1,
      .snap_step = 0.01,
      .trace_spacing = 0.05,
  };
  controller_perception_runtime_capture_lidar(
      &runtime, &scan, ranges, 0.0, 0.0, 0.0, 1.0, 6.0);
  if (runtime.trace_count != 1) return 10;
  if (runtime.lidar.stats.hit_count != 1) return 11;

  controller_perception_runtime_reset_camera_observation(&runtime, 13);
  if (runtime.camera.obstacle_visible || runtime.camera.detection_count != 0) return 12;
  if (runtime.camera.obstacle_update_step != 13) return 13;
  return 0;
}
