#include "controller_paths.h"

#include <stddef.h>
#include <stdio.h>
#include <string.h>

static int join_path(char *output, size_t capacity, const char *directory, const char *filename) {
  size_t directory_length = strlen(directory);
  while (directory_length > 0 &&
         (directory[directory_length - 1] == '/' || directory[directory_length - 1] == '\\')) {
    directory_length -= 1;
  }
  if (directory_length == 0) return 0;

  const int written = snprintf(
      output, capacity, "%.*s/%s", (int)directory_length, directory, filename);
  return written >= 0 && (size_t)written < capacity;
}

int controller_paths_init(ControllerPaths *paths, const char *state_dir) {
  if (!paths) return 0;
  const char *directory = state_dir && state_dir[0] ? state_dir : "../../../web_state";

#define SET_PATH(field, filename) \
  if (!join_path(paths->field, sizeof(paths->field), directory, filename)) return 0

  SET_PATH(route, "route.csv");
  SET_PATH(limit_zones, "limit_zones.txt");
  SET_PATH(surface_zones, "surface_zones.txt");
  SET_PATH(robot_state, "robot_state.json");
  SET_PATH(robot_state_temp, "robot_state.tmp");
  SET_PATH(motion_profile, "motion_profile.txt");
  SET_PATH(runtime_command, "runtime_command.txt");
  SET_PATH(obstacle_map, "obstacle_map.json");
  SET_PATH(obstacle_map_temp, "obstacle_map.tmp");
  SET_PATH(obstacle_map_csv, "obstacle_map.csv");
  SET_PATH(obstacle_map_csv_temp, "obstacle_map_csv.tmp");
  SET_PATH(camera_map, "camera_map.json");
  SET_PATH(camera_map_temp, "camera_map.tmp");
  SET_PATH(camera_map_csv, "camera_map.csv");
  SET_PATH(camera_map_csv_temp, "camera_map_csv.tmp");
  SET_PATH(camera_frame_bmp, "camera_frame.bmp");
  SET_PATH(camera_frame_bmp_temp, "camera_frame.tmp.bmp");
  SET_PATH(camera_frame_jpeg, "camera_frame.jpg");
  SET_PATH(camera_frame_jpeg_temp, "camera_frame.tmp.jpg");

#undef SET_PATH
  return 1;
}
