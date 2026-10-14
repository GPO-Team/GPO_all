#include "controller_navigation_service.h"

#include <stddef.h>

static LimitZone square(double min_x, double min_y, double max_x, double max_y) {
  LimitZone zone = {0};
  zone.point_count = 4;
  zone.points[0].x = min_x;
  zone.points[0].y = min_y;
  zone.points[1].x = max_x;
  zone.points[1].y = min_y;
  zone.points[2].x = max_x;
  zone.points[2].y = max_y;
  zone.points[3].x = min_x;
  zone.points[3].y = max_y;
  return zone;
}

int main(void) {
  RouteData route = {0};
  ZoneData zones = {0};
  ControllerNavigationServiceSessionOutput session = {0};
  ControllerNavigationServiceRouteOutput route_output = {0};

  if (controller_navigation_service_begin_step(
          &route, 0, 0, 0, 0.0, 0.0, &session) !=
      CONTROLLER_NAVIGATION_SESSION_WAIT_FOR_ROUTE) return 1;

  route.count = 2;
  route.waypoints[0] = Waypoint{1.0, 0.0, 0.0, 0};
  route.waypoints[1] = Waypoint{2.0, 0.0, 0.0, 0};
  int waypoint_index = 0;
  int route_finished = 0;
  if (controller_navigation_service_advance_route(
          &route, &waypoint_index, &route_finished,
          1.0, 0.0, 0.0, 0.1, 0.1, &route_output) !=
      CONTROLLER_NAVIGATION_ROUTE_ADVANCED) return 2;
  if (waypoint_index != 1 || route_output.route.target.x != 2.0) return 3;

  zones.count = 1;
  zones.zones[0] = square(1.8, -0.2, 2.2, 0.2);
  if (controller_navigation_service_guard_route(
          &zones, 0.0, 0.0, &route_output.route.target,
          0.1, 0, -1, 0) != CONTROLLER_NAVIGATION_ZONE_BLOCKED_TARGET) {
    return 4;
  }

  const ControllerNavigationTrackingConfig tracking_config = {
      .track_slow_radius = 0.22,
      .turn_exit_error_rad = 0.12,
      .track_reenter_turn_rad = 0.56,
      .turn_enter_error_rad = 0.42,
      .turn_heading_gain = 3.8,
      .track_heading_gain = 3.0,
      .track_min_linear_speed = 0.045,
      .min_angular_command = 0.28,
  };
  const ControllerNavigationLidarConfig lidar_config = {
      .track_caution_range = 1.45,
      .avoid_stop_range = 0.31,
      .track_side_bias_range = 0.66,
      .avoid_side_danger_range = 0.15,
      .track_hard_priority_range = 1.24,
      .avoid_side_trigger_range = 0.36,
      .max_heading_bias = 0.40,
      .priority_switch_margin = 0.18,
      .priority_center_margin = 0.08,
      .priority_hold_steps = 18,
      .expected_wall_soft_stop_range = 0.24,
      .expected_wall_slowdown_range = 0.46,
  };
  const ControllerNavigationMotionServiceInput motion_input = {
      .tracking = {
          .mode = NAV_MODE_IDLE,
          .distance_to_target = 1.0,
          .heading_error_to_target = 0.2,
          .updated_heading_error = 0.2,
          .route_relaxed_mode = 1,
          .lidar_speed_scale = 1.0,
          .expected_wall_speed_scale = 1.0,
          .runtime_linear_speed_limit = 0.22,
          .runtime_angular_speed_limit = 1.6,
      },
      .lidar = {.heading_error = 0.2},
  };
  ControllerNavigationServiceMotionOutput motion_output = {0};
  if (controller_navigation_service_calculate_motion(
          &tracking_config, &lidar_config, &motion_input, &motion_output)) return 5;
  if (motion_output.motion.tracking.mode != NAV_MODE_TRACK ||
      motion_output.motion.tracking.linear_speed <= 0.0) return 6;

  ControllerNavigationServiceFrameInput frame_input = {
      .route = &route,
      .current_waypoint_index = &waypoint_index,
      .route_finished = &route_finished,
      .x = 1.0,
      .z = 0.0,
      .heading = 0.0,
      .position_tolerance = 0.1,
      .heading_tolerance_rad = 0.1,
      .zones = NULL,
      .zone_clearance = 0.1,
      .survey_room_zone_index = -1,
  };
  waypoint_index = 0;
  route_finished = 0;
  ControllerNavigationServiceFrameOutput frame_output = {0};
  if (controller_navigation_service_process_frame(&frame_input, &frame_output) !=
      CONTROLLER_NAVIGATION_FRAME_READY) return 7;
  if (waypoint_index != 1 || frame_output.route.route.target.x != 2.0 ||
      frame_output.route_decision != CONTROLLER_NAVIGATION_ROUTE_ADVANCED) return 8;

  return 0;
}
