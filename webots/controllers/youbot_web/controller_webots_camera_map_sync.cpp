#include "controller_webots_camera_map_sync.h"

#include "controller_camera_map.h"
#include "controller_math.h"

static int context_has_storage(const ControllerWebotsCameraMapSyncContext *context) {
  return context && context->obstacles && context->obstacle_count &&
         context->obstacle_capacity > 0 && context->free_cells && context->free_count &&
         context->free_capacity > 0 && controller_math_is_finite(context->cell_size) &&
         context->cell_size > 0.0 && controller_math_is_finite(context->epsilon) &&
         context->epsilon >= 0.0;
}

int controller_webots_camera_map_sync_free_ray(
    ControllerWebotsCameraMapSyncContext *context,
    double relative_angle,
    double range,
    int confidence_boost) {
  if (!context_has_storage(context) || !controller_math_is_finite(relative_angle) ||
      !controller_math_is_finite(range) || range < context->geometry.free_ray_min_range) {
    return 0;
  }

  ControllerCameraMapPoint points[32];
  const int point_count = controller_camera_free_ray_points(
      &context->geometry, &context->pose, relative_angle, range, points, 32);
  int changed = 0;
  for (int index = 0; index < point_count; ++index) {
    changed |= controller_camera_map_append_free(
        context->obstacles,
        *context->obstacle_count,
        context->free_cells,
        context->free_count,
        context->free_capacity,
        context->cell_size,
        context->epsilon,
        points[index].x,
        points[index].y,
        confidence_boost);
  }
  return changed;
}

int controller_webots_camera_map_sync_observation(
    ControllerWebotsCameraMapSyncContext *context,
    double relative_angle,
    double range,
    int confidence_boost) {
  if (!context_has_storage(context) || !controller_math_is_finite(relative_angle) ||
      !controller_math_is_finite(range)) {
    return 0;
  }

  ControllerCameraMapPoint point;
  if (!controller_camera_obstacle_point(
          &context->geometry, &context->pose, relative_angle, range, &point)) {
    return 0;
  }
  return controller_camera_map_append_obstacle(
      context->obstacles,
      context->obstacle_count,
      context->obstacle_capacity,
      context->free_cells,
      context->free_count,
      context->cell_size,
      context->epsilon,
      point.x,
      point.y,
      confidence_boost);
}
