#include "controller_mapping_scan_service.h"

static int allow_all(void *context, double x, double y) {
  (void)context;
  (void)x;
  (void)y;
  return 1;
}

int main(void) {
  RouteData route = {0};
  route.waypoints[0] = Waypoint{3.0, 0.0, 0.0, 0};
  route.count = 1;
  ControllerMappingSurveyState state = {
      .interior_start_index = 0,
      .last_scan_x = 100.0,
      .last_scan_y = 100.0,
  };
  const ControllerMappingScanServiceConfig config = {
      .max_scan_points = 13,
      .scan = {
          .min_range = 0.12,
          .max_range = 3.0,
          .min_repeat_distance = 1.05,
          .radius = 0.88,
          .circle_point_count = 10,
          .min_point_spacing = 0.18,
      },
  };
  const LidarObstacleContext lidar = {
      .closest_unexpected_range = 1.0,
      .closest_unexpected_beam_angle = 0.0,
      .has_closest_unexpected = 1,
  };
  const ControllerMappingScanServiceInput input = {
      .mapping_survey = 1,
      .route = &route,
      .state = &state,
      .current_waypoint_index = 0,
      .robot_x = 0.0,
      .robot_y = 0.0,
      .heading = 0.0,
      .target = &route.waypoints[0],
      .lidar_context = &lidar,
      .turn_sign = 1.0,
      .segment_start_x = 0.0,
      .segment_start_y = 0.0,
  };
  ControllerMappingScanServiceOutput output = {0};
  if (!controller_mapping_scan_service_start(
          &config, &input, allow_all, 0, &output)) return 1;
  if (!state.obstacle_scan_active || output.scan_point_count < 10) return 2;
  if (route.count != output.scan_point_count + 1) return 3;
  if (state.obstacle_scan_end_index != output.scan_point_count - 1) return 4;

  if (controller_mapping_scan_service_start(
          &config, &input, allow_all, 0, &output)) return 5;

  return 0;
}
