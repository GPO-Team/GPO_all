#ifndef YOUBOT_WEB_CONTROLLER_TELEMETRY_PUBLISHER_H
#define YOUBOT_WEB_CONTROLLER_TELEMETRY_PUBLISHER_H

#include "controller_perception_runtime.h"
#include "controller_runtime.h"
#include "controller_telemetry_service.h"

typedef struct {
  double simulation_time;
  double pose_x;
  double pose_y;
  double pose_z;
  double pose_yaw;
  const ControllerRuntime *runtime;
  const ControllerPerceptionRuntime *perception;
  const char *status;
  const char *error;
  int off_route_active;
  double avoidance_time_sec;
  int avoidance_steps;
  double cruise_speed_mps;
  double payload_kg;
  double battery_range_units;
  double battery_speed_factor;
  double linear_speed_limit;
  double angular_speed_limit;
  int dynamic_zone_wall_count;
  int obstacle_map_cell_count;
  double obstacle_map_cell_size;
  int camera_map_obstacle_cell_count;
  int camera_map_free_cell_count;
  double camera_map_cell_size;
  double trace_ttl_seconds;
  double trace_min_confidence;
  const ControllerObjectTransferState *object_transfer;
} ControllerTelemetryPublisherInput;

typedef struct {
  ControllerTelemetryPoint trace[CONTROLLER_PERCEPTION_MAX_TRACE_POINTS];
  ControllerTelemetrySnapshot snapshot;
} ControllerTelemetryPublisherOutput;

void controller_telemetry_publisher_build(
    const ControllerTelemetryPublisherInput *input,
    ControllerTelemetryPublisherOutput *output);

#endif
