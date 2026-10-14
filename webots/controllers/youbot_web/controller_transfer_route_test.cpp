#include "controller_transfer_route.h"
#include "controller_zone_geometry.h"
#include <cassert>
#include <cmath>
#include <limits>

int main() {
  ZoneData zones = {};
  RouteData route = {};
  assert(controller_transfer_route_plan(&zones, -3, 0, 3, 0, .4, &route));
  assert(route.count == 1 && route.waypoints[0].x == 3);
  assert(route.waypoints[0].has_heading && route.waypoints[0].heading_rad == 0);
  zones.count = 1;
  auto &box = zones.zones[0];
  box.point_count = 4;
  box.points[0] = {-1,-1}; box.points[1] = {1,-1};
  box.points[2] = {1,1}; box.points[3] = {-1,1};
  assert(controller_transfer_route_plan(&zones, -3, 0, 3, 0, .4, &route));
  assert(route.count == 3);
  double px = -3, py = 0, length = 0;
  for (int i = 0; i < route.count; ++i) {
    auto &point = route.waypoints[i];
    assert(!controller_zone_geometry_segment_blocked(&zones, px, py, point.x, point.z, .4, -1));
    assert(point.has_heading == (i == route.count - 1));
    length += std::hypot(point.x - px, point.z - py);
    px = point.x; py = point.z;
  }
  // Either symmetric shortest route has two corners at +/-1.45.
  const double expected = 2 * std::hypot(1.55, 1.45) + 2.9;
  assert(std::fabs(length - expected) < 1e-9);
  assert(!controller_transfer_route_plan(&zones, -3, 0, 0, 0, .4, &route));
  assert(route.count == 0);
  assert(!controller_transfer_route_plan(&zones, 0, 0, 3, 0, .4, &route));
  assert(!controller_transfer_route_plan(&zones, -3, 0, 21.8, 0, .4, &route));
  assert(!controller_transfer_route_plan(&zones, -3, 0, 3, 0, -1, &route));
  assert(!controller_transfer_route_plan(&zones, std::numeric_limits<double>::quiet_NaN(), 0, 3, 0, .4, &route));
  zones.count = MAX_ZONES + 1;
  assert(!controller_transfer_route_plan(&zones, -3, 0, 3, 0, .4, &route));
  return 0;
}
