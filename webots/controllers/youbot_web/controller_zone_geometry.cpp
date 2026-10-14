#include "controller_zone_geometry.h"

#include <cmath>

#define CONTROLLER_ZONE_GEOMETRY_EPS 1e-9

static double cross_product(
    double ax, double ay, double bx, double by, double cx, double cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

static int point_on_segment(
    double px, double py, double ax, double ay, double bx, double by) {
  const double cross = cross_product(ax, ay, bx, by, px, py);
  if (fabs(cross) > 1e-7) return 0;
  return px >= fmin(ax, bx) - 1e-7 && px <= fmax(ax, bx) + 1e-7 &&
         py >= fmin(ay, by) - 1e-7 && py <= fmax(ay, by) + 1e-7;
}

static int segments_intersect(
    double ax,
    double ay,
    double bx,
    double by,
    double cx,
    double cy,
    double dx,
    double dy) {
  const double o1 = cross_product(ax, ay, bx, by, cx, cy);
  const double o2 = cross_product(ax, ay, bx, by, dx, dy);
  const double o3 = cross_product(cx, cy, dx, dy, ax, ay);
  const double o4 = cross_product(cx, cy, dx, dy, bx, by);
  if (((o1 > CONTROLLER_ZONE_GEOMETRY_EPS && o2 < -CONTROLLER_ZONE_GEOMETRY_EPS) ||
       (o1 < -CONTROLLER_ZONE_GEOMETRY_EPS && o2 > CONTROLLER_ZONE_GEOMETRY_EPS)) &&
      ((o3 > CONTROLLER_ZONE_GEOMETRY_EPS && o4 < -CONTROLLER_ZONE_GEOMETRY_EPS) ||
       (o3 < -CONTROLLER_ZONE_GEOMETRY_EPS && o4 > CONTROLLER_ZONE_GEOMETRY_EPS))) {
    return 1;
  }
  if (fabs(o1) <= CONTROLLER_ZONE_GEOMETRY_EPS && point_on_segment(cx, cy, ax, ay, bx, by)) return 1;
  if (fabs(o2) <= CONTROLLER_ZONE_GEOMETRY_EPS && point_on_segment(dx, dy, ax, ay, bx, by)) return 1;
  if (fabs(o3) <= CONTROLLER_ZONE_GEOMETRY_EPS && point_on_segment(ax, ay, cx, cy, dx, dy)) return 1;
  return fabs(o4) <= CONTROLLER_ZONE_GEOMETRY_EPS && point_on_segment(bx, by, cx, cy, dx, dy);
}

static double distance_point_to_segment(
    double px, double py, double ax, double ay, double bx, double by) {
  const double abx = bx - ax;
  const double aby = by - ay;
  const double length_squared = abx * abx + aby * aby;
  if (length_squared <= CONTROLLER_ZONE_GEOMETRY_EPS) return hypot(px - ax, py - ay);
  double t = ((px - ax) * abx + (py - ay) * aby) / length_squared;
  if (t < 0.0) t = 0.0;
  if (t > 1.0) t = 1.0;
  return hypot(px - (ax + abx * t), py - (ay + aby * t));
}

static double distance_between_segments(
    double ax,
    double ay,
    double bx,
    double by,
    double cx,
    double cy,
    double dx,
    double dy) {
  if (segments_intersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0.0;
  double minimum = distance_point_to_segment(ax, ay, cx, cy, dx, dy);
  minimum = fmin(minimum, distance_point_to_segment(bx, by, cx, cy, dx, dy));
  minimum = fmin(minimum, distance_point_to_segment(cx, cy, ax, ay, bx, by));
  return fmin(minimum, distance_point_to_segment(dx, dy, ax, ay, bx, by));
}

int controller_zone_geometry_point_in(double x, double y, const LimitZone *zone) {
  if (!zone || zone->point_count < 3) return 0;
  int inside = 0;
  for (int i = 0, j = zone->point_count - 1; i < zone->point_count; j = i, ++i) {
    const double ax = zone->points[i].x;
    const double ay = zone->points[i].y;
    const double bx = zone->points[j].x;
    const double by = zone->points[j].y;
    if (point_on_segment(x, y, ax, ay, bx, by)) return 1;
    if ((ay > y) != (by > y) &&
        x < ((bx - ax) * (y - ay)) / ((by - ay) + CONTROLLER_ZONE_GEOMETRY_EPS) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

int controller_zone_geometry_point_near(
    double x, double y, const LimitZone *zone, double clearance) {
  if (!zone) return 0;
  if (controller_zone_geometry_point_in(x, y, zone)) return 1;
  for (int i = 0; i < zone->point_count; ++i) {
    const int next = (i + 1) % zone->point_count;
    if (distance_point_to_segment(
            x, y, zone->points[i].x, zone->points[i].y,
            zone->points[next].x, zone->points[next].y) <=
        clearance + CONTROLLER_ZONE_GEOMETRY_EPS) {
      return 1;
    }
  }
  return 0;
}

int controller_zone_geometry_point_near_boundary(
    double x, double y, const LimitZone *zone, double tolerance) {
  if (!zone || zone->point_count < 2) return 0;
  for (int i = 0; i < zone->point_count; ++i) {
    const int next = (i + 1) % zone->point_count;
    if (distance_point_to_segment(
            x, y, zone->points[i].x, zone->points[i].y,
            zone->points[next].x, zone->points[next].y) <=
        tolerance + CONTROLLER_ZONE_GEOMETRY_EPS) {
      return 1;
    }
  }
  return 0;
}

int controller_zone_geometry_segment_blocked(
    const ZoneData *zones,
    double ax,
    double ay,
    double bx,
    double by,
    double clearance,
    int skip_zone_index) {
  if (!zones) return 0;
  for (int zone_index = 0; zone_index < zones->count; ++zone_index) {
    if (zone_index == skip_zone_index) continue;
    const LimitZone *zone = &zones->zones[zone_index];
    if (controller_zone_geometry_point_near(ax, ay, zone, clearance) ||
        controller_zone_geometry_point_near(bx, by, zone, clearance)) {
      return 1;
    }
    for (int i = 0; i < zone->point_count; ++i) {
      const int next = (i + 1) % zone->point_count;
      const double edge_ax = zone->points[i].x;
      const double edge_ay = zone->points[i].y;
      const double edge_bx = zone->points[next].x;
      const double edge_by = zone->points[next].y;
      if (segments_intersect(ax, ay, bx, by, edge_ax, edge_ay, edge_bx, edge_by) ||
          distance_between_segments(ax, ay, bx, by, edge_ax, edge_ay, edge_bx, edge_by) <=
              clearance + CONTROLLER_ZONE_GEOMETRY_EPS) {
        return 1;
      }
    }
  }
  return 0;
}

double controller_zone_geometry_signed_area(const LimitZone *zone) {
  if (!zone || zone->point_count < 3) return 0.0;
  double area = 0.0;
  for (int i = 0; i < zone->point_count; ++i) {
    const int next = (i + 1) % zone->point_count;
    area += zone->points[i].x * zone->points[next].y -
            zone->points[next].x * zone->points[i].y;
  }
  return area * 0.5;
}

int controller_zone_geometry_find_room(
    const ZoneData *zones, double robot_x, double robot_y) {
  if (!zones) return -1;
  int best_index = -1;
  double best_area = 0.0;
  for (int i = 0; i < zones->count; ++i) {
    if (!controller_zone_geometry_point_in(robot_x, robot_y, &zones->zones[i])) continue;
    const double area = fabs(controller_zone_geometry_signed_area(&zones->zones[i]));
    if (area > best_area) {
      best_area = area;
      best_index = i;
    }
  }
  return best_index;
}
