#include "controller_camera.h"

#include <cmath>
#include <stddef.h>

#define TEST_WIDTH 100
#define TEST_HEIGHT 100
#define TEST_EPS 1e-9

typedef struct {
  ControllerCameraPixel pixels[TEST_WIDTH * TEST_HEIGHT];
} TestFrame;

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

static ControllerCameraPixel read_test_pixel(void *context, int x, int y) {
  const TestFrame *frame = (const TestFrame *)context;
  return frame->pixels[y * TEST_WIDTH + x];
}

static void fill_frame(TestFrame *frame, ControllerCameraPixel pixel) {
  for (int i = 0; i < TEST_WIDTH * TEST_HEIGHT; ++i) {
    frame->pixels[i] = pixel;
  }
}

static void set_warm_pixel(TestFrame *frame, int x, int y) {
  frame->pixels[y * TEST_WIDTH + x] = ControllerCameraPixel{180, 70, 60};
}

int main(void) {
  ControllerCameraAnalysisConfig config = controller_camera_default_config(TEST_WIDTH, TEST_HEIGHT);
  if (config.width != TEST_WIDTH || config.height != TEST_HEIGHT) return 1;
  if (!nearly_equal(config.crop_x_min, 0.14) || !nearly_equal(config.crop_x_max, 0.86) ||
      !nearly_equal(config.crop_y_min, 0.18) || !nearly_equal(config.crop_y_max, 0.82)) {
    return 2;
  }
  if (config.sample_step != 4 || !nearly_equal(config.min_obstacle_score, 0.025)) return 3;

  TestFrame frame;
  fill_frame(&frame, ControllerCameraPixel{80, 80, 80});

  ControllerCameraObservation observation;
  ControllerCameraAnalysisConfig invalid_config = controller_camera_default_config(0, TEST_HEIGHT);
  controller_camera_analyze(&invalid_config, read_test_pixel, &frame, &observation);
  if (observation.visible || observation.samples != 0 || observation.hits != 0 ||
      !nearly_equal(observation.score, 0.0) || observation.min_hit_x != -1 ||
      observation.max_hit_x != -1 || observation.min_hit_y != -1 ||
      observation.max_hit_y != -1) {
    return 4;
  }

  controller_camera_analyze(&config, read_test_pixel, &frame, &observation);
  if (observation.visible || observation.samples != 288 || observation.hits != 0 ||
      !nearly_equal(observation.score, 0.0)) {
    return 5;
  }

  for (int y = 50; y <= 58; y += 4) {
    for (int x = 26; x <= 38; x += 4) {
      set_warm_pixel(&frame, x, y);
    }
  }

  controller_camera_analyze(&config, read_test_pixel, &frame, &observation);
  if (!observation.visible || observation.samples != 288 || observation.hits != 12) return 6;
  if (!nearly_equal(observation.score, 12.0 / 288.0)) return 7;
  if (observation.min_hit_x != 26 || observation.max_hit_x != 38 ||
      observation.min_hit_y != 50 || observation.max_hit_y != 58) {
    return 8;
  }
  if (!(observation.center_offset < -0.30 && observation.center_offset > -0.40)) return 9;
  if (!(observation.fallback_range_m > 1.10 && observation.fallback_range_m < 1.30)) return 10;

  fill_frame(&frame, ControllerCameraPixel{80, 80, 80});
  set_warm_pixel(&frame, 50, 50);
  controller_camera_analyze(&config, read_test_pixel, &frame, &observation);
  if (observation.visible || observation.hits != 1 || observation.samples != 288) return 11;
  if (!nearly_equal(observation.score, 1.0 / 288.0)) return 12;
  if (observation.min_hit_x != 50 || observation.max_hit_x != 50 ||
      observation.min_hit_y != 50 || observation.max_hit_y != 50) {
    return 13;
  }

  const ControllerCameraMapGeometryConfig geometry_config = {
      0.24,
      0.0,
      0.12,
      3.0,
      0.36,
      0.22,
      0.18,
      0.25,
  };
  ControllerCameraMapPoint point;
  const ControllerCameraPose forward_pose = {1.0, 2.0, 0.0};
  if (!controller_camera_obstacle_point(
          &geometry_config, &forward_pose, 0.0, 1.0, &point)) {
    return 14;
  }
  if (!nearly_equal(point.x, 2.24) || !nearly_equal(point.y, 2.0)) return 15;

  const ControllerCameraPose rotated_pose = {1.0, 2.0, 1.5707963267948966};
  if (!controller_camera_obstacle_point(
          &geometry_config, &rotated_pose, 0.0, 1.0, &point)) {
    return 16;
  }
  if (!nearly_equal(point.x, 1.0) || !nearly_equal(point.y, 3.24)) return 17;
  if (controller_camera_obstacle_point(
          &geometry_config, &forward_pose, 0.0, 0.10, &point)) {
    return 18;
  }
  if (controller_camera_obstacle_point(
          &geometry_config, &forward_pose, 0.0, 3.10, &point)) {
    return 19;
  }

  ControllerCameraMapPoint free_points[8];
  const int free_count = controller_camera_free_ray_points(
      &geometry_config, &forward_pose, 0.0, 1.0, free_points, 8);
  if (free_count != 3) return 20;
  if (!nearly_equal(free_points[0].x, 1.60) || !nearly_equal(free_points[0].y, 2.0) ||
      !nearly_equal(free_points[1].x, 1.78) || !nearly_equal(free_points[2].x, 1.96)) {
    return 21;
  }
  if (controller_camera_free_ray_points(
          &geometry_config, &forward_pose, 0.0, 0.35, free_points, 8) != 0) {
    return 22;
  }
  if (controller_camera_free_ray_points(
          &geometry_config, &forward_pose, 0.0, 1.0, free_points, 2) != 2) {
    return 23;
  }

  const ControllerCameraObservation decision_observation = {
      .visible = 1,
      .score = 0.10,
      .center_offset = -0.5,
      .min_hit_x = 10,
      .max_hit_x = 31,
  };
  const ControllerCameraObstacleHint hint =
      controller_camera_observation_hint(&decision_observation, 1.2);
  if (!hint.visible || !nearly_equal(hint.angle, -0.3) || hint.confidence_boost != 5) {
    return 24;
  }

  const ControllerCameraObstacleHint empty_hint =
      controller_camera_observation_hint(NULL, 1.2);
  if (empty_hint.visible || !nearly_equal(empty_hint.score, 0.0) ||
      empty_hint.confidence_boost != 0) {
    return 25;
  }

  return 0;
}
