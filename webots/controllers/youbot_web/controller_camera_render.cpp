#include "controller_camera_render.h"

#include <cmath>
#include <stdlib.h>

static double clamp_value(double value, double min_value, double max_value) {
  if (value < min_value) return min_value;
  if (value > max_value) return max_value;
  return value;
}

void controller_camera_render_set_pixel(
    unsigned char *pixels, int width, int height, int x, int y, int r, int g, int b) {
  if (!pixels || width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) return;
  unsigned char *pixel = pixels + (y * width + x) * 3;
  pixel[0] = (unsigned char)clamp_value(r, 0, 255);
  pixel[1] = (unsigned char)clamp_value(g, 0, 255);
  pixel[2] = (unsigned char)clamp_value(b, 0, 255);
}

void controller_camera_render_rect(
    unsigned char *pixels, int width, int height,
    int min_x, int min_y, int max_x, int max_y, int r, int g, int b) {
  if (!pixels || width <= 0 || height <= 0) return;
  min_x = (int)clamp_value(min_x, 0, width - 1);
  max_x = (int)clamp_value(max_x, 0, width - 1);
  min_y = (int)clamp_value(min_y, 0, height - 1);
  max_y = (int)clamp_value(max_y, 0, height - 1);
  if (min_x > max_x || min_y > max_y) return;

  for (int y = min_y; y <= max_y; ++y) {
    for (int x = min_x; x <= max_x; ++x) {
      controller_camera_render_set_pixel(pixels, width, height, x, y, r, g, b);
    }
  }
}

void controller_camera_render_line(
    unsigned char *pixels, int width, int height,
    int x0, int y0, int x1, int y1, int r, int g, int b) {
  const int dx = abs(x1 - x0);
  const int sx = x0 < x1 ? 1 : -1;
  const int dy = -abs(y1 - y0);
  const int sy = y0 < y1 ? 1 : -1;
  int error = dx + dy;

  while (1) {
    controller_camera_render_set_pixel(pixels, width, height, x0, y0, r, g, b);
    if (x0 == x1 && y0 == y1) break;
    const int e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}

void controller_camera_render_background(unsigned char *pixels, int width, int height) {
  if (!pixels || width <= 0 || height <= 0) return;
  const int horizon = (int)(height * 0.42);
  if (horizon <= 0 || horizon >= height) return;
  const double center_x = (double)width * 0.5;
  for (int y = 0; y < height; ++y) {
    for (int x = 0; x < width; ++x) {
      if (y < horizon) {
        const double t = (double)y / (double)horizon;
        const double vignette = fabs((double)x - center_x) / center_x;
        controller_camera_render_set_pixel(
            pixels, width, height, x, y,
            (int)(86 + t * 28 - vignette * 8),
            (int)(126 + t * 20 - vignette * 6),
            (int)(148 + t * 24));
      } else {
        const double yy = (double)(y - horizon + 4);
        const double depth = clamp_value((double)(height - horizon) / yy, 0.32, 18.0);
        const double lateral = ((double)x - center_x) / center_x * depth * 2.7;
        const double forward = depth * 1.35;
        const int tile_x = (int)floor(lateral * 1.4 + 1000.0);
        const int tile_y = (int)floor(forward * 1.55 + 1000.0);
        const int checker = (tile_x + tile_y) & 1;
        const double fog = clamp_value(((double)y - horizon) / (double)(height - horizon), 0.0, 1.0);
        const double side_fade = fabs((double)x - center_x) / center_x;
        const int base = checker ? 151 : 108;
        controller_camera_render_set_pixel(
            pixels, width, height, x, y,
            (int)(base + 40 * (1.0 - fog) - side_fade * 10),
            (int)(base - 18 + 26 * (1.0 - fog) - side_fade * 8),
            (int)(base - 31 + 20 * (1.0 - fog)));
      }
    }
  }

  for (int line = -6; line <= 6; ++line) {
    const int bottom_x = (int)(center_x + line * 44);
    const int horizon_x = (int)(center_x + line * 4);
    const int steps = height - horizon;
    for (int i = 0; i < steps; ++i) {
      const double t = (double)i / (double)steps;
      const int x = (int)(horizon_x + (bottom_x - horizon_x) * t);
      const int y = horizon + i;
      controller_camera_render_set_pixel(pixels, width, height, x, y, 218, 201, 185);
    }
  }

  for (int k = 1; k <= 12; ++k) {
    const double t = 1.0 - 1.0 / (1.0 + k * 0.35);
    const int y = horizon + (int)((height - horizon) * t);
    for (int x = 0; x < width; ++x) {
      controller_camera_render_set_pixel(pixels, width, height, x, y, 218, 201, 185);
    }
  }
}

void controller_camera_render_reticle(unsigned char *pixels, int width, int height) {
  if (!pixels || width <= 0 || height <= 0) return;
  const int horizon = (int)(height * 0.42);
  const int center_x = width / 2;
  controller_camera_render_line(
      pixels, width, height, center_x - 14, horizon, center_x + 14, horizon, 80, 220, 230);
  controller_camera_render_line(
      pixels, width, height, center_x, horizon - 10, center_x, horizon + 10, 80, 220, 230);
}

void controller_camera_render_waypoint_marker(
    unsigned char *pixels, int width, int height, int target_x) {
  if (!pixels || width <= 0 || height <= 0) return;
  const int horizon = (int)(height * 0.42);
  controller_camera_render_line(
      pixels, width, height, target_x, horizon - 18, target_x, height - 8, 55, 222, 170);
  controller_camera_render_rect(
      pixels, width, height, target_x - 3, horizon - 21, target_x + 3, horizon - 15, 55, 222, 170);
}

void controller_camera_render_box(
    unsigned char *pixels, int width, int height,
    int center_x, int bottom_y, int box_width, int box_height, double danger) {
  const int half_width = box_width / 2;
  const int min_x = center_x - half_width;
  const int max_x = center_x + half_width;
  const int min_y = bottom_y - box_height;
  const int max_y = bottom_y;
  const int depth = (int)clamp_value(box_width * 0.22, 4, 16);
  const int face_r = (int)(188 + danger * 54);
  const int face_g = (int)(82 - danger * 30);
  const int face_b = (int)(58 - danger * 26);

  controller_camera_render_rect(pixels, width, height, min_x + depth, min_y - depth,
                                max_x + depth, min_y, (int)(face_r * 1.08),
                                (int)(face_g * 1.12), (int)(face_b * 1.08));
  controller_camera_render_rect(pixels, width, height, max_x, min_y, max_x + depth,
                                max_y - depth, (int)(face_r * 0.56),
                                (int)(face_g * 0.55), (int)(face_b * 0.58));
  controller_camera_render_rect(
      pixels, width, height, min_x, min_y, max_x, max_y, face_r, face_g, face_b);

  controller_camera_render_line(pixels, width, height, min_x, min_y, max_x, min_y, 61, 31, 25);
  controller_camera_render_line(pixels, width, height, min_x, max_y, max_x, max_y, 61, 31, 25);
  controller_camera_render_line(pixels, width, height, min_x, min_y, min_x, max_y, 61, 31, 25);
  controller_camera_render_line(pixels, width, height, max_x, min_y, max_x, max_y, 61, 31, 25);
  controller_camera_render_line(
      pixels, width, height, max_x, min_y, max_x + depth, min_y - depth, 61, 31, 25);
  controller_camera_render_line(
      pixels, width, height, max_x + depth, min_y - depth,
      max_x + depth, max_y - depth, 61, 31, 25);
}
