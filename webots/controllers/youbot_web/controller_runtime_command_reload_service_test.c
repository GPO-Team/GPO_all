#include "controller_runtime_command_reload_service.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

static int spawn_calls;
static long long last_spawn_id;
static char status[64];

static void spawn_obstacle(const RuntimeCommand *command) {
  ++spawn_calls;
  last_spawn_id = command->id;
}

static void set_status(const char *value) {
  strcpy(status, value);
}

static void clear_error(void) {}
static int generation_succeeds = 1;
static void apply_speed(double speed) { (void)speed; }
static int generate_survey(const char *path, int clear_map, const RuntimeCommand *command) {
  (void)path; (void)clear_map;
  assert(command->mission_id[0]);
  return generation_succeeds;
}
static int load_survey(RouteData *route) { route->count = 3; return 1; }

int main(void) {
  const char *path = "controller_runtime_command_reload_service_test.txt";
  FILE *file = fopen(path, "w");
  assert(file);
  fputs("id 7\ntype spawn_obstacle\nx 1\ny 2\n", file);
  fclose(file);

  ControllerRuntime runtime;
  controller_runtime_init(&runtime);
  const ControllerSurveyIntegrationOps ops = {
      .clear_error = clear_error,
      .set_status = set_status,
      .apply_speed = apply_speed,
      .generate = generate_survey,
      .load_route = load_survey,
      .reset_avoidance = clear_error,
      .reset_navigation = clear_error,
  };
  ControllerRuntimeCommandReloadService service;
  controller_runtime_command_reload_service_init(
      &service,
      path,
      "route.csv",
      (ControllerRuntimeCommandLimits){-22.0, 22.0, -17.0, 17.0, 22.0, 17.0},
      &runtime,
      &ops,
      spawn_obstacle);

  assert(controller_runtime_command_reload_service_run(&service, 1, 6) ==
         CONTROLLER_RUNTIME_COMMAND_RELOAD_NOT_DUE);
  assert(controller_runtime_command_reload_service_run(&service, 6, 6) ==
         CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(spawn_calls == 1);
  assert(last_spawn_id == 7);
  assert(strcmp(status, "runtime_obstacle_spawned") == 0);
  assert(controller_runtime_command_reload_service_run(&service, 12, 6) ==
         CONTROLLER_RUNTIME_COMMAND_RELOAD_UNCHANGED);
  assert(spawn_calls == 1);
  file = fopen(path, "a");
  assert(file);
  fputs("id 8\ntype spawn_obstacle\nx 3\ny 4\nid 9\ntype spawn_obstacle\nx 5\ny 6\n", file);
  fclose(file);
  assert(controller_runtime_command_reload_service_run(&service, 18, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(last_spawn_id == 8);
  assert(controller_runtime_command_reload_service_run(&service, 24, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(last_spawn_id == 9);
  assert(spawn_calls == 3);
  strcpy(runtime.route.command_id, "mission-cancel");
  runtime.route.count = 2;
  runtime.route_finished = 0;
  file = fopen(path, "a");
  assert(file);
  fputs("id 10\ntype cancel_mission\nmission_id mission-cancel\n", file);
  fclose(file);
  assert(controller_runtime_command_reload_service_run(&service, 30, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(runtime.route_finished == 1);
  assert(strcmp(runtime.cancelled_mission_id, "mission-cancel") == 0);
  assert(strcmp(status, "mission_cancelled") == 0);
  assert(spawn_calls == 3);
  file = fopen(path, "a");
  assert(file);
  fputs("id 11\ntype start_mapping_survey\nmission_id survey-1\n"
        "id 12\ntype cancel_mission\nmission_id survey-1\n"
        "id 13\ntype start_mapping_survey\nmission_id survey-1\n"
        "id 14\ntype start_mapping_survey\nmission_id survey-failed\n"
        "id 15\ntype start_mapping_survey\n", file);
  fclose(file);
  assert(controller_runtime_command_reload_service_run(&service, 36, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(strcmp(runtime.route.command_id, "survey-1") == 0);
  assert(runtime.mapping_survey.route_active && !runtime.route_finished);
  assert(strcmp(status, "mapping_survey_started") == 0);
  assert(controller_runtime_command_reload_service_run(&service, 42, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(runtime.route_finished && !runtime.mapping_survey.route_active);
  assert(strcmp(status, "mission_cancelled") == 0);
  assert(controller_runtime_command_reload_service_run(&service, 48, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_DUPLICATE);
  assert(runtime.route_finished);
  generation_succeeds = 0;
  assert(controller_runtime_command_reload_service_run(&service, 54, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(strcmp(runtime.route.command_id, "survey-failed") == 0);
  assert(strcmp(runtime.failed_mission_id, "survey-failed") == 0);
  assert(strcmp(status, "route_failed") == 0);
  assert(runtime.route_finished && !runtime.mapping_survey.route_active && runtime.route.count == 0);
  assert(controller_runtime_command_reload_service_run(&service, 60, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_INVALID);
  remove(path);
  return 0;
}
