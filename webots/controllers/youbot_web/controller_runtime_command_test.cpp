#include "controller_runtime_command.h"

#include <cmath>
#include <stdio.h>
#include <string.h>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const char *path = "controller_runtime_command_test.tmp";
  const ControllerRuntimeCommandLimits limits = {
      -22.0, 22.0, -17.0, 17.0, 22.0, 17.0,
  };
  FILE *file = fopen(path, "w");
  if (!file) return 1;
  fprintf(file, "id 42\n");
  fprintf(file, "type start_mapping_survey\n");
  fprintf(file, "clear_map 0\n");
  fprintf(file, "mode double_pass\n");
  fprintf(file, "survey_speed_mps 0.31\n");
  fprintf(file, "field_min_x 50\nfield_max_x -50\n");
  fprintf(file, "field_min_y 25\nfield_max_y -25\n");
  fclose(file);

  RuntimeCommand command = {0};
  if (!controller_runtime_command_load_file(path, &limits, &command)) return 2;
  remove(path);
  if (command.id != 42 || !command.has_start_mapping_survey) return 3;
  if (command.clear_map != 0) return 4;
  if (command.survey_mode != MAPPING_SURVEY_MODE_DOUBLE) return 5;
  if (!nearly_equal(command.survey_speed_mps, 0.31)) return 6;
  if (!command.has_field_bounds) return 7;
  if (!nearly_equal(command.field_min_x, -22.0) || !nearly_equal(command.field_max_x, 22.0)) return 8;
  if (!nearly_equal(command.field_min_y, -17.0) || !nearly_equal(command.field_max_y, 17.0)) return 9;

  file = fopen(path, "w");
  if (!file) return 10;
  fprintf(file, "id 43\ntype spawn_obstacle\nx 1.5\ny -2.5\n");
  fclose(file);
  if (!controller_runtime_command_load_file(path, &limits, &command)) return 11;
  remove(path);
  if (!command.has_spawn_obstacle || command.has_start_mapping_survey) return 12;
  if (!nearly_equal(command.size_x, 0.8) || !nearly_equal(command.size_y, 0.8)) return 13;
  if (!nearly_equal(command.height, 0.6)) return 14;

  file = fopen(path, "w");
  if (!file) return 15;
  fprintf(file, "id 44\ntype transfer_object\nmission_id transfer-1\n");
  fprintf(file, "object_id demo-box\ndestination_x 4.5\ndestination_y -2.25\n");
  fprintf(file, "scene_revision revision-7\n");
  fclose(file);
  if (!controller_runtime_command_load_file(path, &limits, &command)) return 16;
  remove(path);
  if (!command.has_transfer_object || strcmp(command.object_id, "demo-box") != 0) return 17;
  if (!nearly_equal(command.destination_x, 4.5) ||
      !nearly_equal(command.destination_y, -2.25)) return 18;
  if (strcmp(command.scene_revision, "revision-7") != 0) return 19;

  file = fopen(path, "w");
  if (!file) return 20;
  fprintf(file, "id 45\ntype update_obstacle\nobstacle_id 43\nx 2\ny 3\nsize_x 1.2\nsize_y 0.7\nheight 0.8\n");
  fprintf(file, "id 46\ntype delete_obstacle\nobstacle_id 43\n");
  fclose(file);
  if (!controller_runtime_command_load_next_file(path, &limits, 44, &command)) return 21;
  if (!command.has_update_obstacle || command.has_spawn_obstacle || command.obstacle_id != 43 || command.id != 45) return 22;
  if (!nearly_equal(command.size_x, 1.2) || !nearly_equal(command.x, 2.0)) return 23;
  if (!controller_runtime_command_load_next_file(path, &limits, 45, &command)) return 24;
  if (!command.has_delete_obstacle || command.has_update_obstacle || command.obstacle_id != 43) return 25;
  remove(path);
  file = fopen(path, "w");
  if (!file) return 26;
  fprintf(file, "id 47\ntype delete_obstacle\nobstacle_id -1\n");
  fclose(file);
  if (controller_runtime_command_load_file(path, &limits, &command)) return 27;
  remove(path);
  return 0;
}
