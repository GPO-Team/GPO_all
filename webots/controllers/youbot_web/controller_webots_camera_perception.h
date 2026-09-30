#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_CAMERA_PERCEPTION_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_CAMERA_PERCEPTION_H

typedef struct {
  int visible;
  int detection_count;
  double score;
  double center_offset;
  double angle;
  double fallback_range_m;
  int confidence_boost;
} ControllerWebotsCameraPerception;

/* Colour is only a hypothesis; range must come from an independent sensor. */
int controller_webots_camera_perception_confirm_range(
    ControllerWebotsCameraPerception *perception, double measured_range);

int controller_webots_camera_perception_analyze(
    const unsigned char *image,
    int width,
    int height,
    double effective_fov,
    double min_obstacle_score,
    ControllerWebotsCameraPerception *perception);

#endif
