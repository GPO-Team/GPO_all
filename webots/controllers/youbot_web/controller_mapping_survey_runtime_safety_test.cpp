#include "controller_mapping_survey_runtime_safety.h"

#include <stddef.h>

int main(void) {
  ZoneData zones = {0};
  zones.count = 1;
  zones.zones[0].point_count = 4;
  zones.zones[0].points[0].x = -2.0;
  zones.zones[0].points[0].y = -2.0;
  zones.zones[0].points[1].x = 2.0;
  zones.zones[0].points[1].y = -2.0;
  zones.zones[0].points[2].x = 2.0;
  zones.zones[0].points[2].y = 2.0;
  zones.zones[0].points[3].x = -2.0;
  zones.zones[0].points[3].y = 2.0;
  const MapCell map[1] = {{0.0, 0.0, 1}};
  const ControllerMappingSurveySafetyContext context = {
      &zones, map, 1, NULL, 0, 1.0, 10.0, 0.18, 3.0, 3.0, 0.18, 0.25};

  if (controller_mapping_survey_runtime_scan_point_allowed(
          &context, 1.0, 1.0, 0, 0.20, 0.10) != 1) return 1;
  if (controller_mapping_survey_runtime_scan_point_allowed(
          &context, 0.05, 0.0, 0, 0.20, 0.10) != 0) return 2;
  if (controller_mapping_survey_runtime_scan_point_allowed(
          &context, 1.95, 0.0, 0, 0.20, 0.10) != 0) return 3;
  return 0;
}
