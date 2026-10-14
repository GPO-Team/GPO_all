#include "controller_runtime_command.h"

#include "controller_math.h"

#include <cmath>
#include <stdio.h>
#include <string.h>

#define CONTROLLER_RUNTIME_EPS 1e-9

int controller_runtime_command_load_next_file(
    const char *path,
    const ControllerRuntimeCommandLimits *limits,
    long long after_id,
    RuntimeCommand *command) {
  if (!path || !limits || !command) return 0;
  *command = RuntimeCommand{.id = -1};
  FILE *file = fopen(path, "r");
  if (!file) return 0;

  RuntimeCommand parsed = {};
  parsed.id = -1;
  parsed.clear_map = 1;
  parsed.survey_mode = MAPPING_SURVEY_MODE_SNAKE;
  parsed.field_min_x = limits->default_min_x;
  parsed.field_max_x = limits->default_max_x;
  parsed.field_min_y = limits->default_min_y;
  parsed.field_max_y = limits->default_max_y;
  parsed.size_x = 0.8;
  parsed.size_y = 0.8;
  parsed.height = 0.6;

  char line[256];
  while (fgets(line, sizeof(line), file)) {
    long long id = 0;
    double numeric = 0.0;
    char token[64];

    if (sscanf(line, " id %lld", &id) == 1) {
      if (parsed.id > after_id) break;
      if (id <= after_id) continue;
      parsed.id = id;
    } else if (parsed.id <= after_id) {
      continue;
    } else if (sscanf(line, " type %63s", token) == 1) {
      parsed.has_spawn_obstacle = strcmp(token, "spawn_obstacle") == 0;
      parsed.has_start_mapping_survey = strcmp(token, "start_mapping_survey") == 0;
      parsed.has_cancel_mission = strcmp(token, "cancel_mission") == 0;
      parsed.has_pick_place = strcmp(token, "pick_place") == 0;
      parsed.has_transfer_object = strcmp(token, "transfer_object") == 0;
      parsed.has_recover_transfer = strcmp(token, "recover_transfer") == 0;
      parsed.has_resume_transfer = strcmp(token, "resume_transfer") == 0;
    } else if (sscanf(line, " object_id %31s", token) == 1) {
      strcpy(parsed.object_id, token);
    } else if (sscanf(line, " scene_revision %63s", token) == 1) {
      strcpy(parsed.scene_revision, token);
    } else if (sscanf(line, " destination_x %lf", &numeric) == 1) {
      parsed.destination_x = numeric;
    } else if (sscanf(line, " destination_y %lf", &numeric) == 1) {
      parsed.destination_y = numeric;
    } else if (sscanf(line, " object_def %63s", token) == 1) {
      strcpy(parsed.object_def, token);
    } else if (sscanf(line, " target_x %lf", &numeric) == 1) {
      parsed.target_x = numeric;
      parsed.target_fields |= 1;
    } else if (sscanf(line, " target_y %lf", &numeric) == 1) {
      parsed.target_y = numeric;
      parsed.target_fields |= 2;
    } else if (sscanf(line, " target_z %lf", &numeric) == 1) {
      parsed.target_z = numeric;
      parsed.target_fields |= 4;
    } else if (sscanf(line, " mission_id %63s", token) == 1) {
      strcpy(parsed.mission_id, token);
    } else if (sscanf(line, " clear_map %lf", &numeric) == 1) {
      parsed.clear_map = fabs(numeric) > CONTROLLER_RUNTIME_EPS;
    } else if (sscanf(line, " mode %63s", token) == 1) {
      parsed.survey_mode = controller_parse_mapping_survey_mode(token);
    } else if (sscanf(line, " survey_speed_mps %lf", &numeric) == 1) {
      parsed.survey_speed_mps = numeric;
    } else if (sscanf(line, " field_min_x %lf", &numeric) == 1) {
      parsed.field_min_x = numeric;
      parsed.has_field_bounds = 1;
    } else if (sscanf(line, " field_max_x %lf", &numeric) == 1) {
      parsed.field_max_x = numeric;
      parsed.has_field_bounds = 1;
    } else if (sscanf(line, " field_min_y %lf", &numeric) == 1) {
      parsed.field_min_y = numeric;
      parsed.has_field_bounds = 1;
    } else if (sscanf(line, " field_max_y %lf", &numeric) == 1) {
      parsed.field_max_y = numeric;
      parsed.has_field_bounds = 1;
    } else if (sscanf(line, " x %lf", &numeric) == 1) {
      parsed.x = numeric;
    } else if (sscanf(line, " y %lf", &numeric) == 1) {
      parsed.y = numeric;
    } else if (sscanf(line, " size_x %lf", &numeric) == 1) {
      parsed.size_x = numeric;
    } else if (sscanf(line, " size_y %lf", &numeric) == 1) {
      parsed.size_y = numeric;
    } else if (sscanf(line, " height %lf", &numeric) == 1) {
      parsed.height = numeric;
    }
  }
  fclose(file);

  if (parsed.has_field_bounds) {
    if (parsed.field_min_x > parsed.field_max_x) {
      const double tmp = parsed.field_min_x;
      parsed.field_min_x = parsed.field_max_x;
      parsed.field_max_x = tmp;
    }
    if (parsed.field_min_y > parsed.field_max_y) {
      const double tmp = parsed.field_min_y;
      parsed.field_min_y = parsed.field_max_y;
      parsed.field_max_y = tmp;
    }
    parsed.field_min_x = clamp_value(parsed.field_min_x, -limits->max_extent_x, limits->max_extent_x);
    parsed.field_max_x = clamp_value(parsed.field_max_x, -limits->max_extent_x, limits->max_extent_x);
    parsed.field_min_y = clamp_value(parsed.field_min_y, -limits->max_extent_y, limits->max_extent_y);
    parsed.field_max_y = clamp_value(parsed.field_max_y, -limits->max_extent_y, limits->max_extent_y);
    if (parsed.field_max_x - parsed.field_min_x < 1.0 ||
        parsed.field_max_y - parsed.field_min_y < 1.0) {
      parsed.has_field_bounds = 0;
    }
  }

  // Preserve a rejected record's id so the consumer can advance past it.
  *command = parsed;
  if (parsed.id < 0 ||
      (!parsed.has_spawn_obstacle && !parsed.has_start_mapping_survey && !parsed.has_cancel_mission && !parsed.has_pick_place && !parsed.has_transfer_object && !parsed.has_recover_transfer && !parsed.has_resume_transfer)) {
    return 0;
  }
  if (parsed.has_cancel_mission && !parsed.mission_id[0]) return 0;
  if (parsed.has_pick_place && (!parsed.mission_id[0] || !parsed.object_def[0] || parsed.target_fields != 7 ||
      !isfinite(parsed.target_x) || !isfinite(parsed.target_y) || !isfinite(parsed.target_z) ||
      parsed.target_z < 0.015 || parsed.target_z > 1.0)) return 0;
  if ((parsed.has_transfer_object || parsed.has_resume_transfer || parsed.has_recover_transfer) && !parsed.mission_id[0]) return 0;
  if (parsed.has_transfer_object && (!parsed.object_id[0] || !isfinite(parsed.destination_x) || !isfinite(parsed.destination_y))) return 0;
  *command = parsed;
  return 1;
}

int controller_runtime_command_load_file(const char *path,
    const ControllerRuntimeCommandLimits *limits, RuntimeCommand *command) {
  return controller_runtime_command_load_next_file(path, limits, -1, command);
}

long long controller_runtime_command_latest_id(const char *path) {
  FILE *file = path ? fopen(path, "r") : NULL;
  if (!file) return -1;
  char line[256];
  long long latest = -1, id;
  while (fgets(line, sizeof(line), file)) {
    if (sscanf(line, " id %lld", &id) == 1 && id > latest) latest = id;
  }
  fclose(file);
  return latest;
}
