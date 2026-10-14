#include "controller_runtime_command.h"

#include <math.h>
#include <stdio.h>

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
  fprintf(file, "id 44\ntype pick_place\nmission_id arm-1\nobject_def PICK_BOX\ntarget_x 0.4\ntarget_y 0.1\ntarget_z 0.04\n");
  fclose(file);
  if (!controller_runtime_command_load_file(path, &limits, &command)) return 16;
  if (!command.has_pick_place || command.target_fields != 7 || !nearly_equal(command.target_z, 0.04)) return 17;
  file = fopen(path, "w");
  if (!file) return 18;
  fprintf(file, "id 45\ntype pick_place\nmission_id arm-2\nobject_def PICK_BOX\ntarget_x nan\ntarget_y 0\ntarget_z 0.04\n");
  fclose(file);
  if (controller_runtime_command_load_file(path, &limits, &command)) return 19;
  remove(path);
  return 0;
}
