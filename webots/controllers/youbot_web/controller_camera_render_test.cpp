#include "controller_camera_render.h"

#include <string.h>

#define WIDTH 20
#define HEIGHT 10

static const unsigned char *pixel_at(const unsigned char *pixels, int x, int y) {
  return pixels + (y * WIDTH + x) * 3;
}

int main(void) {
  unsigned char pixels[WIDTH * HEIGHT * 3];
  memset(pixels, 0, sizeof(pixels));

  controller_camera_render_set_pixel(pixels, WIDTH, HEIGHT, 2, 3, 300, -4, 120);
  const unsigned char *pixel = pixel_at(pixels, 2, 3);
  if (pixel[0] != 255 || pixel[1] != 0 || pixel[2] != 120) return 1;
  controller_camera_render_set_pixel(pixels, WIDTH, HEIGHT, -1, 3, 1, 2, 3);
  if (pixels[0] != 0) return 2;

  controller_camera_render_rect(pixels, WIDTH, HEIGHT, -2, -2, 1, 1, 10, 20, 30);
  if (pixel_at(pixels, 0, 0)[0] != 10 || pixel_at(pixels, 1, 1)[2] != 30 ||
      pixel_at(pixels, 2, 1)[0] != 0) {
    return 3;
  }

  memset(pixels, 0, sizeof(pixels));
  controller_camera_render_line(pixels, WIDTH, HEIGHT, 0, 0, 4, 4, 7, 8, 9);
  if (pixel_at(pixels, 0, 0)[0] != 7 || pixel_at(pixels, 2, 2)[1] != 8 ||
      pixel_at(pixels, 4, 4)[2] != 9 || pixel_at(pixels, 3, 2)[0] != 0) {
    return 4;
  }

  controller_camera_render_background(pixels, WIDTH, HEIGHT);
  pixel = pixel_at(pixels, 0, 0);
  if (pixel[0] != 78 || pixel[1] != 120 || pixel[2] != 148) return 5;

  memset(pixels, 0, sizeof(pixels));
  controller_camera_render_box(pixels, WIDTH, HEIGHT, 10, 9, 8, 6, 0.0);
  pixel = pixel_at(pixels, 10, 6);
  if (pixel[0] != 188 || pixel[1] != 82 || pixel[2] != 58) return 6;

  memset(pixels, 0, sizeof(pixels));
  controller_camera_render_reticle(pixels, WIDTH, HEIGHT);
  pixel = pixel_at(pixels, WIDTH / 2, (int)(HEIGHT * 0.42));
  if (pixel[0] != 80 || pixel[1] != 220 || pixel[2] != 230) return 7;

  memset(pixels, 0, sizeof(pixels));
  controller_camera_render_waypoint_marker(pixels, WIDTH, HEIGHT, WIDTH / 2);
  pixel = pixel_at(pixels, WIDTH / 2, 1);
  if (pixel[0] != 55 || pixel[1] != 222 || pixel[2] != 170) return 8;

  return 0;
}
