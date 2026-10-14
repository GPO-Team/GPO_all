#include "controller_lidar_math.h"

#include "controller_math.h"

#include <cmath>
#include <string.h>

#define CONTROLLER_LIDAR_EPS 1e-9

double controller_lidar_range_pressure(
    double range,
    double clear_range,
    double blocked_range) {
  if (clear_range <= blocked_range + CONTROLLER_LIDAR_EPS) {
    return range <= blocked_range ? 1.0 : 0.0;
  }
  return clamp_value(
      (clear_range - range) / (clear_range - blocked_range),
      0.0,
      1.0);
}

int controller_lidar_hit_is_consistent(
    const float *ranges,
    int resolution,
    int index,
    double range,
    double effective_max_range,
    int sample_stride,
    double min_trace_range,
    double range_jump_tolerance) {
  int valid_neighbors = 0;
  int neighbor_support = 0;
  const int left = index - sample_stride;
  const int right = index + sample_stride;

  if (left >= 0) {
    const double left_range = (double)ranges[left];
    if (std::isfinite(left_range) && left_range >= min_trace_range &&
        left_range <= effective_max_range) {
      valid_neighbors += 1;
      if (fabs(left_range - range) <= range_jump_tolerance) neighbor_support += 1;
    }
  }

  if (right < resolution) {
    const double right_range = (double)ranges[right];
    if (std::isfinite(right_range) && right_range >= min_trace_range &&
        right_range <= effective_max_range) {
      valid_neighbors += 1;
      if (fabs(right_range - range) <= range_jump_tolerance) neighbor_support += 1;
    }
  }

  if (valid_neighbors == 0) return 1;
  return neighbor_support > 0;
}

double controller_lidar_trace_confidence(
    const ObstacleTracePoint *point,
    double now_time,
    double ttl_seconds) {
  if (!point) return 0.0;
  const double age = fmax(0.0, now_time - point->last_seen_time);
  const double freshness = clamp_value(1.0 - age / ttl_seconds, 0.0, 1.0);
  const double support = clamp_value((double)point->hit_count / 4.0, 0.0, 1.0);
  return support * freshness;
}

void controller_lidar_context_init(
    LidarObstacleContext *context,
    double effective_max_range) {
  if (!context) return;
  memset(context, 0, sizeof(*context));
  context->expected_front_min_range = effective_max_range;
  context->unexpected_front_min_range = effective_max_range;
  context->unexpected_center_min_range = effective_max_range;
  context->unexpected_left_front_min_range = effective_max_range;
  context->unexpected_right_front_min_range = effective_max_range;
  context->unexpected_left_min_range = effective_max_range;
  context->unexpected_right_min_range = effective_max_range;
  context->best_gap_score = -1e9;
  context->closest_unexpected_range = effective_max_range;
}

static void controller_lidar_context_consider_gap(
    LidarObstacleContext *context,
    const ControllerLidarContextConfig *config,
    double sensed_range,
    double beam_angle,
    double target_beam_angle,
    double preferred_turn_sign,
    int obstacle_hit) {
  if (sensed_range < config->gap_min_range) return;

  const double target_alignment =
      1.0 - clamp_value(fabs(wrap_angle(beam_angle - target_beam_angle)) / 1.25, 0.0, 1.0);
  const double gap_side_sign = beam_angle < 0.0 ? 1.0 : -1.0;
  const double commitment_bonus =
      preferred_turn_sign == 0.0
          ? 0.0
          : (gap_side_sign == preferred_turn_sign
                 ? (obstacle_hit ? 0.16 : 0.18)
                 : (obstacle_hit ? -0.10 : -0.08));
  const double frontal_bonus = 1.0 - clamp_value(fabs(beam_angle) / 1.35, 0.0, 1.0);
  const double range_score =
      clamp_value(
          (sensed_range - config->gap_min_range) /
              fmax(config->effective_max_range - config->gap_min_range, 0.1),
          0.0,
          1.0);
  const double gap_score =
      range_score * (obstacle_hit ? 0.72 : 0.78) +
      target_alignment * (obstacle_hit ? 0.18 : 0.16) +
      frontal_bonus * 0.08 + commitment_bonus;

  if (!context->has_best_gap ||
      gap_score > context->best_gap_score + 1e-6 ||
      (fabs(gap_score - context->best_gap_score) <= 1e-6 &&
       sensed_range > context->best_gap_range)) {
    context->best_gap_beam_angle = beam_angle;
    context->best_gap_range = sensed_range;
    context->best_gap_score = gap_score;
    context->has_best_gap = 1;
  }
}

void controller_lidar_context_observe(
    LidarObstacleContext *context,
    const ControllerLidarContextConfig *config,
    double sensed_range,
    double beam_angle,
    int obstacle_hit,
    int expected_zone_wall,
    double target_beam_angle,
    double preferred_turn_sign) {
  if (!context || !config) return;

  const double pressure = controller_lidar_range_pressure(
      sensed_range, config->track_caution_range, config->avoid_stop_range);
  const double center_weight =
      exp(-(beam_angle * beam_angle) / (2.0 * config->sigma * config->sigma));

  if (expected_zone_wall) {
    if (fabs(beam_angle) <= config->front_sector_rad + 0.16) {
      if (sensed_range < context->expected_front_min_range) {
        context->expected_front_min_range = sensed_range;
      }
      context->expected_front_score += pressure * center_weight;
    }
    return;
  }

  if (!obstacle_hit) {
    controller_lidar_context_consider_gap(
        context,
        config,
        sensed_range,
        beam_angle,
        target_beam_angle,
        preferred_turn_sign,
        0);
    return;
  }

  if (sensed_range < context->closest_unexpected_range) {
    context->closest_unexpected_range = sensed_range;
    context->closest_unexpected_beam_angle = beam_angle;
    context->has_closest_unexpected = 1;
  }

  if (fabs(beam_angle) <= config->front_sector_rad + 0.16) {
    context->unexpected_front_hit_count += 1;
    if (sensed_range < context->unexpected_front_min_range) {
      context->unexpected_front_min_range = sensed_range;
    }
    context->unexpected_front_score += pressure * center_weight;

    if (fabs(beam_angle) <= config->center_sector_rad &&
        sensed_range < context->unexpected_center_min_range) {
      context->unexpected_center_min_range = sensed_range;
    }
    if (beam_angle <= -config->front_corner_min_rad &&
        beam_angle >= -config->front_corner_max_rad &&
        sensed_range < context->unexpected_left_front_min_range) {
      context->unexpected_left_front_min_range = sensed_range;
    }
    if (beam_angle >= config->front_corner_min_rad &&
        beam_angle <= config->front_corner_max_rad &&
        sensed_range < context->unexpected_right_front_min_range) {
      context->unexpected_right_front_min_range = sensed_range;
    }
  } else if (beam_angle < 0.0) {
    if (sensed_range < context->unexpected_left_min_range) {
      context->unexpected_left_min_range = sensed_range;
    }
  } else if (sensed_range < context->unexpected_right_min_range) {
    context->unexpected_right_min_range = sensed_range;
  }

  if (beam_angle < 0.0) {
    context->unexpected_left_score += pressure * (0.40 + center_weight * 0.60);
  } else {
    context->unexpected_right_score += pressure * (0.40 + center_weight * 0.60);
  }

  controller_lidar_context_consider_gap(
      context,
      config,
      sensed_range,
      beam_angle,
      target_beam_angle,
      preferred_turn_sign,
      1);
}
