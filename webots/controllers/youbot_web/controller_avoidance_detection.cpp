#include "controller_avoidance_detection.h"

#include <cmath>
#include <string.h>

void controller_avoidance_detect(
    const LidarObstacleContext *context,
    int lidar_available,
    int camera_visual_front_obstacle,
    const ControllerAvoidanceDetectionConfig *config,
    ControllerAvoidanceDetection *detection) {
  if (!context || !config || !detection) return;
  memset(detection, 0, sizeof(*detection));

  detection->front_obstacle_detected =
      lidar_available && context->unexpected_front_hit_count > 0;
  detection->front_obstacle_range = detection->front_obstacle_detected
                                        ? context->unexpected_front_min_range
                                        : config->max_trace_range;
  detection->center_obstacle_range = detection->front_obstacle_detected
                                         ? context->unexpected_center_min_range
                                         : config->max_trace_range;
  detection->left_front_corner_range =
      lidar_available ? context->unexpected_left_front_min_range : config->max_trace_range;
  detection->right_front_corner_range =
      lidar_available ? context->unexpected_right_front_min_range : config->max_trace_range;
  detection->left_obstacle_range =
      lidar_available ? context->unexpected_left_min_range : config->max_trace_range;
  detection->right_obstacle_range =
      lidar_available ? context->unexpected_right_min_range : config->max_trace_range;
  detection->expected_front_range =
      lidar_available ? context->expected_front_min_range : config->max_trace_range;
  detection->near_front_range = fmin(
      fmin(detection->front_obstacle_range, detection->center_obstacle_range),
      fmin(detection->left_front_corner_range, detection->right_front_corner_range));
  detection->left_lidar_context =
      fmin(detection->left_obstacle_range, detection->left_front_corner_range);
  detection->right_lidar_context =
      fmin(detection->right_obstacle_range, detection->right_front_corner_range);

  detection->expected_zone_wall_ahead =
      lidar_available && detection->expected_front_range < config->track_caution_range;
  detection->expected_zone_wall_close =
      lidar_available && detection->expected_front_range < config->expected_wall_soft_stop_range;
  detection->expected_zone_wall_slowdown =
      lidar_available && detection->expected_front_range < config->expected_wall_slowdown_range;
  detection->center_passage_available =
      lidar_available && context->has_best_gap &&
      detection->center_obstacle_range > config->pass_center_clear_range &&
      context->best_gap_range > config->pass_center_clear_range &&
      fabs(context->best_gap_beam_angle) < config->pass_gap_max_angle_rad &&
      detection->left_lidar_context > config->pass_side_danger_range &&
      detection->right_lidar_context > config->pass_side_danger_range;
  detection->side_obstacle_detected =
      lidar_available && !detection->center_passage_available &&
      (detection->left_lidar_context < config->avoid_side_trigger_range ||
       detection->right_lidar_context < config->avoid_side_trigger_range);
  detection->lidar_hard_priority_zone =
      lidar_available &&
      ((detection->center_passage_available ? detection->center_obstacle_range
                                            : detection->near_front_range) <
           config->track_hard_priority_range ||
       (!detection->center_passage_available &&
        (detection->left_lidar_context < config->avoid_side_trigger_range + 0.10 ||
         detection->right_lidar_context < config->avoid_side_trigger_range + 0.10)));
  detection->front_corner_obstacle_detected =
      !detection->center_passage_available &&
      (detection->left_front_corner_range < config->avoid_trigger_range + 0.10 ||
       detection->right_front_corner_range < config->avoid_trigger_range + 0.10);
  detection->obstacle_context_present =
      (lidar_available &&
       (detection->near_front_range < config->avoid_recover_range ||
        detection->left_lidar_context < config->reflex_side_release_range ||
        detection->right_lidar_context < config->reflex_side_release_range)) ||
      camera_visual_front_obstacle;
  detection->should_start_avoidance =
      camera_visual_front_obstacle ||
      (lidar_available &&
       ((detection->front_obstacle_detected &&
         detection->near_front_range < config->avoid_trigger_range) ||
        detection->center_obstacle_range < config->avoid_stop_range + 0.08 ||
        detection->front_corner_obstacle_detected ||
        (detection->side_obstacle_detected &&
         detection->near_front_range < config->track_slow_range) ||
        (detection->lidar_hard_priority_zone &&
         detection->near_front_range < config->track_hard_priority_range - 0.04)));
}
