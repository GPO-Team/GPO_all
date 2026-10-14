#include "controller_webots_simulation_format.h"

#include <cmath>
#include <stdio.h>
#include <string.h>

int controller_webots_simulation_format_limit_wall(
    char *buffer,
    size_t buffer_size,
    const char *def_name,
    double ax,
    double ay,
    double bx,
    double by,
    double wall_thickness,
    double wall_height) {
  if (!buffer || buffer_size == 0 || !def_name) return 0;

  const double dx = bx - ax;
  const double dy = by - ay;
  const double length = hypot(dx, dy);
  if (length <= 0.05) return 0;

  const int written = snprintf(
      buffer,
      buffer_size,
      "DEF %s Solid { "
      "translation %.6f %.6f %.6f "
      "rotation 0 0 1 %.6f "
      "name \"dynamic_zone_wall\" "
      "children [ "
      "Shape { "
      "appearance PBRAppearance { baseColor 0.1176 0.4510 0.9725 roughness 1 metalness 0 transparency 0.45 } "
      "geometry Box { size %.6f %.6f %.6f } "
      "} "
      "] "
      "boundingObject Box { size %.6f %.6f %.6f } "
      "locked TRUE "
      "}",
      def_name,
      (ax + bx) * 0.5,
      (ay + by) * 0.5,
      wall_height * 0.5,
      atan2(dy, dx),
      length,
      wall_thickness,
      wall_height,
      length,
      wall_thickness,
      wall_height);
  return written >= 0 && (size_t)written < buffer_size ? written : 0;
}

static void surface_zone_color(
    const char *surface_key, double *red, double *green, double *blue) {
  if (strcmp(surface_key, "rough") == 0) {
    *red = 0.93;
    *green = 0.54;
    *blue = 0.08;
    return;
  }
  if (strcmp(surface_key, "slippery") == 0) {
    *red = 0.14;
    *green = 0.66;
    *blue = 0.88;
    return;
  }
  *red = 0.52;
  *green = 0.60;
  *blue = 0.70;
}

static void append_text(char *buffer, size_t buffer_size, const char *text) {
  const size_t used = strlen(buffer);
  if (used >= buffer_size - 1) return;
  strncat(buffer, text, buffer_size - used - 1);
}

static double clamp_value(double value, double min_value, double max_value) {
  if (value < min_value) return min_value;
  if (value > max_value) return max_value;
  return value;
}

int controller_webots_simulation_format_surface_zone(
    char *buffer,
    size_t buffer_size,
    const SurfaceZone *zone,
    int zone_index) {
  if (!buffer || buffer_size == 0 || !zone || zone->point_count < 3) return 0;

  double red = 0.0;
  double green = 0.0;
  double blue = 0.0;
  surface_zone_color(zone->surface_key, &red, &green, &blue);

  char coord_buffer[2048] = "";
  char index_buffer[512] = "";
  char chunk[96];
  for (int point_index = 0; point_index < zone->point_count; ++point_index) {
    snprintf(
        chunk,
        sizeof(chunk),
        "%.6f %.6f %.6f, ",
        zone->points[point_index].x,
        zone->points[point_index].y,
        0.012 + zone_index * 0.001);
    append_text(coord_buffer, sizeof(coord_buffer), chunk);

    snprintf(chunk, sizeof(chunk), "%d ", point_index);
    append_text(index_buffer, sizeof(index_buffer), chunk);
  }
  append_text(index_buffer, sizeof(index_buffer), "-1");

  const int written = snprintf(
      buffer,
      buffer_size,
      "DEF WEB_SURFACE_%d Pose { "
      "children [ "
      "Shape { "
      "appearance PBRAppearance { baseColor %.4f %.4f %.4f roughness 1 metalness 0 transparency 0.58 } "
      "geometry IndexedFaceSet { "
      "coord Coordinate { point [ %s ] } "
      "coordIndex [ %s ] "
      "} "
      "} "
      "] "
      "}",
      zone_index,
      red,
      green,
      blue,
      coord_buffer,
      index_buffer);
  return written >= 0 && (size_t)written < buffer_size ? written : 0;
}

int controller_webots_simulation_format_runtime_obstacle(
    char *buffer,
    size_t buffer_size,
    const RuntimeCommand *command,
    double min_x,
    double max_x,
    double min_y,
    double max_y) {
  if (!buffer || buffer_size == 0 || !command || !command->has_spawn_obstacle) return 0;

  const double x = clamp_value(command->x, min_x, max_x);
  const double y = clamp_value(command->y, min_y, max_y);
  const double size_x = clamp_value(command->size_x, 0.2, 3.5);
  const double size_y = clamp_value(command->size_y, 0.2, 3.5);
  const double height = clamp_value(command->height, 0.12, 2.8);
  const long long compact_id = command->id >= 0 ? command->id : 0;
  const int written = snprintf(
      buffer,
      buffer_size,
      "DEF WEB_OBS_%lld Solid { "
      "translation %.6f %.6f %.6f "
      "name \"runtime_obstacle\" "
      "children [ "
      "Shape { "
      "appearance PBRAppearance { baseColor 0.7608 0.2549 0.1451 roughness 0.95 metalness 0.0 } "
      "geometry Box { size %.6f %.6f %.6f } "
      "} "
      "] "
      "boundingObject Box { size %.6f %.6f %.6f } "
      "locked TRUE "
      "}",
      compact_id,
      x,
      y,
      height * 0.5,
      size_x,
      size_y,
      height,
      size_x,
      size_y,
      height);
  return written >= 0 && (size_t)written < buffer_size ? written : 0;
}
