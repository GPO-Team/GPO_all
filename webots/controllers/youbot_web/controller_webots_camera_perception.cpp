#include "controller_webots_camera_perception.h"

#include "controller_camera.h"
#include "controller_webots_sensors.h"
#include <cmath>
using std::isfinite;

int controller_webots_camera_perception_confirm_range(
    ControllerWebotsCameraPerception *perception, double measured_range) {
  if (!perception) return 0;
  perception->visible = perception->visible && isfinite(measured_range) && measured_range > 0.0;
  return perception->visible;
}

typedef struct {
  const unsigned char *image;
  int width;
} WebotsCameraPixelContext;

static ControllerCameraPixel read_webots_camera_pixel(void *context, int x, int y) {
  const WebotsCameraPixelContext *pixel_context = static_cast<const WebotsCameraPixelContext *>(context);
  ControllerCameraPixel pixel = {0};
  controller_webots_sensors_camera_pixel(
      pixel_context->image, pixel_context->width, x, y,
      &pixel.red, &pixel.green, &pixel.blue);
  return pixel;
}

int controller_webots_camera_perception_analyze(
    const unsigned char *image,
    int width,
    int height,
    double effective_fov,
    double min_obstacle_score,
    ControllerWebotsCameraPerception *perception) {
  if (!perception) return 0;
  *perception = ControllerWebotsCameraPerception{0};
  if (!image || width <= 0 || height <= 0) return 0;
  ControllerCameraAnalysisConfig config = controller_camera_default_config(width, height);
  config.min_obstacle_score = min_obstacle_score;
  const WebotsCameraPixelContext context = {image, width};
  ControllerCameraObservation observation;
  controller_camera_analyze(&config, read_webots_camera_pixel, (void *)&context, &observation);
  const ControllerCameraObstacleHint hint =
      controller_camera_observation_hint(&observation, effective_fov);
  perception->visible = hint.visible;
  perception->detection_count = observation.hits;
  perception->score = hint.score;
  perception->center_offset = hint.center_offset;
  perception->angle = hint.angle;
  perception->fallback_range_m = observation.fallback_range_m;
  perception->confidence_boost = hint.confidence_boost;
  return hint.visible;
}
