#include "controller_navigation_perception.h"

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
  output->camera_visual_front_obstacle =
      input->lidar_available &&
      input->lidar_context->unexpected_front_hit_count > 0 &&
      input->camera_visible &&
      fabs(input->camera_angle) <
          fmax(input->camera_fov, config->camera_min_fov) *
              config->camera_front_fov_factor &&
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
}
