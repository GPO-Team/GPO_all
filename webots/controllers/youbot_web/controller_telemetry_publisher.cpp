#include "controller_telemetry_publisher.h"

void controller_telemetry_publisher_build(
    const ControllerTelemetryPublisherInput *input,
    ControllerTelemetryPublisherOutput *output) {
  if (!input || !output || !input->runtime || !input->perception) return;
  const ControllerRuntime *runtime = input->runtime;
  const ControllerPerceptionRuntime *perception = input->perception;
  const int trace_count = controller_telemetry_service_collect_trace(
      perception->trace, perception->trace_count, input->simulation_time,
      input->trace_ttl_seconds, input->trace_min_confidence, output->trace,
      CONTROLLER_PERCEPTION_MAX_TRACE_POINTS);
  ControllerTelemetryNavigation navigation = {0};
  controller_telemetry_service_build_navigation(
      input->status, input->error, runtime->current_waypoint_index,
      runtime->route_finished, runtime->distance_to_target, runtime->avoidance.active,
      input->off_route_active, input->avoidance_time_sec, input->avoidance_steps,
      &runtime->route, &navigation);
  const ControllerTelemetryServiceSnapshotInput snapshot_input = {
      input->simulation_time, input->pose_x, input->pose_y, input->pose_z, input->pose_yaw,
      navigation,
      {input->cruise_speed_mps, input->payload_kg, input->battery_range_units,
       input->battery_speed_factor, input->linear_speed_limit, input->angular_speed_limit},
      runtime->limit_zones.count, input->dynamic_zone_wall_count,
      {perception->lidar.available, perception->lidar.resolution, perception->lidar.max_range,
       perception->lidar.stats.hit_count, perception->lidar.stats.front_hit_count,
       perception->lidar.stats.front_min_range, perception->lidar.stats.center_min_range,
       perception->lidar.stats.left_front_min_range, perception->lidar.stats.right_front_min_range,
       perception->lidar.stats.left_min_range, perception->lidar.stats.right_min_range},
      {perception->camera.available, perception->camera.width, perception->camera.height,
       perception->camera.fov, perception->camera.virtual_mode ? "virtual_lidar" : "webots_camera",
       perception->camera.frame.file_name, perception->camera.frame.mime_type,
       perception->camera.frame.sequence, perception->camera.frame.time,
       perception->camera.obstacle_visible, perception->camera.obstacle_score,
       perception->camera.obstacle_center_offset, perception->camera.obstacle_angle,
       perception->camera.obstacle_range, perception->camera.detection_count},
      output->trace, trace_count, input->obstacle_map_cell_count, input->obstacle_map_cell_size,
      input->camera_map_obstacle_cell_count + input->camera_map_free_cell_count,
      input->camera_map_obstacle_cell_count, input->camera_map_free_cell_count,
      input->camera_map_cell_size, runtime->route.waypoints, runtime->route.count,
      input->object_transfer};
  controller_telemetry_service_build_snapshot(&snapshot_input, &output->snapshot);
}
