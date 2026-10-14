#include "controller_telemetry_service.h"
#include <string.h>

int main(void) {
  const ObstacleTracePoint trace[3] = {
      {1.0, 2.0, 10.0, 3},
      {3.0, 4.0, 2.0, 3},
      {5.0, 6.0, 10.0, 0},
  };
  ControllerTelemetryPoint points[3] = {0};
  const int trace_point_count = controller_telemetry_service_collect_trace(
      trace, 3, 10.0, 6.0, 0.0, points, 3);
  if (trace_point_count != 1 || points[0].x != 1.0 || points[0].y != 2.0 ||
      points[0].confidence <= 0.0) return 1;

  const Waypoint route_waypoints[1] = {{7.0, 8.0, 0.0, 0}};
  const ControllerTelemetryServiceSnapshotInput snapshot_input = {
      12.0, 1.0, 2.0, 3.0, 0.5,
      {"tracking_path", "", 0, 0, 4.0, 0, 0, 0.0, 0, 0, {0}},
      {0.4, 2.0, 8.0, 0.9, 0.3, 0.5},
      2, 3,
      {1, 32, 5.0, 4, 2, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5},
      {1, 640, 480, 1.0, "webots_camera", "frame.png", "image/png", 5,
       11.5, 1, 0.8, 0.1, 0.2, 1.3, 2},
      points, trace_point_count,
      6, 0.2,
      7, 4, 3, 0.3,
      route_waypoints, 1,
  };
  ControllerTelemetrySnapshot snapshot = {0};
  controller_telemetry_service_build_snapshot(&snapshot_input, &snapshot);
  if (snapshot.simulation_time != 12.0 || snapshot.pose_yaw != 0.5 ||
      snapshot.dynamic_zone_wall_count != 3 || snapshot.trace_points != points ||
      snapshot.route_waypoints != route_waypoints || snapshot.route_waypoint_count != 1) return 2;

  RouteData route = {0};
  route.waypoints[0] = Waypoint{1.0, 2.0, 0.5, 1};
  route.count = 1;
  strcpy(route.command_id,"mission-42");
  ControllerTelemetryNavigation navigation = {0};
  controller_telemetry_service_build_navigation(
      "tracking_path", "", 0, 0, 1.2, 1, 0, 3.0, 4, &route, &navigation);
  if (!navigation.command_id || strcmp(navigation.command_id,"mission-42")) return 5;
  if (!navigation.has_target || navigation.target.x != 1.0 ||
      navigation.current_waypoint_index != 0) return 3;
  controller_telemetry_service_build_navigation(
      "finished", "", 1, 1, 0.0, 0, 0, 0.0, 0, &route, &navigation);
  if (navigation.has_target || navigation.finished != 1) return 4;
  return 0;
}
