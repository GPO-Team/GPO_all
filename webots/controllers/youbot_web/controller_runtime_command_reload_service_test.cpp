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
static int motion_blocked = 1;
static int is_motion_blocked(void) { return motion_blocked; }
static int pick_calls;
static void start_pick_place(const RuntimeCommand *command) { (void)command; ++pick_calls; }
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
  ControllerSurveyIntegrationOps ops = {};
  ops.clear_error=clear_error;
  ops.set_status=set_status;
  ops.apply_speed=apply_speed;
  ops.generate=generate_survey;
  ops.load_route=load_survey;
  ops.reset_avoidance=clear_error;
  ops.reset_navigation=clear_error;
  ControllerRuntimeCommandReloadService service;
  controller_runtime_command_reload_service_init(
      &service,
      path,
      "route.csv",
      ControllerRuntimeCommandLimits{-22.0, 22.0, -17.0, 17.0, 22.0, 17.0},
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
  file = fopen(path, "a");
  assert(file);
  fputs("id 16\ntype pick_place\nmission_id malformed-arm\nobject_def PICK_BOX\ntarget_x nan\ntarget_y 0\ntarget_z 0.04\n"
        "id 17\ntype cancel_mission\nmission_id survey-failed\n", file);
  fclose(file);
  assert(controller_runtime_command_reload_service_run(&service, 66, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_INVALID);
  assert(controller_runtime_command_reload_service_run(&service, 72, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(strcmp(runtime.cancelled_mission_id, "survey-failed") == 0);
  strcpy(runtime.route.command_id, "arm-active");
  runtime.route_finished = 0;
  file = fopen(path, "a");
  assert(file);
  fputs("id 18\ntype start_mapping_survey\nmission_id foreign-survey\n"
        "id 19\ntype pick_place\nmission_id foreign-arm\nobject_def PICK_BOX\ntarget_x 0.4\ntarget_y 0.1\ntarget_z 0.04\n"
        "id 20\ntype cancel_mission\nmission_id arm-active\n", file);
  fclose(file);
  generation_succeeds = 1;
  service.motion_blocked = is_motion_blocked;
  service.start_pick_place = start_pick_place;
  assert(controller_runtime_command_reload_service_run(&service, 78, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_INVALID);
  assert(strcmp(runtime.route.command_id, "arm-active") == 0);
  assert(!runtime.route_finished && !runtime.mapping_survey.route_active);
  assert(controller_runtime_command_reload_service_run(&service, 84, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_INVALID);
  assert(pick_calls == 0 && strcmp(runtime.route.command_id, "arm-active") == 0);
  assert(controller_runtime_command_reload_service_run(&service, 90, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(runtime.route_finished && strcmp(status, "mission_cancelled") == 0);
  motion_blocked = 0;
  assert(controller_runtime_command_reload_service_run(&service, 96, 6) == CONTROLLER_RUNTIME_COMMAND_RELOAD_UNCHANGED);
  assert(pick_calls == 0 && strcmp(runtime.route.command_id, "arm-active") == 0);
  file = fopen(path, "a");
  assert(file);
  fputs("id 21\ntype transfer_object\nmission_id foreign-transfer\nobject_id demo-box\ndestination_x 2\ndestination_y 1\n"
        "id 22\ntype resume_transfer\nmission_id arm-active\n",file);
  fclose(file);
  motion_blocked=1;
  service.transfer_command=start_pick_place;
  assert(controller_runtime_command_reload_service_run(&service,102,6)==CONTROLLER_RUNTIME_COMMAND_RELOAD_INVALID);
  assert(pick_calls==0);
  assert(controller_runtime_command_reload_service_run(&service,108,6)==CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED);
  assert(pick_calls==1);
  remove(path);
  return 0;
}
