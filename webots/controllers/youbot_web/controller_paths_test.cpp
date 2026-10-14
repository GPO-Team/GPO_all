#include "controller_paths.h"

#include <string.h>

int main(void) {
  ControllerPaths paths = {0};
  if (!controller_paths_init(&paths, NULL)) return 1;
  if (strcmp(paths.route, "../../../web_state/route.csv") != 0) return 2;
  if (strcmp(paths.robot_state, "../../../web_state/robot_state.json") != 0) return 3;

  if (!controller_paths_init(&paths, "/state/")) return 4;
  if (strcmp(paths.route, "/state/route.csv") != 0) return 5;
  if (strcmp(paths.camera_frame_bmp_temp, "/state/camera_frame.tmp.bmp") != 0) return 6;

  char oversized[CONTROLLER_PATH_CAPACITY + 1];
  memset(oversized, 'x', sizeof(oversized) - 1);
  oversized[sizeof(oversized) - 1] = '\0';
  if (controller_paths_init(&paths, oversized)) return 7;

  return 0;
}
