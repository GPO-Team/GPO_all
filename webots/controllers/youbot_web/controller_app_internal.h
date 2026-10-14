#ifndef YOUBOT_WEB_CONTROLLER_APP_INTERNAL_H
#define YOUBOT_WEB_CONTROLLER_APP_INTERNAL_H

#include "controller_app_context.h"
#include "controller_zone_geometry.h"

#define webots_devices controller_app.webots_devices
#define webots_adapter controller_app.webots_adapter
#define webots_pose controller_app.webots_pose
#define webots_sensors controller_app.webots_sensors
#define controller_runtime controller_app.controller_runtime
#define route_zone_service controller_app.route_zone_service
#define route_zone_reload_service controller_app.route_zone_reload_service
#define zone_node_registry controller_app.zone_node_registry
#define surface_zone_registry controller_app.surface_zone_registry
#define runtime_obstacle_registry controller_app.runtime_obstacle_registry
#define webots_zone_sync controller_app.webots_zone_sync
#define mapping_runtime controller_app.mapping_runtime
#define mapping_survey_safety_service controller_app.mapping_survey_safety_service
#define perception_runtime controller_app.perception_runtime
#define camera_runtime controller_app.camera_runtime
#define application_state controller_app.application_state
#define motion_state controller_app.motion_state
#define motion_profile_reload_service controller_app.motion_profile_reload_service
#define object_transfer_runtime controller_app.object_transfer_runtime
#define runtime_command_reload_service controller_app.runtime_command_reload_service
#define input_orchestration controller_app.input_orchestration
#define controller_paths controller_app.paths
#define control_config controller_app.control_config

#define mapping_store mapping_runtime.store
#define persistent_map mapping_store.persistent_map
#define persistent_map_count mapping_store.persistent_count
#define map_dirty mapping_store.persistent_dirty
#define mapping_camera_map mapping_store.camera_map
#define camera_map_count mapping_store.camera_count
#define camera_free_map mapping_store.camera_free_map
#define camera_free_map_count mapping_store.camera_free_count
#define camera_map_dirty mapping_store.camera_dirty
#define step_counter application_state.step_counter
#define navigation_status application_state.status
#define navigation_error application_state.error
#define configured_cruise_speed_mps motion_state.profile.cruise_speed_mps
#define configured_payload_kg motion_state.profile.payload_kg
#define configured_battery_range_units motion_state.profile.battery_range_units
#define active_linear_speed_limit motion_state.limits.linear_speed_mps
#define active_angular_speed_limit motion_state.limits.angular_speed_rad_s
#define active_battery_speed_factor motion_state.limits.battery_speed_factor
#define route_avoidance_time_sec application_state.route_avoidance_time_sec
#define route_avoidance_steps application_state.route_avoidance_steps

#define ROUTE_PATH controller_paths.route
#define ZONE_PATH controller_paths.limit_zones
#define SURFACE_ZONE_PATH controller_paths.surface_zones
#define STATE_PATH controller_paths.robot_state
#define STATE_TEMP_PATH controller_paths.robot_state_temp
#define MOTION_PROFILE_PATH controller_paths.motion_profile
#define RUNTIME_COMMAND_PATH controller_paths.runtime_command
#define MAP_PATH controller_paths.obstacle_map
#define MAP_TEMP_PATH controller_paths.obstacle_map_temp
#define MAP_CSV_PATH controller_paths.obstacle_map_csv
#define MAP_CSV_TEMP_PATH controller_paths.obstacle_map_csv_temp
#define CAMERA_MAP_PATH controller_paths.camera_map
#define CAMERA_MAP_TEMP_PATH controller_paths.camera_map_temp
#define CAMERA_MAP_CSV_PATH controller_paths.camera_map_csv
#define CAMERA_MAP_CSV_TEMP_PATH controller_paths.camera_map_csv_temp
#define CAMERA_FRAME_BMP_PATH controller_paths.camera_frame_bmp
#define CAMERA_FRAME_BMP_TEMP_PATH controller_paths.camera_frame_bmp_temp
#define CAMERA_FRAME_JPEG_PATH controller_paths.camera_frame_jpeg
#define CAMERA_FRAME_JPEG_TEMP_PATH controller_paths.camera_frame_jpeg_temp

#define point_in_zone controller_zone_geometry_point_in
#define point_near_zone controller_zone_geometry_point_near
#define point_near_zone_boundary controller_zone_geometry_point_near_boundary
#define zone_signed_area controller_zone_geometry_signed_area
#define segment_blocked_by_zones(ax, ay, bx, by, clearance, skip_zone_index) \
  controller_zone_geometry_segment_blocked(                                      \
      &controller_runtime.limit_zones, (ax), (ay), (bx), (by), (clearance), (skip_zone_index))
#define find_room_zone_index(robot_x, robot_y) \
  controller_zone_geometry_find_room(&controller_runtime.limit_zones, (robot_x), (robot_y))

#endif
