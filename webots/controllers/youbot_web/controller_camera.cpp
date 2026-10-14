#include "controller_camera.h"

#include <cmath>
#include <stddef.h>

static double clamp_value(double value, double min_value, double max_value) {
  if (value < min_value) return min_value;
  if (value > max_value) return max_value;
  return value;
}

ControllerCameraAnalysisConfig controller_camera_default_config(int width, int height) {
  return ControllerCameraAnalysisConfig{
      width,
      height,
      0.14,
      0.86,
      0.18,
      0.82,
      4,
      0.025,
  };
}

void controller_camera_observation_reset(ControllerCameraObservation *observation) {
  if (!observation) return;
  *observation = ControllerCameraObservation{
      .min_hit_x = -1,
      .max_hit_x = -1,
      .min_hit_y = -1,
      .max_hit_y = -1,
  };
}

void controller_camera_analyze(
    const ControllerCameraAnalysisConfig *config,
    ControllerCameraPixelReader read_pixel,
    void *pixel_context,
    ControllerCameraObservation *observation) {
  if (!observation) return;
  controller_camera_observation_reset(observation);
  if (!config || !read_pixel || config->width <= 0 || config->height <= 0 ||
      config->sample_step <= 0 || config->crop_x_min < 0.0 ||
      config->crop_x_max > 1.0 || config->crop_x_min >= config->crop_x_max ||
      config->crop_y_min < 0.0 || config->crop_y_max > 1.0 ||
      config->crop_y_min >= config->crop_y_max) {
    return;
  }

  const int x0 = (int)(config->width * config->crop_x_min);
  const int x1 = (int)(config->width * config->crop_x_max);
  const int y0 = (int)(config->height * config->crop_y_min);
  const int y1 = (int)(config->height * config->crop_y_max);
  const double center_x = config->width * 0.5;
  const double half_width = fmax(config->width * 0.5, 1.0);
  double weighted_offset_sum = 0.0;
  double weighted_y_sum = 0.0;
  double weight_sum = 0.0;

  for (int y = y0; y < y1; y += config->sample_step) {
    const double y_weight =
        0.65 + 0.70 * ((double)(y - y0) / fmax((double)(y1 - y0), 1.0));
    for (int x = x0; x < x1; x += config->sample_step) {
      const ControllerCameraPixel pixel = read_pixel(pixel_context, x, y);
      const int max_channel = pixel.red > pixel.green
                                  ? (pixel.red > pixel.blue ? pixel.red : pixel.blue)
                                  : (pixel.green > pixel.blue ? pixel.green : pixel.blue);
      const int min_channel = pixel.red < pixel.green
                                  ? (pixel.red < pixel.blue ? pixel.red : pixel.blue)
                                  : (pixel.green < pixel.blue ? pixel.green : pixel.blue);
      const int saturation = max_channel - min_channel;
      const int warm_obstacle_pixel =
          pixel.red > 105 && pixel.red > pixel.green + 34 && pixel.red > pixel.blue + 30 &&
          saturation > 44 && pixel.green < (int)(pixel.red * 0.70) &&
          pixel.blue < (int)(pixel.red * 0.68);
      observation->samples += 1;
      if (!warm_obstacle_pixel) continue;

      observation->hits += 1;
      weighted_offset_sum += ((double)x - center_x) / half_width * y_weight;
      weighted_y_sum += (double)y * y_weight;
      weight_sum += y_weight;
      if (observation->min_hit_x < 0 || x < observation->min_hit_x) observation->min_hit_x = x;
      if (observation->max_hit_x < 0 || x > observation->max_hit_x) observation->max_hit_x = x;
      if (observation->min_hit_y < 0 || y < observation->min_hit_y) observation->min_hit_y = y;
      if (observation->max_hit_y < 0 || y > observation->max_hit_y) observation->max_hit_y = y;
    }
  }

  if (observation->samples <= 0 || weight_sum <= 1e-9) return;

  observation->score = (double)observation->hits / (double)observation->samples;
  if (observation->score < config->min_obstacle_score) return;

  const double centroid_y = weighted_y_sum / weight_sum;
  const double vertical_depth =
      clamp_value(((double)y1 - centroid_y) / fmax((double)(y1 - y0), 1.0), 0.0, 1.0);
  const double bottom_depth = clamp_value(
      ((double)y1 - (double)observation->max_hit_y) / fmax((double)(y1 - y0), 1.0),
      0.0,
      1.0);
  observation->visible = 1;
  observation->center_offset = clamp_value(weighted_offset_sum / weight_sum, -1.0, 1.0);
  observation->fallback_range_m =
      clamp_value(0.48 + vertical_depth * 1.25 + bottom_depth * 0.55, 0.42, 2.25);
}

ControllerCameraObstacleHint controller_camera_observation_hint(
    const ControllerCameraObservation *observation,
    double effective_fov) {
  ControllerCameraObstacleHint hint = {0};
  if (!observation) return hint;

  hint.score = observation->score;
  if (!observation->visible) return hint;

  hint.visible = 1;
  hint.center_offset = observation->center_offset;
  hint.angle = hint.center_offset * fmax(effective_fov, 0.8) * 0.5;
  hint.confidence_boost =
      2 + (int)(hint.score * 14.0) +
      (observation->max_hit_x - observation->min_hit_x > 18 ? 2 : 0);
  return hint;
}

