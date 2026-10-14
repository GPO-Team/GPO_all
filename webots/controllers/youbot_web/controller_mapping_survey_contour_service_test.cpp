#include "controller_mapping_survey_contour_service.h"

#include <assert.h>

static int point_safe(void *context, double x, double y, int room_zone_index, double clearance) {
  (void)context;
  (void)x;
  (void)y;
  (void)room_zone_index;
  (void)clearance;
  return 1;
}

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
  SurveyPoint route[MAX_WAYPOINTS] = {0};
  int route_count = 0;
  const ControllerMappingSurveyContourService service = {
      &zones, point_safe, NULL, 0.45, 0.72, 0.18, 1.45};

  assert(controller_mapping_survey_contour_service_append(
      &service, route, &route_count, 0, 0.0, 0.0));
  assert(route_count > 3);
  return 0;
}
