#include "controller_app_lifecycle.h"

#include "controller_app_config.h"
#include "controller_app_internal.h"
#include "controller_camera_runtime.h"
#include "controller_webots_manipulator.h"
#include "controller_input_orchestration.h"
#include "controller_input_runtime.h"
#include "controller_io.h"
#include "controller_lidar_runtime.h"
#include "controller_mapping_runtime.h"
#include "controller_mapping_survey_lifecycle_service.h"
#include "controller_mapping_survey_safety_service.h"
#include "controller_motion_profile_reload_service.h"
#include "controller_navigation_runtime.h"
#include "controller_object_transfer_runtime.h"
#include "controller_paths.h"
#include "controller_route_zone_reload_service.h"
#include "controller_runtime.h"
#include "controller_runtime_command_reload_service.h"
#include "controller_step.h"
#include "controller_survey_default_route.h"
#include "controller_survey_runtime.h"
#include "controller_telemetry_publisher.h"
#include "controller_telemetry_service.h"
#include "controller_webots_adapter.h"
#include "controller_webots_camera_adapter.h"
#include "controller_webots_devices.h"
#include "controller_webots_motion_state.h"
#include "controller_webots_pose.h"
#include "controller_webots_sensors.h"
#include "controller_webots_zone_sync.h"

#include <stdio.h>
#include <stdlib.h>
#include <cmath>
#include "controller_navigation_route.h"
#include <webots/robot.h>







static void init_sensors(void) {
  controller_camera_runtime_configure_sensors(&camera_runtime);
}

static double camera_runtime_time(void *context) {
  (void)context;
  return wb_robot_get_time();
}

static void camera_runtime_read_pose(
    void *context, double *x, double *y, double *heading) {
  (void)context;
  read_pose(x, y, heading);
}

static void camera_runtime_merge_free(
    void *context, double angle, double range, int confidence) {
  (void)context;
  merge_camera_free_ray_into_map(angle, range, confidence);
}

static void camera_runtime_merge_obstacle(
    void *context, double angle, double range, int confidence) {
  (void)context;
  merge_camera_observation_into_map(angle, range, confidence);
}

static void init_camera_runtime(void) {
  const ControllerCameraRuntimeConfig config = {
      TIME_STEP,
      CAMERA_CAPTURE_INTERVAL,
      CAMERA_WRITE_INTERVAL,
      CAMERA_FRAME_WIDTH,
      CAMERA_FRAME_HEIGHT,
      CAMERA_MAX_VIRTUAL_CLUSTERS,
      1.05,
      CAMERA_OBSTACLE_MIN_SCORE,
      CAMERA_RANGE_FALLBACK_M,
      CAMERA_RANGE_SEARCH_WINDOW_RAD,
      LIDAR_MIN_TRACE_RANGE,
      LIDAR_MAX_TRACE_RANGE,
      LIDAR_TRACK_CAUTION_RANGE,
      LIDAR_AVOID_STOP_RANGE,
      CAMERA_FREE_RAY_MIN_RANGE_M,
      CAMERA_FRAME_BMP_PATH,
      CAMERA_FRAME_BMP_TEMP_PATH,
      CAMERA_FRAME_JPEG_PATH,
      CAMERA_FRAME_JPEG_TEMP_PATH,
  };
  const ControllerCameraRuntimeOperations operations = {
      camera_runtime_time,
      camera_runtime_read_pose,
      camera_runtime_merge_free,
      camera_runtime_merge_obstacle,
      NULL,
  };
  controller_camera_runtime_init(
      &camera_runtime,
      &webots_sensors,
      &perception_runtime,
      &controller_runtime,
      &webots_pose,
      &step_counter,
      &config,
      &operations);
}





void clear_persistent_map(void) {
  controller_mapping_runtime_clear(&mapping_runtime);
}

static void maybe_write_map(void) {
  controller_mapping_runtime_write(
      &mapping_runtime, (step_counter % MAP_WRITE_INTERVAL) == 0);
}






static void write_state_snapshot(void) {
  double x = 0.0;
  double y = 0.0;
  double heading = 0.0;
  read_pose(&x, &y, &heading);
  const ControllerTelemetryPublisherInput input = {
      .simulation_time = wb_robot_get_time(), .pose_x = x, .pose_y = y,
      .pose_z = START_HEIGHT, .pose_yaw = heading, .runtime = &controller_runtime,
      .perception = &perception_runtime, .status = navigation_status,
      .error = navigation_error, .off_route_active = route_off_route_active_now(),
      .avoidance_time_sec = route_avoidance_time_sec, .avoidance_steps = route_avoidance_steps,
      .cruise_speed_mps = configured_cruise_speed_mps, .payload_kg = configured_payload_kg,
      .battery_range_units = configured_battery_range_units,
      .battery_speed_factor = active_battery_speed_factor,
      .linear_speed_limit = active_linear_speed_limit,
      .angular_speed_limit = active_angular_speed_limit,
      .dynamic_zone_wall_count = zone_node_registry.count,
      .obstacle_map_cell_count = persistent_map_count, .obstacle_map_cell_size = MAP_CELL_SIZE,
      .camera_map_obstacle_cell_count = camera_map_count,
      .camera_map_free_cell_count = camera_free_map_count,
      .camera_map_cell_size = CAMERA_MAP_CELL_SIZE,
      .trace_ttl_seconds = LIDAR_TRACE_TTL_SECONDS,
      .trace_min_confidence = LIDAR_TRACE_MIN_CONFIDENCE,
      .object_transfer = &object_transfer_runtime.service.state,
  };
  ControllerTelemetryPublisherOutput output = {};
  controller_telemetry_publisher_build(&input, &output);
  output.snapshot.manipulator = &controller_app.manipulator;
  controller_telemetry_write_snapshot(STATE_TEMP_PATH, STATE_PATH, &output.snapshot);
}

static void merge_trace_for_controller_step(void) {
  merge_trace_into_map(wb_robot_get_time());
}

static int robot_motion_owned(void) {
  return controller_webots_manipulator_busy() || object_transfer_runtime.service.state.status == CONTROLLER_TRANSFER_RUNNING || object_transfer_runtime.service.state.status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
}

static void handle_transfer_command(const RuntimeCommand *command) {
  if (controller_webots_manipulator_busy()) return;
  if(command->has_transfer_object) {
    reload_limit_zones_input(NULL);
    reload_surface_zones_input(NULL);
    controller_motion_profile_reload_service_run(&motion_profile_reload_service,0,1);
  }
  controller_object_transfer_runtime_command(
      &object_transfer_runtime, command, wb_robot_get_time());
}

static void run_control_cycle(void) {
  if (controller_webots_manipulator_step((double)TIME_STEP / 1000.0)) return;
  double x = 0.0, y = 0.0, heading = 0.0;
  read_pose(&x, &y, &heading);
  controller_object_transfer_runtime_step(
      &object_transfer_runtime, wb_robot_get_time(), x, y, heading);
  const int transferring = object_transfer_runtime.service.state.status == CONTROLLER_TRANSFER_RUNNING;
  if(!transferring) controller_webots_motion_state_apply(&motion_state);
  if(!transferring || object_transfer_runtime.service.state.stage != CONTROLLER_TRANSFER_TRANSPORTING) {
    webots_adapter.drive_config.acceleration_limit_rad_s2=control_config.drive.acceleration_limit_rad_s2;
    webots_adapter.drive_config.deceleration_limit_rad_s2=control_config.drive.deceleration_limit_rad_s2;
  }
  control_config.navigation.runtime.position_tolerance = transferring ? 0.005 : 0.05;
  control_config.navigation.runtime.heading_tolerance_rad = transferring ? 0.02 : 0.08;
  control_config.navigation.tracking.position_tolerance = transferring ? 0.005 : 0.05;
  control_config.navigation.tracking.heading_tolerance_rad = transferring ? 0.02 : 0.08;
  if(transferring && object_transfer_runtime.service.state.attached) {
    active_linear_speed_limit = std::fmin(active_linear_speed_limit,0.08);
    active_angular_speed_limit = std::fmin(active_angular_speed_limit,0.25);
  }
  if(transferring && (object_transfer_runtime.service.state.stage == CONTROLLER_TRANSFER_TRANSPORTING ||
      object_transfer_runtime.service.state.stage == CONTROLLER_TRANSFER_APPROACHING_OBJECT)) {
    ControllerNavigationRouteOutput route_output={};
    const auto decision=controller_navigation_route_evaluate(&controller_runtime.route,
        &controller_runtime.current_waypoint_index,&controller_runtime.route_finished,
        x,y,heading,0.005,0.02,&route_output);
    if(decision==CONTROLLER_NAVIGATION_ROUTE_COMPLETED || decision==CONTROLLER_NAVIGATION_ROUTE_FINISHED) {
      controller_webots_devices_reset_wheels(&webots_devices); set_status("finished");
    } else {
      const auto &target=controller_runtime.route.waypoints[controller_runtime.current_waypoint_index];
      const double dx=target.x-x,dy=target.z-y;
      const double distance=std::hypot(dx,dy);
      bool blocked=false;
      const auto &cargo=object_transfer_runtime.service.state;
      for(int i=0;i<perception_runtime.trace_count;++i) {
        const auto &point=perception_runtime.trace[i];
        if(wb_robot_get_time()-point.last_seen_time>2.0) continue;
        if(std::hypot(point.x-cargo.object_pose[0],point.y-cargo.object_pose[1])<0.20) continue;
        const double along=((point.x-x)*dx+(point.y-y)*dy)/std::fmax(distance,1e-9);
        const double across=std::fabs((point.x-x)*dy-(point.y-y)*dx)/std::fmax(distance,1e-9);
        if(along>0 && along<std::fmin(distance+0.5,0.75) && across<(cargo.attached ? 0.50 : 0.36)) {blocked=true;break;}
      }
      if(blocked) {
        controller_object_transfer_runtime_hold(&object_transfer_runtime,"transport_obstacle");
        return;
      }
      const double speed=std::fmin(std::fmin(cargo.attached ? 0.06 : 0.12,active_linear_speed_limit),distance*0.6);
      webots_adapter.drive_config.acceleration_limit_rad_s2=4.0;
      webots_adapter.drive_config.deceleration_limit_rad_s2=8.0;
      controller_webots_adapter_apply_velocity(&webots_adapter,speed*(std::cos(heading)*dx+std::sin(heading)*dy)/std::fmax(distance,1e-9),
          speed*(-std::sin(heading)*dx+std::cos(heading)*dy)/std::fmax(distance,1e-9),
          std::fmax(-0.1,std::fmin(0.1,-heading*0.6)));
      set_status("transporting_object");
    }
  } else if (controller_object_transfer_runtime_allows_navigation(&object_transfer_runtime))
    run_navigation_step();
  else
    controller_webots_devices_reset_wheels(&webots_devices);
}

#define STEP_CALLBACK(callback) \
  static void callback##_step(void *context) { \
    (void)context; \
    callback(); \
  }
STEP_CALLBACK(maybe_reload_zones)
STEP_CALLBACK(maybe_reload_surface_zones)
STEP_CALLBACK(maybe_reload_route)
STEP_CALLBACK(maybe_reload_motion_profile)
STEP_CALLBACK(maybe_reload_runtime_command)
STEP_CALLBACK(capture_lidar_trace)
STEP_CALLBACK(merge_trace_for_controller_step)
STEP_CALLBACK(maybe_write_map)
static void maybe_update_camera_perception_step(void *context) {
  (void)context;
  controller_camera_runtime_capture(&camera_runtime);
}
static void maybe_write_camera_frame_step(void *context) {
  (void)context;
  controller_camera_runtime_publish(&camera_runtime);
}
STEP_CALLBACK(run_control_cycle)
STEP_CALLBACK(update_route_avoidance_metrics)
STEP_CALLBACK(write_state_snapshot)
#undef STEP_CALLBACK

static const ControllerStepCallbacks controller_step_callbacks = {
    maybe_reload_zones_step,
    maybe_reload_surface_zones_step,
    maybe_reload_route_step,
    maybe_reload_motion_profile_step,
    maybe_reload_runtime_command_step,
    capture_lidar_trace_step,
    merge_trace_for_controller_step_step,
    maybe_write_map_step,
    maybe_update_camera_perception_step,
    maybe_write_camera_frame_step,
    NULL,
    run_control_cycle_step,
    update_route_avoidance_metrics_step,
    write_state_snapshot_step,
};

int controller_app_lifecycle_run(int argc, char **argv) {
  (void)argc;
  (void)argv;

  controller_app_context_init(&controller_app);

  if (!controller_paths_init(&controller_paths, getenv("WEB_STATE_DIR"))) {
    fprintf(stderr, "Failed to initialize Webots state paths.\n");
    return 1;
  }

  wb_robot_init();
  controller_webots_devices_init(&webots_devices);
  const ControllerDriveConfig drive_config = controller_webots_adapter_drive_config(
      control_config.drive.wheel_radius,
      control_config.drive.wheel_base_longitudinal,
      control_config.drive.wheel_base_lateral,
      control_config.drive.max_wheel_speed_rad_s,
      control_config.drive.acceleration_limit_rad_s2,
      control_config.drive.deceleration_limit_rad_s2,
      control_config.time_step_ms / 1000.0);
  controller_webots_adapter_init(
      &webots_adapter, &drive_config, drive_webots_base, &webots_devices);
  controller_webots_sensors_init(&webots_sensors);
  controller_application_state_init(&application_state);
  init_camera_runtime();
  init_sensors();
  init_pose_tracking();
  webots_zone_sync = ControllerWebotsZoneSyncContext{
      webots_pose.root_children_field,
      &zone_node_registry,
      &surface_zone_registry,
      &runtime_obstacle_registry,
      MAX_ZONE_NODES,
      MAX_SURFACE_ZONE_NODES,
      MAX_RUNTIME_OBSTACLE_NODES,
      WALL_THICKNESS,
      WALL_HEIGHT,
      -21.5,
      21.5,
      -16.5,
      16.5,
  };
  reset_robot_pose();
  controller_runtime_init(&controller_runtime);
  controller_object_transfer_runtime_init(
      &object_transfer_runtime, &controller_runtime, &webots_devices);
  const ControllerMappingRuntimeConfig mapping_config = {
      .paths = {MAP_PATH, MAP_TEMP_PATH, MAP_CSV_PATH, MAP_CSV_TEMP_PATH,
                CAMERA_MAP_PATH, CAMERA_MAP_TEMP_PATH, CAMERA_MAP_CSV_PATH,
                CAMERA_MAP_CSV_TEMP_PATH},
      .map_cell_size = MAP_CELL_SIZE,
      .camera_cell_size = CAMERA_MAP_CELL_SIZE,
  };
  controller_mapping_runtime_init(&mapping_runtime, &mapping_config);
  controller_mapping_survey_safety_service_init(
      &mapping_survey_safety_service,
      &controller_runtime,
      &mapping_runtime,
      &perception_runtime,
      ControllerMappingSurveySafetyServiceConfig{
          LIDAR_TRACE_TTL_SECONDS,
          0.18,
          MAPPING_SURVEY_MAX_EXTENT_X,
          MAPPING_SURVEY_MAX_EXTENT_Y,
          MAPPING_SURVEY_MAP_OBSTACLE_CLEARANCE,
          MAPPING_SURVEY_GRID_CELL,
      });
  controller_route_zone_service_init(&route_zone_service);
  // Restore zones after restart, but require an explicit new route launch.
  route_zone_service.route_last_checked = get_file_mtime(ROUTE_PATH);
  controller_route_zone_reload_service_init(
      &route_zone_reload_service,
      &route_zone_service,
      &controller_runtime,
      &webots_zone_sync,
      ControllerRouteZoneServicePaths{ROUTE_PATH, ZONE_PATH, SURFACE_ZONE_PATH},
      set_status,
      set_error,
      reset_route_avoidance_metrics,
      reset_navigation_mode);
  static const ControllerInputOrchestrationOperations input_operations = {
      reload_motion_profile_input,
      reload_runtime_command_input,
      reload_limit_zones_input,
      reload_surface_zones_input,
      reload_route_input,
      set_input_status,
  };
  controller_input_orchestration_init(
      &input_orchestration,
      &input_operations,
      NULL,
      ZONE_RELOAD_INTERVAL,
      ROUTE_RELOAD_INTERVAL,
      RUNTIME_COMMAND_RELOAD_INTERVAL);
  clear_persistent_map();
  controller_webots_camera_adapter_remove_frames(
      CAMERA_FRAME_BMP_PATH,
      CAMERA_FRAME_BMP_TEMP_PATH,
      CAMERA_FRAME_JPEG_PATH,
      CAMERA_FRAME_JPEG_TEMP_PATH);
  controller_motion_profile_reload_service_init(
      &motion_profile_reload_service, &motion_state, MOTION_PROFILE_PATH);
  controller_webots_motion_state_apply(&motion_state);
  controller_motion_profile_reload_service_run(&motion_profile_reload_service, 0, 1);
  const ControllerSurveyIntegrationOps runtime_command_survey_ops = survey_integration_ops();
  controller_runtime_command_reload_service_init(
      &runtime_command_reload_service,
      RUNTIME_COMMAND_PATH,
      ROUTE_PATH,
      ControllerRuntimeCommandLimits{
          SURVEY_X_MIN,
          SURVEY_X_MAX,
          SURVEY_Y_MIN,
          SURVEY_Y_MAX,
          MAPPING_SURVEY_MAX_EXTENT_X,
          MAPPING_SURVEY_MAX_EXTENT_Y,
      },
      &controller_runtime,
      &runtime_command_survey_ops,
      spawn_runtime_obstacle);
  controller_runtime_command_reload_service_set_transfer_handler(
      &runtime_command_reload_service, handle_transfer_command);
  runtime_command_reload_service.start_pick_place = controller_webots_manipulator_start;
  runtime_command_reload_service.cancel_pick_place = controller_webots_manipulator_cancel;
  runtime_command_reload_service.motion_blocked = robot_motion_owned;
  route_zone_reload_service.motion_blocked = robot_motion_owned;
  runtime_command_reload_service.last_modified = get_file_mtime(RUNTIME_COMMAND_PATH);
  runtime_command_reload_service.last_processed_id = controller_runtime_command_latest_id(RUNTIME_COMMAND_PATH);

  if (!controller_webots_pose_is_ready(&webots_pose) || !webots_pose.root_children_field) {
    set_status("error");
    set_error("Supervisor fields are not available");
  } else {
    wait_for_fresh_route();
  }

  while (wb_robot_step(TIME_STEP) != -1) {
    ++step_counter;
    controller_step_run(
        step_counter, &control_config.schedule.lifecycle, &controller_step_callbacks, NULL);
  }

  controller_mapping_runtime_write(&mapping_runtime, 1);
  controller_webots_zone_sync_remove_all(&webots_zone_sync);
  wb_robot_cleanup();
  return 0;
}
