#include "controller_webots_camera_perception.h"
#include "controller_camera_fusion.h"

#include <assert.h>
#include <math.h>
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
  ControllerWebotsCameraPerception perception;
  assert(controller_webots_camera_perception_analyze(bgra, 320, 180, 1.2, .025, &perception));
  assert(perception.detection_count == 103);
  assert(!controller_webots_camera_perception_confirm_range(&perception, NAN));
  assert(!perception.visible);
}

int main(void) {
  check_recorded_empty_floor();
  /* A warm floor and a red object can have identical RGB values. Colour alone
     must never supply a made-up obstacle range to navigation or mapping. */
  unsigned char image[32 * 32 * 4];
  for (int i = 0; i < 32 * 32; ++i) {
    image[i * 4] = 55;
    image[i * 4 + 1] = 65;
    image[i * 4 + 2] = 180;
    image[i * 4 + 3] = 255;
  }
  ControllerWebotsCameraPerception perception;
  assert(controller_webots_camera_perception_analyze(image, 32, 32, 1.2, .025, &perception));
  const float clear[] = {INFINITY, 4.5f, NAN, 4.49f, INFINITY};
  double range = controller_camera_fusion_estimate_range(clear, 5, 1.2, 0, .2, .12, 4.5, NAN);
  assert(!controller_webots_camera_perception_confirm_range(&perception, range));
  assert(!perception.visible);
  assert(perception.score > .025);

  controller_webots_camera_perception_analyze(image, 32, 32, 1.2, .025, &perception);
  range = controller_camera_fusion_estimate_range(NULL, 0, 1.2, 0, .2, .12, 4.5, NAN);
  assert(!controller_webots_camera_perception_confirm_range(&perception, range));

  controller_webots_camera_perception_analyze(image, 32, 32, 1.2, .025, &perception);
  const float obstacle[] = {INFINITY, INFINITY, .8f, INFINITY, INFINITY};
  range = controller_camera_fusion_estimate_range(obstacle, 5, 1.2, 0, .2, .12, 4.5, NAN);
  assert(controller_webots_camera_perception_confirm_range(&perception, range));
  assert(fabs(range - .8) < 1e-6);
  return 0;
}
