#include "controller_webots_camera_map_sync.h"

#include <cmath>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

static ControllerWebotsCameraMapSyncContext create_context(
    MapCell *obstacles,
    int *obstacle_count,
    MapCell *free_cells,
    int *free_count) {
  const ControllerCameraMapGeometryConfig geometry = {
      0.0, 0.0, 0.05, 8.0, 0.20, 0.10, 0.20, 0.10};
  const ControllerCameraPose pose = {1.0, 2.0, 0.0};
  return ControllerWebotsCameraMapSyncContext{
      obstacles, obstacle_count, 4,
      free_cells, free_count, 8,
      0.10, TEST_EPS, geometry, pose};
}

int main(void) {
  MapCell obstacles[4] = {0};
  MapCell free_cells[8] = {0};
  int obstacle_count = 0;
  int free_count = 0;
  ControllerWebotsCameraMapSyncContext context = create_context(
      obstacles, &obstacle_count, free_cells, &free_count);

  if (!controller_webots_camera_map_sync_free_ray(&context, 0.0, 0.80, 2)) {
    return 1;
  }
  if (free_count != 2 || !nearly_equal(free_cells[0].x, 1.40) ||
      !nearly_equal(free_cells[0].y, 2.00)) {
    return 2;
  }
  if (!controller_webots_camera_map_sync_observation(&context, 0.0, 0.80, 3)) {
    return 3;
  }
  if (obstacle_count != 1 || !nearly_equal(obstacles[0].x, 1.80) ||
      !nearly_equal(obstacles[0].y, 2.00) || obstacles[0].confidence != 3) {
    return 4;
  }
  if (free_count != 2) return 5;
  if (controller_webots_camera_map_sync_free_ray(&context, NAN, 0.80, 1)) {
    return 6;
  }
  if (controller_webots_camera_map_sync_observation(&context, 0.0, 8.10, 1)) {
    return 7;
  }

  return 0;
}
