#include "controller_webots_sensors.h"

#include <webots/camera.h>
#include <webots/lidar.h>

void controller_webots_sensors_init(ControllerWebotsSensors *sensors) {
  if (!sensors) return;
  *sensors = ControllerWebotsSensors{0};
}

int controller_webots_sensors_init_lidar(
    ControllerWebotsSensors *sensors,
    int time_step,
    int *resolution,
    double *fov,
    double *max_range) {
  if (!sensors || !resolution || !fov || !max_range) return 0;
  sensors->lidar = wb_robot_get_device("front_lidar");
  if (!sensors->lidar) return 0;

  wb_lidar_enable(sensors->lidar, time_step);
  *resolution = wb_lidar_get_horizontal_resolution(sensors->lidar);
  *fov = wb_lidar_get_fov(sensors->lidar);
  *max_range = wb_lidar_get_max_range(sensors->lidar);
  return 1;
}

int controller_webots_sensors_init_camera(
    ControllerWebotsSensors *sensors,
    int sampling_period,
    int *width,
    int *height,
    double *fov) {
  if (!sensors || !width || !height || !fov) return 0;
  sensors->camera = wb_robot_get_device("front_camera");
  if (!sensors->camera) return 0;

  wb_camera_enable(sensors->camera, sampling_period);
  *width = wb_camera_get_width(sensors->camera);
  *height = wb_camera_get_height(sensors->camera);
  *fov = wb_camera_get_fov(sensors->camera);
  return 1;
}

int controller_webots_sensors_has_lidar(const ControllerWebotsSensors *sensors) {
  return sensors && sensors->lidar;
}

int controller_webots_sensors_has_camera(const ControllerWebotsSensors *sensors) {
  return sensors && sensors->camera;
}

const float *controller_webots_sensors_lidar_ranges(const ControllerWebotsSensors *sensors) {
  if (!controller_webots_sensors_has_lidar(sensors)) return 0;
  return wb_lidar_get_range_image(sensors->lidar);
}

const unsigned char *controller_webots_sensors_camera_image(
    const ControllerWebotsSensors *sensors) {
  if (!controller_webots_sensors_has_camera(sensors)) return 0;
  return wb_camera_get_image(sensors->camera);
}

void controller_webots_sensors_camera_pixel(
    const unsigned char *image,
    int width,
    int x,
    int y,
    int *red,
    int *green,
    int *blue) {
  if (!image || !red || !green || !blue) return;
  *red = wb_camera_image_get_red(image, width, x, y);
  *green = wb_camera_image_get_green(image, width, x, y);
  *blue = wb_camera_image_get_blue(image, width, x, y);
}

int controller_webots_sensors_save_camera_image(
    const ControllerWebotsSensors *sensors, const char *path, int quality) {
  if (!controller_webots_sensors_has_camera(sensors) || !path) return -1;
  return wb_camera_save_image(sensors->camera, path, quality);
}
