#include "controller_mapping_survey_safety.h"
#include "controller_zone_geometry.h"
#include <cmath>
int controller_mapping_survey_segment_safe(double ax, double ay, double bx, double by, double grid_cell, double clearance, ControllerMappingSurveyPointSafe point_safe, void *context) {
  if (!point_safe || grid_cell <= 0.0) return 0;
  const int steps = (int)ceil(hypot(bx - ax, by - ay) / fmax(grid_cell * 0.72, 0.05));
  for (int i = 0; i <= steps; ++i) { const double t = steps ? (double)i / steps : 0.0; if (!point_safe(context, ax + (bx - ax) * t, ay + (by - ay) * t, clearance)) return 0; }
  return 1;
}
int controller_mapping_survey_segment_stays_in_room(const LimitZone *room, double ax, double ay, double bx, double by, double grid_cell) {
  if (!room || grid_cell <= 0.0) return 1;
  const int steps = (int)ceil(hypot(bx - ax, by - ay) / fmax(grid_cell, 0.08));
  for (int i = 1; i <= steps; ++i) { const double t = steps ? (double)i / steps : 1.0; if (!controller_zone_geometry_point_in(ax + (bx - ax) * t, ay + (by - ay) * t, room)) return 0; }
  return 1;
}
