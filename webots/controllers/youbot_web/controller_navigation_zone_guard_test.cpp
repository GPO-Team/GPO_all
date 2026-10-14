#include "controller_navigation_zone_guard.h"

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
  ZoneData zones = {0};
  const Waypoint target = {3.0, 0.0, 0.0, 0};

  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 0, -1, 1) !=
      CONTROLLER_NAVIGATION_ZONE_CLEAR) return 1;

  zones.count = 1;
  zones.zones[0] = square(2.8, -0.2, 3.2, 0.2);
  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 0, -1, 1) !=
      CONTROLLER_NAVIGATION_ZONE_BLOCKED_TARGET) return 2;
  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 1, -1, 1) !=
      CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_TARGET) return 3;
  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 1, -1, 0) !=
      CONTROLLER_NAVIGATION_ZONE_BLOCKED_TARGET) return 4;

  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 1, 0, 1) !=
      CONTROLLER_NAVIGATION_ZONE_CLEAR) return 5;

  zones.zones[0] = square(1.4, -0.2, 1.6, 0.2);
  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 0, -1, 1) !=
      CONTROLLER_NAVIGATION_ZONE_BLOCKED_SEGMENT) return 6;
  if (controller_navigation_zone_guard_evaluate(
          &zones, 0.0, 0.0, &target, 0.1, 1, -1, 1) !=
      CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_SEGMENT) return 7;

  return 0;
}
