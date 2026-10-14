#include "controller_mapping_scan.h"

#include <cmath>

static int allow_all(void *context, double x, double y) {
  (void)context;
  (void)x;
  (void)y;
  return 1;
}

int main(void) {
  const ControllerMappingScanConfig config = {
      .sensor_local_x = 0.0,
      .sensor_local_y = 0.0,
      .min_range = 0.12,
      .max_range = 3.0,
      .min_repeat_distance = 1.05,
      .radius = 0.88,
      .circle_point_count = 10,
      .min_point_spacing = 0.18,
  };
  const ControllerMappingScanInput input = {
      .robot_x = 0.0,
      .robot_y = 0.0,
      .heading = 0.0,
      .obstacle_range = 1.0,
      .obstacle_beam_angle = 0.0,
      .last_scan_x = 100.0,
      .last_scan_y = 100.0,
      .turn_sign = 1.0,
      .segment_start_x = 0.0,
      .segment_start_y = 0.0,
      .target_x = 3.0,
      .target_y = 0.0,
  };
  SurveyPoint points[13] = {0};
  int point_count = 0;
  double obstacle_x = 0.0;
  double obstacle_y = 0.0;
  if (!controller_mapping_scan_build(
          &config,
          &input,
          allow_all,
          0,
          points,
          13,
          &point_count,
          &obstacle_x,
          &obstacle_y)) return 1;
  if (fabs(obstacle_x - 1.0) > 1e-9 || fabs(obstacle_y) > 1e-9) return 2;
  if (point_count < 10 || point_count > 12) return 3;

  RouteData route = {0};
  route.waypoints[0] = Waypoint{3.0, 0.0, 0.0, 0};
  route.count = 1;
  if (!controller_mapping_scan_insert_route(&route, 0, points, point_count)) return 4;
  if (route.count != point_count + 1) return 5;
  if (fabs(route.waypoints[point_count].x - 3.0) > 1e-9) return 6;

  return 0;
}
