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

static void check_box_association(void) {
  ControllerWebotsCameraPerception frame{};
  frame.camera = {.width = 320, .height = 180, .focal_px = 280,
                  .position = {0, 0, .327},
                  .orientation = {1, 0, 0, 0, 1, 0, 0, 0, 1}};
  frame.object_count = 1;
  auto &detection = frame.objects[0];
  detection.min_x = 155;
  detection.max_x = 165;
  detection.min_y = 146;
  detection.max_y = 167;
  detection.low_profile_confirmed = 1;
  detection.world_x = 1.2;
  const double orientation[9] = {1, 0, 0, 0, 1, 0, 0, 0, 1};
  const double size[3] = {.03, .03, .08};
  const double visible[3] = {1.2, 0, .04};
  const double beside_detection[3] = {1.2, .08, .04};
  const double behind_detection[3] = {1.36, 0, .04};
  assert(controller_webots_camera_count_box_matches(&frame, visible, orientation, size) == 1);
  assert(controller_webots_camera_count_box_matches(&frame, beside_detection, orientation, size) == 0);
  assert(controller_webots_camera_count_box_matches(&frame, behind_detection, orientation, size) == 0);

  detection.min_x = 0;
  detection.max_x = 10;
  detection.world_z = .64;
  const double clipped[3] = {1.2, .68, .04};
  assert(controller_webots_camera_count_box_matches(&frame, clipped, orientation, size) == 0);

  detection.min_x = 155;
  detection.max_x = 165;
  detection.world_z = 0;
  frame.objects[1] = detection;
  frame.object_count = 2;
  assert(controller_webots_camera_count_box_matches(&frame, visible, orientation, size) == 2);
}

int main(void) {
  check_recorded_empty_floor();
  check_closer_lidar_obstacle();
  check_box_association();
  return 0;
}
