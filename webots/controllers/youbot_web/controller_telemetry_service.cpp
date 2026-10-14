#include "controller_telemetry_service.h"

#include "controller_lidar_math.h"

int controller_telemetry_service_collect_trace(
    const ObstacleTracePoint *trace,
    int trace_count,
    double now_time,
    double ttl_seconds,
    double min_confidence,
    ControllerTelemetryPoint *points,
    int point_capacity) {
  if (!trace || !points || trace_count <= 0 || point_capacity <= 0) return 0;

  int point_count = 0;
  for (int i = 0; i < trace_count && point_count < point_capacity; ++i) {
    const double confidence =
        controller_lidar_trace_confidence(&trace[i], now_time, ttl_seconds);
    if (confidence <= min_confidence) continue;
    points[point_count++] = ControllerTelemetryPoint{
        trace[i].x,
        trace[i].y,
        confidence,
    };
  }
  return point_count;
}

void controller_telemetry_service_build_snapshot(
    const ControllerTelemetryServiceSnapshotInput *input,
    ControllerTelemetrySnapshot *snapshot) {
  if (!input || !snapshot) return;
  *snapshot = ControllerTelemetrySnapshot{
      input->simulation_time,
      input->pose_x,
      input->pose_y,
      input->pose_z,
      input->pose_yaw,
      input->navigation,
      input->motion_profile,
      input->dynamic_zone_count,
      input->dynamic_zone_wall_count,
      input->lidar,
      input->camera,
      input->trace_points,
      input->trace_point_count,
      input->obstacle_map_cell_count,
      input->obstacle_map_cell_size,
      input->camera_map_cell_count,
      input->camera_map_obstacle_cell_count,
      input->camera_map_free_cell_count,
      input->camera_map_cell_size,
      input->route_waypoints,
      input->route_waypoint_count,
      input->object_transfer,
  };
}

void controller_telemetry_service_build_navigation(
    const char *status,
    const char *error,
    int current_waypoint_index,
    int finished,
    double distance_to_target,
    int avoidance_active,
    int off_route_active,
    double avoidance_time_sec,
    int avoidance_steps,
    const RouteData *route,
    ControllerTelemetryNavigation *navigation) {
  if (!navigation) return;
  const int has_target = route && route->count > 0 &&
                         current_waypoint_index >= 0 &&
                         current_waypoint_index < route->count;
  *navigation = ControllerTelemetryNavigation{
      status,
      error,
      current_waypoint_index,
      finished,
      distance_to_target,
      avoidance_active,
      off_route_active,
      avoidance_time_sec,
      avoidance_steps,
      has_target,
      has_target ? route->waypoints[current_waypoint_index] : Waypoint{0},
      route ? route->command_id : "",
  };
}
