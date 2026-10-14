#include "controller_perception_runtime.h"

#include "controller_lidar_trace.h"

#include <string.h>

void controller_perception_runtime_init(ControllerPerceptionRuntime *runtime) {
  if (!runtime) return;
  memset(runtime, 0, sizeof(*runtime));
  strcpy(runtime->camera.frame.file_name, "camera_frame.bmp");
  strcpy(runtime->camera.frame.mime_type, "image/bmp");
  runtime->camera.obstacle_update_step = -1;
}

void controller_perception_runtime_configure(
    ControllerPerceptionRuntime *runtime,
    const ControllerPerceptionSensorMetadata *metadata) {
  if (!runtime || !metadata) return;
  runtime->lidar.available = metadata->lidar_available;
  runtime->lidar.resolution = metadata->lidar_resolution;
  runtime->lidar.fov = metadata->lidar_fov;
  runtime->lidar.max_range = metadata->lidar_max_range;
  runtime->camera.available = metadata->camera_available;
  runtime->camera.virtual_mode = metadata->camera_virtual_mode;
  runtime->camera.width = metadata->camera_width;
  runtime->camera.height = metadata->camera_height;
  runtime->camera.fov = metadata->camera_fov;
}

void controller_perception_runtime_reset_camera_observation(
    ControllerPerceptionRuntime *runtime, int update_step) {
  if (!runtime) return;
  runtime->camera.obstacle_visible = 0;
  runtime->camera.obstacle_score = 0.0;
  runtime->camera.obstacle_center_offset = 0.0;
  runtime->camera.obstacle_angle = 0.0;
  runtime->camera.obstacle_range = 0.0;
  runtime->camera.detection_count = 0;
  runtime->camera.obstacle_update_step = update_step;
}

void controller_perception_runtime_update_camera(
    ControllerPerceptionRuntime *runtime,
    const ControllerPerceptionCameraObservation *observation) {
  if (!runtime || !observation) return;
  runtime->camera.obstacle_visible = observation->visible;
  runtime->camera.obstacle_score = observation->score;
  runtime->camera.obstacle_center_offset = observation->center_offset;
  runtime->camera.obstacle_angle = observation->angle;
  runtime->camera.obstacle_range = observation->range;
  runtime->camera.detection_count = observation->detection_count;
  runtime->camera.obstacle_update_step = observation->update_step;
}

void controller_perception_runtime_capture_lidar(
    ControllerPerceptionRuntime *runtime,
    const ControllerLidarScanConfig *config,
    const float *ranges,
    double robot_x,
    double robot_y,
    double heading,
    double now_time,
    double trace_ttl_seconds) {
  if (!runtime || !config) return;
  runtime->lidar.stats = ControllerLidarScanStats{0};
  runtime->lidar.stats.front_min_range = config->max_trace_range;
  runtime->lidar.stats.center_min_range = config->max_trace_range;
  runtime->lidar.stats.left_front_min_range = config->max_trace_range;
  runtime->lidar.stats.right_front_min_range = config->max_trace_range;
  runtime->lidar.stats.left_min_range = config->max_trace_range;
  runtime->lidar.stats.right_min_range = config->max_trace_range;
  if (!runtime->lidar.available || !ranges || runtime->lidar.resolution <= 1 ||
      runtime->lidar.fov <= 1e-9) return;

  controller_lidar_trace_prune(
      runtime->trace, &runtime->trace_count, now_time, trace_ttl_seconds);
  controller_lidar_scan_capture(
      config,
      ranges,
      runtime->lidar.resolution,
      runtime->lidar.fov,
      runtime->lidar.max_range,
      robot_x,
      robot_y,
      heading,
      now_time,
      runtime->trace,
      &runtime->trace_count,
      CONTROLLER_PERCEPTION_MAX_TRACE_POINTS,
      &runtime->lidar.stats);
}

ControllerPerceptionFrame controller_perception_runtime_frame(
    const ControllerPerceptionRuntime *runtime) {
  if (!runtime) return ControllerPerceptionFrame{0};
  return ControllerPerceptionFrame{
      &runtime->lidar, &runtime->camera, runtime->trace, runtime->trace_count};
}

ControllerCameraPublicationRequest controller_perception_runtime_camera_publication_request(
    const ControllerPerceptionRuntime *runtime, int due) {
  if (!runtime || !due || !runtime->camera.available) {
    return ControllerCameraPublicationRequest{0};
  }
  return ControllerCameraPublicationRequest{
      1, runtime->camera.virtual_mode, runtime->camera.width, runtime->camera.height};
}
