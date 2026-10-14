#include "controller_camera.h"

#include <cmath>

static double clamp_value(double value, double min_value, double max_value) {
  if (value < min_value) return min_value;
  if (value > max_value) return max_value;
  return value;
}

static int camera_geometry_input_valid(
    const ControllerCameraMapGeometryConfig *config,
    const ControllerCameraPose *pose,
    double relative_angle,
    double range) {
  return config && pose && std::isfinite(pose->x) && std::isfinite(pose->y) &&
         std::isfinite(pose->heading) && std::isfinite(relative_angle) && std::isfinite(range) &&
         std::isfinite(config->sensor_local_x) && std::isfinite(config->sensor_local_y) &&
         config->min_trace_range >= 0.0 && config->max_trace_range >= config->min_trace_range &&
         config->free_ray_min_range >= 0.0 && config->free_ray_margin >= 0.0 &&
         config->free_ray_step > 0.0 && config->near_robot_ignore_radius >= 0.0;
}

static ControllerCameraMapPoint camera_sensor_origin(
    const ControllerCameraMapGeometryConfig *config,
    const ControllerCameraPose *pose) {
  return ControllerCameraMapPoint{
      pose->x + cos(pose->heading) * config->sensor_local_x -
          sin(pose->heading) * config->sensor_local_y,
      pose->y + sin(pose->heading) * config->sensor_local_x +
          cos(pose->heading) * config->sensor_local_y,
  };
}

int controller_camera_obstacle_point(
    const ControllerCameraMapGeometryConfig *config,
    const ControllerCameraPose *pose,
    double relative_angle,
    double range,
    ControllerCameraMapPoint *point) {
  if (!point || !camera_geometry_input_valid(config, pose, relative_angle, range)) return 0;
  if (range < config->min_trace_range || range > config->max_trace_range) return 0;

  const ControllerCameraMapPoint origin = camera_sensor_origin(config, pose);
  const double world_angle = pose->heading - relative_angle;
  const ControllerCameraMapPoint candidate = {
      origin.x + cos(world_angle) * range,
      origin.y + sin(world_angle) * range,
  };
  if (hypot(candidate.x - pose->x, candidate.y - pose->y) <
      config->near_robot_ignore_radius) {
    return 0;
  }

  *point = candidate;
  return 1;
}

int controller_camera_free_ray_points(
    const ControllerCameraMapGeometryConfig *config,
    const ControllerCameraPose *pose,
    double relative_angle,
    double range,
    ControllerCameraMapPoint *points,
    int capacity) {
  if (!points || capacity <= 0 ||
      !camera_geometry_input_valid(config, pose, relative_angle, range)) {
    return 0;
  }
  if (range < config->free_ray_min_range) return 0;

  const ControllerCameraMapPoint origin = camera_sensor_origin(config, pose);
  const double world_angle = pose->heading - relative_angle;
  const double usable_range = clamp_value(
      range - config->free_ray_margin,
      config->free_ray_min_range,
      config->max_trace_range);
  const int steps = (int)floor(usable_range / config->free_ray_step);
  int count = 0;

  for (int step = 2; step <= steps && count < capacity; ++step) {
    const double distance = (double)step * config->free_ray_step;
    const ControllerCameraMapPoint candidate = {
        origin.x + cos(world_angle) * distance,
        origin.y + sin(world_angle) * distance,
    };
    if (hypot(candidate.x - pose->x, candidate.y - pose->y) <
        config->near_robot_ignore_radius) {
      continue;
    }
    points[count++] = candidate;
  }

  return count;
}

