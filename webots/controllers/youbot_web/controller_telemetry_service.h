#ifndef YOUBOT_WEB_CONTROLLER_TELEMETRY_SERVICE_H
#define YOUBOT_WEB_CONTROLLER_TELEMETRY_SERVICE_H

#include "controller_telemetry.h"

typedef struct {
  double simulation_time;
  double pose_x;
  double pose_y;
  double pose_z;
  double pose_yaw;
  ControllerTelemetryNavigation navigation;
  ControllerTelemetryMotionProfile motion_profile;
  int dynamic_zone_count;
  int dynamic_zone_wall_count;
  ControllerTelemetryLidar lidar;
  ControllerTelemetryCamera camera;
  const ControllerTelemetryPoint *trace_points;
  int trace_point_count;
  int obstacle_map_cell_count;
  double obstacle_map_cell_size;
  int camera_map_cell_count;
  int camera_map_obstacle_cell_count;
  int camera_map_free_cell_count;
  double camera_map_cell_size;
  const Waypoint *route_waypoints;
  int route_waypoint_count;
  const ControllerObjectTransferState *object_transfer;
} ControllerTelemetryServiceSnapshotInput;

int controller_telemetry_service_collect_trace(
    const ObstacleTracePoint *trace,
    int trace_count,
    double now_time,
    double ttl_seconds,
    double min_confidence,
    ControllerTelemetryPoint *points,
    int point_capacity);
void controller_telemetry_service_build_snapshot(
    const ControllerTelemetryServiceSnapshotInput *input,
    ControllerTelemetrySnapshot *snapshot);

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
    ControllerTelemetryNavigation *navigation);

#endif
