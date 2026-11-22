#include "controller_navigation_perception.h"

#include "controller_math.h"
#include "controller_webots_camera_perception.h"

#include <cmath>
#include <string.h>

void controller_navigation_tracking_set_rear_clear(int rear_clear);

void controller_navigation_perception_prepare(
    const ControllerNavigationPerceptionInput *input,
    const ControllerNavigationPerceptionConfig *config,
    ControllerNavigationPerceptionOutput *output) {
  if (!input || !config || !output || !input->lidar_context) return;
  memset(output, 0, sizeof(*output));

  const int rear_clear =
      !input->lidar_available ||
      input->lidar_context->unexpected_rear_hit_count == 0 ||
      input->lidar_context->unexpected_rear_min_range > 0.65;
  controller_navigation_tracking_set_rear_clear(rear_clear);

  ControllerWebotsCameraPerception fused_camera = {};
  const int has_fused_camera =
      controller_webots_camera_get_latest_perception(&fused_camera);

  const double camera_range =
      input->camera_range > config->camera_range_epsilon
          ? input->camera_range
          : config->camera_range_fallback;
  output->camera_effective_range = camera_range;

  const int lidar_verified_camera_obstacle =
      !input->lidar_available ||
      !has_fused_camera ||
      fused_camera.obstacle_lidar_confirmed;

  const double half_fov =
      fmax(input->camera_fov, config->camera_min_fov) * config->camera_front_fov_factor;
  output->camera_visual_front_obstacle =
      input->camera_visible &&
      lidar_verified_camera_obstacle &&
      fabs(input->camera_angle) <= half_fov &&
      camera_range <
          config->avoidance.track_caution_range + config->camera_range_margin &&
      (input->camera_score >= config->camera_min_score ||
       input->camera_detection_count >= config->camera_min_detection_count);

  if (output->camera_visual_front_obstacle &&
      fabs(input->camera_center_offset) > config->camera_offset_deadband) {
    output->camera_preferred_turn_sign =
        input->camera_center_offset < 0.0 ? -1.0 : 1.0;
  }

  controller_avoidance_detect(
      input->lidar_context,
      input->lidar_available,
      output->camera_visual_front_obstacle,
      &config->avoidance,
      &output->avoidance);

  if (output->camera_visual_front_obstacle) {
    const double resolved_front_range =
        (has_fused_camera && fused_camera.visible && fused_camera.fallback_range_m > 0.05)
            ? fmin(camera_range, fused_camera.fallback_range_m)
            : camera_range;

    output->avoidance.camera_front_range = resolved_front_range;
    output->avoidance.front_obstacle_detected = 1;
    output->avoidance.front_obstacle_range =
        fmin(output->avoidance.front_obstacle_range, resolved_front_range);
    if (fabs(input->camera_angle) <= 0.28) {
      output->avoidance.center_obstacle_range =
          fmin(output->avoidance.center_obstacle_range, resolved_front_range);
    }
    output->avoidance.near_front_range =
        fmin(output->avoidance.near_front_range, resolved_front_range);
    output->avoidance.obstacle_context_present = 1;

    if (resolved_front_range <= config->avoidance.pass_center_clear_range) {
      output->avoidance.center_passage_available = 0;
    }
    if (resolved_front_range < config->avoidance.avoid_trigger_range + 0.14) {
      output->avoidance.should_start_avoidance = 1;
    }
  } else {
    output->avoidance.camera_front_range = config->avoidance.max_trace_range;
  }
}