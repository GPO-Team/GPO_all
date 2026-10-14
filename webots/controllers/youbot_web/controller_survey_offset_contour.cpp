#include "controller_survey_geometry.h"

#include "controller_zone_geometry.h"

#include <cmath>

static int line_intersection(
    double ax, double ay, double bx, double by,
    double cx, double cy, double dx, double dy,
    double *out_x, double *out_y) {
  const double ray_x = bx - ax;
  const double ray_y = by - ay;
  const double segment_x = dx - cx;
  const double segment_y = dy - cy;
  const double denominator = ray_x * segment_y - ray_y * segment_x;
  if (fabs(denominator) < 1e-8) return 0;
  const double distance =
      ((cx - ax) * segment_y - (cy - ay) * segment_x) / denominator;
  *out_x = ax + ray_x * distance;
  *out_y = ay + ray_y * distance;
  return 1;
}

int controller_survey_build_offset_contour(
    const LimitZone *room,
    double offset,
    SurveyPoint *out,
    int capacity,
    int *out_count) {
  if (out_count) *out_count = 0;
  if (!room || room->point_count < 3 || !out || capacity <= 0 || !out_count) return 0;
  const double area = controller_zone_geometry_signed_area(room);
  const double orientation = area >= 0.0 ? 1.0 : -1.0;
  int count = 0;

  for (int i = 0; i < room->point_count; ++i) {
    const int previous = (i + room->point_count - 1) % room->point_count;
    const int next = (i + 1) % room->point_count;
    const double previous_x = room->points[previous].x;
    const double previous_y = room->points[previous].y;
    const double current_x = room->points[i].x;
    const double current_y = room->points[i].y;
    const double next_x = room->points[next].x;
    const double next_y = room->points[next].y;
    const double edge1_x = current_x - previous_x;
    const double edge1_y = current_y - previous_y;
    const double edge2_x = next_x - current_x;
    const double edge2_y = next_y - current_y;
    const double edge1_length = hypot(edge1_x, edge1_y);
    const double edge2_length = hypot(edge2_x, edge2_y);
    if (edge1_length <= 1e-9 || edge2_length <= 1e-9) continue;

    const double normal1_x = orientation * (-edge1_y / edge1_length);
    const double normal1_y = orientation * (edge1_x / edge1_length);
    const double normal2_x = orientation * (-edge2_y / edge2_length);
    const double normal2_y = orientation * (edge2_x / edge2_length);
    double offset_x = current_x + (normal1_x + normal2_x) * 0.5 * offset;
    double offset_y = current_y + (normal1_y + normal2_y) * 0.5 * offset;

    if (!line_intersection(
            previous_x + normal1_x * offset, previous_y + normal1_y * offset,
            current_x + normal1_x * offset, current_y + normal1_y * offset,
            current_x + normal2_x * offset, current_y + normal2_y * offset,
            next_x + normal2_x * offset, next_y + normal2_y * offset,
            &offset_x, &offset_y)) {
      const double bisector_x = normal1_x + normal2_x;
      const double bisector_y = normal1_y + normal2_y;
      const double bisector_length = hypot(bisector_x, bisector_y);
      if (bisector_length > 1e-9) {
        offset_x = current_x + bisector_x / bisector_length * offset;
        offset_y = current_y + bisector_y / bisector_length * offset;
      }
    }
    if (!controller_zone_geometry_point_in(offset_x, offset_y, room)) {
      offset_x = current_x + (normal1_x + normal2_x) * 0.25 * offset;
      offset_y = current_y + (normal1_y + normal2_y) * 0.25 * offset;
    }
    if (count < capacity) out[count++] = SurveyPoint{offset_x, offset_y};
  }

  *out_count = count;
  return count >= 3;
}
