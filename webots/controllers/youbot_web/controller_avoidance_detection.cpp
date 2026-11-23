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
  detection->rear_obstacle_detected =
      lidar_available && context->unexpected_rear_hit_count > 0;
  detection->rear_obstacle_range =
      detection->rear_obstacle_detected ? context->unexpected_rear_min_range : config->max_trace_range;
  detection->camera_front_range = config->max_trace_range;
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
      lidar_available && detection->expected_front_range < config->track_caution_range + 0.20;
  detection->expected_zone_wall_close =
      lidar_available && detection->expected_front_range < config->expected_wall_soft_stop_range + 0.15;
  detection->expected_zone_wall_slowdown =
      lidar_available && detection->expected_front_range < config->expected_wall_slowdown_range + 0.20;
  detection->center_passage_available =
      lidar_available && context->has_best_gap &&
      !camera_visual_front_obstacle &&
      detection->center_obstacle_range > config->pass_center_clear_range &&
      context->best_gap_range > config->pass_center_clear_range &&
      fabs(context->best_gap_beam_angle) < config->pass_gap_max_angle_rad &&
      detection->left_lidar_context > config->pass_side_danger_range + 0.10 &&
      detection->right_lidar_context > config->pass_side_danger_range + 0.10;

  detection->side_obstacle_detected =
      lidar_available && !detection->center_passage_available &&
      (detection->left_lidar_context < config->avoid_side_trigger_range + 0.08 ||
       detection->right_lidar_context < config->avoid_side_trigger_range + 0.08);

  detection->lidar_hard_priority_zone =
      lidar_available &&
      ((detection->center_passage_available ? detection->center_obstacle_range
                                            : detection->near_front_range) <
           config->track_hard_priority_range + 0.08 ||
       (!detection->center_passage_available &&
        (detection->left_lidar_context < config->avoid_side_trigger_range + 0.12 ||
         detection->right_lidar_context < config->avoid_side_trigger_range + 0.12)));

  detection->front_corner_obstacle_detected =
      lidar_available && !detection->center_passage_available &&
      (detection->left_front_corner_range < config->avoid_trigger_range + 0.08 ||
       detection->right_front_corner_range < config->avoid_trigger_range + 0.08);

  detection->obstacle_context_present =
      (lidar_available &&
       (detection->near_front_range < config->avoid_recover_range + 0.10 ||
        detection->left_lidar_context < config->reflex_side_release_range + 0.15 ||
        detection->right_lidar_context < config->reflex_side_release_range + 0.15)) ||
      camera_visual_front_obstacle;

  const int camera_close_blockage =
      camera_visual_front_obstacle &&
      (!lidar_available ||
       !detection->center_passage_available);

  const int front_close_blockage =
      (detection->front_obstacle_detected &&
       detection->near_front_range < config->avoid_trigger_range + 0.10) ||
      detection->center_obstacle_range < config->avoid_stop_range + 0.18;

  const int side_pinched_blockage =
      detection->side_obstacle_detected &&
      !detection->center_passage_available &&
      detection->near_front_range < config->avoid_trigger_range + 0.05;

  detection->should_start_avoidance =
      camera_close_blockage ||
      (lidar_available &&
       (front_close_blockage ||
        detection->front_corner_obstacle_detected ||
        side_pinched_blockage));
}