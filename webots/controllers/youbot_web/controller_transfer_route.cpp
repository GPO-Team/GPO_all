#include "controller_transfer_route.h"
#include "controller_zone_geometry.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace {
struct Point { double x, y; };
constexpr int kMaxNodes = 2 + MAX_ZONES * 4;
bool in_bounds(Point p, double clearance) {
  return std::isfinite(p.x) && std::isfinite(p.y)
      && p.x >= -22 + clearance && p.x <= 22 - clearance
      && p.y >= -17 + clearance && p.y <= 17 - clearance;
}
bool free_point(const ZoneData *zones, Point p, double clearance) {
  return in_bounds(p, clearance) && !controller_zone_geometry_segment_blocked(
      zones, p.x, p.y, p.x, p.y, clearance, -1);
}
}

int controller_transfer_route_plan(const ZoneData *zones, double sx, double sy,
    double gx, double gy, double clearance, RouteData *out) {
  if (!out) return 0;
  std::memset(out, 0, sizeof(*out));
  if (!zones || zones->count < 0 || zones->count > MAX_ZONES
      || !std::isfinite(clearance) || clearance < 0 || clearance >= 17) return 0;
  for (int i = 0; i < zones->count; ++i) {
    const auto &zone = zones->zones[i];
    if (zone.point_count < 3 || zone.point_count > MAX_ZONE_POINTS) return 0;
    for (int j = 0; j < zone.point_count; ++j)
      if (!std::isfinite(zone.points[j].x) || !std::isfinite(zone.points[j].y)) return 0;
  }
  Point nodes[kMaxNodes] = {{sx, sy}, {gx, gy}};
  if (!free_point(zones, nodes[0], clearance) || !free_point(zones, nodes[1], clearance)) return 0;
  if (!controller_zone_geometry_segment_blocked(zones, sx, sy, gx, gy, clearance, -1)) {
    out->count = 1;
    out->waypoints[0] = {gx, gy, 0.0, 1};
    return 1;
  }
  int count = 2;
  for (int i = 0; i < zones->count; ++i) {
    const auto &zone = zones->zones[i];
    double min_x = zone.points[0].x, max_x = min_x;
    double min_y = zone.points[0].y, max_y = min_y;
    for (int j = 1; j < zone.point_count; ++j) {
      min_x = std::min(min_x, zone.points[j].x); max_x = std::max(max_x, zone.points[j].x);
      min_y = std::min(min_y, zone.points[j].y); max_y = std::max(max_y, zone.points[j].y);
    }
    const double padding = clearance + .05;
    Point corners[] = {{min_x-padding,min_y-padding}, {min_x-padding,max_y+padding},
        {max_x+padding,min_y-padding}, {max_x+padding,max_y+padding}};
    for (Point corner : corners)
      if (free_point(zones, corner, clearance)) nodes[count++] = corner;
  }
  double distance[kMaxNodes];
  int previous[kMaxNodes];
  bool visited[kMaxNodes] = {};
  std::fill(distance, distance + count, std::numeric_limits<double>::infinity());
  std::fill(previous, previous + count, -1);
  distance[0] = 0;
  for (int iteration = 0; iteration < count; ++iteration) {
    int current = -1;
    for (int i = 0; i < count; ++i)
      if (!visited[i] && (current < 0 || distance[i] < distance[current])) current = i;
    if (current < 0 || !std::isfinite(distance[current])) return 0;
    if (current == 1) break;
    visited[current] = true;
    for (int next = 0; next < count; ++next) {
      if (visited[next] || next == current) continue;
      const double candidate = distance[current]
          + std::hypot(nodes[next].x - nodes[current].x, nodes[next].y - nodes[current].y);
      if (candidate >= distance[next]) continue;
      if (controller_zone_geometry_segment_blocked(zones, nodes[current].x, nodes[current].y,
          nodes[next].x, nodes[next].y, clearance, -1)) continue;
      distance[next] = candidate;
      previous[next] = current;
    }
  }
  if (!std::isfinite(distance[1])) return 0;
  int reverse[kMaxNodes], length = 0;
  for (int node = 1; node != 0; node = previous[node]) {
    if (node < 0 || length >= kMaxNodes) return 0;
    reverse[length++] = node;
  }
  out->count = length;
  for (int i = 0; i < length; ++i) {
    const Point p = nodes[reverse[length - 1 - i]];
    out->waypoints[i] = {p.x, p.y, 0.0, i == length - 1};
  }
  return 1;
}
