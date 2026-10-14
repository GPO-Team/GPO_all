#include "controller_navigation_motion_service.h"

#include <string.h>

int controller_navigation_motion_service_compute(
    const ControllerNavigationTrackingConfig *tracking_config,
    const ControllerNavigationLidarConfig *lidar_config,
    const ControllerNavigationMotionServiceInput *input,
    ControllerNavigationMotionServiceOutput *output) {
  if (!tracking_config || !lidar_config || !input || !output) return 0;
  memset(output, 0, sizeof(*output));

  ControllerNavigationTrackingInput tracking = input->tracking;
  if (controller_navigation_tracking_prepare(
          tracking_config, &tracking, &output->tracking)) {
    return 1;
  }

  tracking.mode = output->tracking.mode;
  controller_navigation_lidar_compute(
      lidar_config, &input->lidar, &output->lidar);
  tracking.updated_heading_error = output->lidar.updated_heading_error;
  tracking.route_relaxed_mode =
      tracking.route_relaxed_mode || output->lidar.caution_active;
  tracking.lidar_hard_priority = output->lidar.hard_priority;
  tracking.lidar_priority_turn_sign = output->lidar.priority_turn_sign;
  tracking.lidar_heading_bias = output->lidar.heading_bias;
  tracking.lidar_speed_scale = output->lidar.speed_scale;
  tracking.expected_wall_speed_scale = output->lidar.expected_wall_speed_scale;
  tracking.lidar_caution_active = output->lidar.caution_active;
  controller_navigation_tracking_compute(
      tracking_config, &tracking, &output->tracking);
  return 0;
}
