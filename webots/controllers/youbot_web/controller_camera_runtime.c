#include "controller_camera_runtime.h"

#include "controller_app_config.h"
#include "controller_app_context.h"
#include "controller_camera_render.h"
#include "controller_camera_virtual.h"
#include "controller_io.h"
#include "controller_math.h"
#include "controller_webots_adapter.h"
#include "controller_webots_camera_adapter.h"
#include "controller_webots_camera_perception.h"
#include "controller_webots_camera_range.h"
#include "controller_webots_camera_map_sync.h"
#include "controller_navigation_runtime.h"

#include <math.h>
#include <string.h>

static ControllerWebotsCameraMapSyncContext camera_map_sync_context(void) {
  double robot_x = 0.0;
  double robot_y = 0.0;
  double heading = 0.0;
  read_pose(&robot_x, &robot_y, &heading);

  return (ControllerWebotsCameraMapSyncContext){
      controller_app.mapping_runtime.store.camera_map,
      &controller_app.mapping_runtime.store.camera_count,
      MAX_CAMERA_MAP_POINTS,
      controller_app.mapping_runtime.store.camera_free_map,
      &controller_app.mapping_runtime.store.camera_free_count,
      MAX_CAMERA_FREE_MAP_POINTS,
      CAMERA_MAP_CELL_SIZE,
      EPS,
      {
          LIDAR_LOCAL_X,
          LIDAR_LOCAL_Y,
          LIDAR_MIN_TRACE_RANGE,
          LIDAR_MAX_TRACE_RANGE,
          CAMERA_FREE_RAY_MIN_RANGE_M,
          CAMERA_FREE_RAY_MARGIN_M,
          CAMERA_FREE_RAY_STEP_M,
          LIDAR_NEAR_ROBOT_IGNORE_RADIUS,
      },
      {robot_x, robot_y, heading},
  };
}

void merge_camera_free_ray_into_map(double relative_angle, double range, int confidence_boost) {
  ControllerWebotsCameraMapSyncContext context = camera_map_sync_context();
  if (controller_webots_camera_map_sync_free_ray(
          &context, relative_angle, range, confidence_boost)) {
    controller_app.mapping_runtime.store.camera_dirty = 1;
  }
}

void merge_camera_observation_into_map(double relative_angle, double range, int confidence_boost) {
  ControllerWebotsCameraMapSyncContext context = camera_map_sync_context();
  if (controller_webots_camera_map_sync_observation(
          &context, relative_angle, range, confidence_boost)) {
    controller_app.mapping_runtime.store.camera_dirty = 1;
  }
}

static double camera_time(const ControllerCameraRuntime *runtime) {
  return runtime->operations.current_time
             ? runtime->operations.current_time(runtime->operations.context)
             : 0.0;
}

static double estimate_range(
    const ControllerCameraRuntime *runtime,
    double relative_angle,
    double fallback_range) {
  return controller_webots_camera_range_from_lidar(
      runtime->sensors,
      runtime->perception->lidar.available,
      runtime->perception->lidar.resolution,
      runtime->perception->lidar.fov,
      relative_angle,
      runtime->config.range_search_window,
      runtime->config.min_trace_range,
      runtime->config.max_trace_range,
      fallback_range);
}

static void merge_visible_frustum(
    ControllerCameraRuntime *runtime,
    double effective_fov,
    double default_range) {
  if (!runtime->perception->camera.available || !runtime->operations.merge_free_ray) return;
  const double half_fov = fmax(effective_fov, 0.8) * 0.5;
  for (int index = 0; index <= 8; ++index) {
    const double t = ((double)index / 8.0) * 2.0 - 1.0;
    const double angle = t * half_fov * 0.92;
    const double range = estimate_range(runtime, angle, default_range);
    runtime->operations.merge_free_ray(
        runtime->operations.context,
        angle,
        clamp_value(range, runtime->config.free_ray_min_range, runtime->config.max_trace_range),
        1);
  }
}

static void update_obstacle_hint(ControllerCameraRuntime *runtime) {
  const int step = *runtime->step_counter;
  controller_perception_runtime_reset_camera_observation(runtime->perception, step);
  if (!runtime->perception->camera.available ||
      !controller_webots_sensors_has_camera(runtime->sensors) ||
      runtime->perception->camera.width <= 0 || runtime->perception->camera.height <= 0) {
    return;
  }
  const unsigned char *image = controller_webots_sensors_camera_image(runtime->sensors);
  if (!image) return;
  const double effective_fov = runtime->perception->camera.fov > 1e-9
                                   ? runtime->perception->camera.fov
                                   : runtime->config.default_fov;
  merge_visible_frustum(runtime, effective_fov, runtime->config.range_fallback);
  ControllerWebotsCameraPerception result;
  controller_webots_camera_perception_analyze(
      image,
      runtime->perception->camera.width,
      runtime->perception->camera.height,
      effective_fov,
      runtime->config.min_obstacle_score,
      &result);
  ControllerPerceptionCameraObservation observation = {
      .score = result.score,
      .update_step = step,
  };
  /* A guessed RGB distance turns warm floor texture into an obstacle. */
  const double measured_range = estimate_range(runtime, result.angle, NAN);
  if (controller_webots_camera_perception_confirm_range(&result, measured_range)) {
    observation.visible = 1;
    observation.center_offset = result.center_offset;
    observation.angle = result.angle;
    observation.range = measured_range;
    observation.detection_count = result.detection_count;
    if (runtime->operations.merge_free_ray) {
      runtime->operations.merge_free_ray(
          runtime->operations.context, observation.angle, observation.range, 2);
    }
    if (runtime->operations.merge_observation) {
      runtime->operations.merge_observation(
          runtime->operations.context,
          observation.angle,
          observation.range,
          result.confidence_boost);
    }
  }
  controller_perception_runtime_update_camera(runtime->perception, &observation);
}

static void draw_overlay(
    ControllerCameraRuntime *runtime,
    unsigned char *pixels,
    double effective_fov) {
  controller_camera_render_reticle(
      pixels, runtime->config.frame_width, runtime->config.frame_height);
  if (runtime->controller->route.count <= 0 ||
      runtime->controller->current_waypoint_index >= runtime->controller->route.count ||
      !controller_webots_pose_is_ready(runtime->pose) || !runtime->operations.read_pose) {
    return;
  }
  double x = 0.0;
  double y = 0.0;
  double heading = 0.0;
  runtime->operations.read_pose(runtime->operations.context, &x, &y, &heading);
  const Waypoint *target =
      &runtime->controller->route.waypoints[runtime->controller->current_waypoint_index];
  const double target_angle = wrap_angle(atan2(target->z - y, target->x - x) - heading);
  if (fabs(target_angle) >= effective_fov * 0.5) return;
  const double offset = clamp_value(target_angle / (effective_fov * 0.5), -1.0, 1.0);
  const int target_x =
      (int)((offset * 0.5 + 0.5) * (runtime->config.frame_width - 1));
  controller_camera_render_waypoint_marker(
      pixels, runtime->config.frame_width, runtime->config.frame_height, target_x);
}

static int write_virtual_frame(ControllerCameraRuntime *runtime) {
  const int width = runtime->config.frame_width;
  const int height = runtime->config.frame_height;
  static unsigned char pixels[CAMERA_FRAME_WIDTH * CAMERA_FRAME_HEIGHT * 3];
  ControllerCameraVirtualCluster clusters[CAMERA_MAX_VIRTUAL_CLUSTERS];
  ControllerCameraVirtualSummary summary = {0};
  controller_camera_render_background(pixels, width, height);
  controller_perception_runtime_reset_camera_observation(
      runtime->perception, *runtime->step_counter);
  const double effective_fov = runtime->perception->camera.fov > 1e-9
                                   ? runtime->perception->camera.fov
                                   : runtime->config.default_fov;
  const ControllerCameraVirtualConfig virtual_config = {
      runtime->perception->lidar.fov,
      effective_fov,
      runtime->config.min_trace_range,
      runtime->config.max_trace_range,
      runtime->config.track_caution_range,
      runtime->config.avoid_stop_range,
      0.42,
  };
  const float *ranges = NULL;
  if (runtime->perception->lidar.available &&
      controller_webots_sensors_has_lidar(runtime->sensors) &&
      runtime->perception->lidar.resolution > 1 && runtime->perception->lidar.fov > 1e-9) {
    ranges = controller_webots_sensors_lidar_ranges(runtime->sensors);
    controller_camera_virtual_collect(
        ranges,
        runtime->perception->lidar.resolution,
        &virtual_config,
        clusters,
        runtime->config.max_virtual_clusters,
        &summary);
    for (int index = 0; ranges && index < runtime->perception->lidar.resolution; ++index) {
      const double alpha =
          (double)index / (double)(runtime->perception->lidar.resolution - 1);
      const double beam_angle =
          -0.5 * runtime->perception->lidar.fov + alpha * runtime->perception->lidar.fov;
      const double range = ranges[index];
      if (fabs(beam_angle) <= effective_fov * 0.5 &&
          controller_math_is_finite(range) && range > runtime->config.min_trace_range &&
          (index % 10) == 0 && runtime->operations.merge_free_ray) {
        runtime->operations.merge_free_ray(
            runtime->operations.context,
            beam_angle,
            clamp_value(
                range, runtime->config.free_ray_min_range, runtime->config.max_trace_range),
            1);
      }
    }
  }
  controller_camera_virtual_sort_by_range_desc(clusters, summary.cluster_count);
  for (int index = 0; index < summary.cluster_count; ++index) {
    const double range = clamp_value(
        clusters[index].range, 0.12, runtime->config.max_trace_range);
    ControllerCameraVirtualBox box;
    if (!controller_camera_virtual_box(
            &clusters[index], &virtual_config, width, height, &box)) continue;
    controller_camera_render_box(
        pixels, width, height, box.screen_x, box.bottom_y, box.width, box.height, box.danger);
    if (runtime->operations.merge_observation) {
      runtime->operations.merge_observation(
          runtime->operations.context,
          clusters[index].angle,
          range,
          1 + (int)clamp_value((double)clusters[index].beams / 2.0, 1.0, 8.0));
    }
  }
  const ControllerCameraVirtualObservation result =
      controller_camera_virtual_observation(&summary, runtime->config.min_obstacle_score);
  ControllerPerceptionCameraObservation observation = {
      .score = result.score,
      .update_step = *runtime->step_counter,
  };
  if (result.visible) {
    observation.visible = 1;
    observation.center_offset = result.center_offset;
    observation.angle = result.center_offset * effective_fov * 0.5;
    observation.range = estimate_range(runtime, observation.angle, runtime->config.range_fallback);
    observation.detection_count = result.detection_count;
  }
  controller_perception_runtime_update_camera(runtime->perception, &observation);
  draw_overlay(runtime, pixels, effective_fov);
  return write_bmp24(runtime->config.bmp_temp_path, pixels, width, height);
}

void controller_camera_runtime_init(
    ControllerCameraRuntime *runtime,
    ControllerWebotsSensors *sensors,
    ControllerPerceptionRuntime *perception,
    ControllerRuntime *controller,
    ControllerWebotsPose *pose,
    int *step_counter,
    const ControllerCameraRuntimeConfig *config,
    const ControllerCameraRuntimeOperations *operations) {
  if (!runtime) return;
  memset(runtime, 0, sizeof(*runtime));
  runtime->sensors = sensors;
  runtime->perception = perception;
  runtime->controller = controller;
  runtime->pose = pose;
  runtime->step_counter = step_counter;
  if (config) runtime->config = *config;
  if (operations) runtime->operations = *operations;
}

void controller_camera_runtime_configure_sensors(ControllerCameraRuntime *runtime) {
  if (!runtime || !runtime->sensors || !runtime->perception) return;
  const ControllerWebotsAdapterSensorState state = controller_webots_adapter_init_sensors(
      runtime->sensors,
      runtime->config.time_step_ms,
      runtime->config.capture_interval,
      runtime->config.frame_width,
      runtime->config.frame_height,
      runtime->config.default_fov);
  const ControllerPerceptionSensorMetadata metadata = {
      state.lidar_available, state.lidar_resolution, state.lidar_fov, state.lidar_max_range,
      state.camera_available, state.camera_virtual_mode, state.camera_width,
      state.camera_height, state.camera_fov,
  };
  controller_perception_runtime_configure(runtime->perception, &metadata);
}

void controller_camera_runtime_capture(ControllerCameraRuntime *runtime) {
  if (!runtime || !runtime->perception || !runtime->sensors || !runtime->step_counter) return;
  if (!runtime->perception->camera.available || runtime->perception->camera.virtual_mode ||
      !controller_webots_sensors_has_camera(runtime->sensors) ||
      (*runtime->step_counter % runtime->config.capture_interval) != 0) return;
  update_obstacle_hint(runtime);
}

void controller_camera_runtime_publish(ControllerCameraRuntime *runtime) {
  if (!runtime || !runtime->perception || !runtime->sensors || !runtime->step_counter) return;
  const ControllerCameraPublicationRequest request =
      controller_perception_runtime_camera_publication_request(
          runtime->perception,
          (*runtime->step_counter % runtime->config.write_interval) == 0);
  if (!request.requested) return;
  if (request.virtual_mode) {
    if (write_virtual_frame(runtime) == 0) {
      controller_webots_camera_adapter_publish_frame(
          runtime->config.bmp_temp_path,
          runtime->config.bmp_path,
          "camera_frame.bmp",
          "image/bmp",
          camera_time(runtime),
          &runtime->perception->camera.frame);
    }
    return;
  }
  if (!controller_webots_sensors_has_camera(runtime->sensors)) return;
  if (runtime->perception->camera.obstacle_update_step != *runtime->step_counter) {
    update_obstacle_hint(runtime);
  }
  if (controller_webots_sensors_save_camera_image(
          runtime->sensors, runtime->config.jpeg_temp_path, 70) == 0) {
    controller_webots_camera_adapter_publish_frame(
        runtime->config.jpeg_temp_path,
        runtime->config.jpeg_path,
        "camera_frame.jpg",
        "image/jpeg",
        camera_time(runtime),
        &runtime->perception->camera.frame);
  }
}
