#include "controller_webots_camera_perception.h"

#include <assert.h>
#include <cmath>
#include <stdio.h>
#include <string.h>

static void check_recorded_empty_floor(void) {
  FILE *file = fopen("fixtures/empty-floor.ppm", "rb");
  assert(file);
  char magic[3];
  int width, height, maximum;
  assert(fscanf(file, "%2s %d %d %d", magic, &width, &height, &maximum) == 4);
  assert(strcmp(magic, "P6") == 0 && width == 320 && height == 180 && maximum == 255);
  fgetc(file);
  static unsigned char rgb[320 * 180 * 3];
  static unsigned char bgra[320 * 180 * 4];
  assert(fread(rgb, 1, sizeof(rgb), file) == sizeof(rgb));
  fclose(file);
  for (int i = 0; i < 320 * 180; ++i) {
    bgra[i * 4] = rgb[i * 3 + 2];
    bgra[i * 4 + 1] = rgb[i * 3 + 1];
    bgra[i * 4 + 2] = rgb[i * 3];
    bgra[i * 4 + 3] = 255;
  }
  ControllerWebotsCameraPerception perception{};
  controller_webots_camera_perception_analyze(bgra, 320, 180, 1.2, .025, &perception);
  float clear[101];
  for (auto &range : clear) range = INFINITY;
  assert(!controller_webots_camera_perception_fuse_lidar(
      &perception, clear, 101, 1.2, .20, .12, 4.5, 0, 0, 0, 0, 0, 1));
  assert(!perception.visible);
  assert(!perception.obstacle_lidar_confirmed);
}

static void check_closer_lidar_obstacle(void) {
  ControllerWebotsCameraPerception perception{};
  perception.object_count = 1;
  auto &object = perception.objects[0];
  object.min_x = 110;
  object.max_x = 210;
  object.min_y = 40;
  object.max_y = 160;
  object.pixel_count = 2000;
  object.visual_range_m = 2.0;
  object.range_m = 2.0;
  object.half_angle_width = .20;

  float obstacle[101];
  for (auto &range : obstacle) range = .80f;
  assert(controller_webots_camera_perception_fuse_lidar(
      &perception, obstacle, 101, 1.2, .20, .12, 4.5, 0, 0, 0, 0, 0, 1));
  assert(object.occluded_by_lidar);
  assert(perception.visible && perception.obstacle_lidar_confirmed);
  assert(fabs(perception.fallback_range_m - .8) < 1e-6);
}

int main(void) {
  check_recorded_empty_floor();
  check_closer_lidar_obstacle();
  return 0;
}
