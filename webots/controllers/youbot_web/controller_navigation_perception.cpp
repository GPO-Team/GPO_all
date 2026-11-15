#include "controller_navigation_perception.h"

#include "controller_math.h"

#include <cmath>
#include <string.h>

void controller_navigation_perception_prepare(
    const ControllerNavigationPerceptionInput *input,
    const ControllerNavigationPerceptionConfig *config,
    ControllerNavigationPerceptionOutput *output) {
  if (!input || !config || !output || !input->lidar_context) return;
  memset(output, 0, sizeof(*output));

  const double camera_range =
      input->camera_range > config->camera_range_epsilon
          ? input->camera_range
          : config->camera_range_fallback;
  output->camera_effective_range = camera_range;

  const double half_fov =
      fmax(input->camera_fov, config->camera_min_fov) * config->camera_front_fov_factor;
  output->camera_visual_front_obstacle =
      input->camera_visible &&
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
    output->avoidance.camera_front_range = camera_range;
    output->avoidance.front_obstacle_detected = 1;
    output->avoidance.front_obstacle_range =
        fmin(output->avoidance.front_obstacle_range, camera_range);
    if (fabs(input->camera_angle) <= 0.24) {
      output->avoidance.center_obstacle_range =
          fmin(output->avoidance.center_obstacle_range, camera_range);
    }
    output->avoidance.near_front_range =
        fmin(output->avoidance.near_front_range, camera_range);
    output->avoidance.obstacle_context_present = 1;

    if (camera_range <= config->avoidance.pass_center_clear_range) {
      output->avoidance.center_passage_available = 0;
    }
    if (camera_range < config->avoidance.avoid_trigger_range + 0.12) {
      output->avoidance.should_start_avoidance = 1;
    }
  } else {
    output->avoidance.camera_front_range = config->avoidance.max_trace_range;
  }
}