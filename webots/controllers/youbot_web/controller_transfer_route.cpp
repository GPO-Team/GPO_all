#include "controller_transfer_route.h"
#include "controller_zone_geometry.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace {
struct Point { double x, y; };
constexpr int kMaxNodes = 2 + MAX_ZONES * 4 + 4;
bool in_bounds(Point p, double clearance) {
  return std::isfinite(p.x) && std::isfinite(p.y)
      && p.x >= -22 + clearance && p.x <= 22 - clearance
      && p.y >= -17 + clearance && p.y <= 17 - clearance;
}
bool object_blocks(Point a, Point b, const ControllerTransferObstacle *object) {
  if (!object) return false;
  const double dx = b.x-a.x, dy = b.y-a.y;
  const double length2 = dx*dx + dy*dy;
  const double t = length2 > 1e-12 ? std::clamp(((object->x-a.x)*dx+(object->y-a.y)*dy)/length2,0.0,1.0) : 0.0;
  return std::hypot(a.x+t*dx-object->x,a.y+t*dy-object->y) < object->radius;
}
bool free_point(const ZoneData *zones, Point p, double clearance, const ControllerTransferObstacle *object) {
  return in_bounds(p, clearance) && !controller_zone_geometry_segment_blocked(
      zones, p.x, p.y, p.x, p.y, clearance, -1) && !object_blocks(p,p,object);
}
}

int controller_transfer_route_plan(const ZoneData *zones, double sx, double sy,
    double gx, double gy, double clearance, RouteData *out, double final_heading,
    const ControllerTransferObstacle *object) {
  if (!out) return 0;
  std::memset(out, 0, sizeof(*out));
  if (!zones || zones->count < 0 || zones->count > MAX_ZONES
      || !std::isfinite(clearance) || clearance < 0 || clearance >= 17
      || !std::isfinite(final_heading) || (object && (!std::isfinite(object->x)
      || !std::isfinite(object->y) || !std::isfinite(object->radius) || object->radius <= 0))) return 0;
  for (int i = 0; i < zones->count; ++i) {
    const auto &zone = zones->zones[i];
    if (zone.point_count < 3 || zone.point_count > MAX_ZONE_POINTS) return 0;
    for (int j = 0; j < zone.point_count; ++j)
      if (!std::isfinite(zone.points[j].x) || !std::isfinite(zone.points[j].y)) return 0;
  }
  Point nodes[kMaxNodes] = {{sx, sy}, {gx, gy}};
  if (!free_point(zones, nodes[0], clearance, object) || !free_point(zones, nodes[1], clearance, object)) return 0;
  if (!controller_zone_geometry_segment_blocked(zones, sx, sy, gx, gy, clearance, -1)
      && !object_blocks(nodes[0],nodes[1],object)) {
    out->count = 1;
    out->waypoints[0] = {gx, gy, final_heading, 1};
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
      if (free_point(zones, corner, clearance, object)) nodes[count++] = corner;
  }
  if (object) {
    const double pad = object->radius + .05;
    for (int ix : {-1,1}) for (int iy : {-1,1}) {
      const Point corner = {object->x + ix*pad, object->y + iy*pad};
      if (free_point(zones,corner,clearance,object)) nodes[count++] = corner;
    }
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
      if (object_blocks(nodes[current],nodes[next],object)) continue;
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
    out->waypoints[i] = {p.x, p.y, final_heading, i == length - 1};
  }
  return 1;
}

int controller_transfer_route_plan_dock(const ZoneData *zones, double sx, double sy,
    double ox, double oy, double clearance, int pickup, RouteData *out) {
  if (!out) return 0;
  out->count = 0;
  const double preferred = std::atan2(oy-sy,ox-sx);
  const ControllerTransferObstacle object = {ox,oy,.38};
  const double pi = 3.14159265358979323846;
  for (double offset : {0.0, pi/4, -pi/4, pi/2, -pi/2, pi}) {
    const double heading = std::atan2(std::sin(preferred+offset),std::cos(preferred+offset));
    if (controller_transfer_route_plan(zones,sx,sy,ox-.39*std::cos(heading),oy-.39*std::sin(heading),
        clearance,out,heading,pickup ? &object : nullptr)) return 1;
  }
  return 0;
}

ControllerTransferVelocity controller_transfer_route_velocity(double dx, double dy,
    double heading, double final_heading, int final_waypoint, double speed_limit, double angular_limit) {
  const double distance = std::hypot(dx,dy);
  const bool aligning = final_waypoint && distance < .08;
  const double desired = aligning ? final_heading : std::atan2(dy,dx);
  const double error = std::atan2(std::sin(desired-heading),std::cos(desired-heading));
  const double angular = std::clamp(error*.6,-angular_limit,angular_limit);
  // Turn before driving. Cargo stays in front instead of sliding sideways.
  if (std::fabs(error) > .15) return {0,0,angular};
  if (aligning) {
    // Precision docking keeps one heading while correcting small wheel drift.
    // Switching back to the bearing at 5mm makes loaded alignment oscillate.
    const double scale=distance>1e-9 ? std::min({speed_limit,.025,distance*.6})/distance : 0;
    return {scale*(std::cos(heading)*dx+std::sin(heading)*dy),
        scale*(-std::sin(heading)*dx+std::cos(heading)*dy),angular};
  }
  const double speed = std::min(speed_limit,distance*.6);
  return {speed*std::max(0.0,std::cos(error)),0,angular};
}
