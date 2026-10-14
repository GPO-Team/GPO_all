#include "controller_zone_geometry.h"

#include <cmath>

static LimitZone square(double min_x, double min_y, double max_x, double max_y) {
  LimitZone zone = {0};
  zone.point_count = 4;
  zone.points[0].x = min_x;
  zone.points[0].y = min_y;
  zone.points[1].x = max_x;
  zone.points[1].y = min_y;
  zone.points[2].x = max_x;
  zone.points[2].y = max_y;
  zone.points[3].x = min_x;
  zone.points[3].y = max_y;
  return zone;
}

int main(void) {
  const LimitZone room = square(-2.0, -2.0, 2.0, 2.0);
  if (!controller_zone_geometry_point_in(0.0, 0.0, &room)) return 1;
  if (!controller_zone_geometry_point_in(2.0, 0.0, &room)) return 2;
  if (controller_zone_geometry_point_in(2.1, 0.0, &room)) return 3;
  if (!controller_zone_geometry_point_near(2.1, 0.0, &room, 0.11)) return 4;
  if (!controller_zone_geometry_point_near_boundary(1.95, 0.0, &room, 0.06)) return 5;
  if (fabs(controller_zone_geometry_signed_area(&room) - 16.0) > 1e-9) return 6;

  ZoneData zones = {0};
  zones.zones[0] = square(-0.5, -0.5, 0.5, 0.5);
  zones.zones[1] = room;
  zones.count = 2;
  if (controller_zone_geometry_find_room(&zones, 0.0, 0.0) != 1) return 7;
  if (!controller_zone_geometry_segment_blocked(
          &zones, -1.0, 0.0, 1.0, 0.0, 0.0, 1)) return 8;
  ZoneData obstacle_only = {0};
  obstacle_only.zones[0] = zones.zones[0];
  obstacle_only.count = 1;
  if (controller_zone_geometry_segment_blocked(
          &obstacle_only, -1.0, 0.0, 1.0, 0.0, 0.0, 0)) return 9;

  return 0;
}
