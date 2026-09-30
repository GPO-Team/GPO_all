#include "controller_survey_lifecycle.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

typedef struct {
  char calls[8];
  int count;
} StartContext;

static void record(StartContext *context, char value) {
  context->calls[context->count++] = value;
}

static void clear_error(void *context) { record(context, 'C'); }
static void apply_speed(void *context, double speed_mps) {
  assert(speed_mps == 0.4);
  record(context, 'S');
}
static int generate(void *context, const RuntimeCommand *command) {
  assert(command->clear_map == 1);
  record(context, 'G');
  return 1;
}
static int load(void *context, RouteData *route) {
  record(context, 'L');
  route->count = 3;
  return 1;
}
static void reset_avoidance(void *context) { record(context, 'A'); }
static void reset_navigation(void *context) { record(context, 'N'); }
static void mark_started(void *context) { record(context, 'T'); }
static void merge_map(void *context) { record(context, 'M'); }
static int generate_replan(void *context) {
  record(context, 'G');
  return 1;
}
static int find_escape(void *context, SurveyPoint robot, int start_index) {
  assert(robot.x == 2.0 && robot.y == 3.0 && start_index == 0);
  record(context, 'E');
  return 2;
}
static void mark_replanned(void *context) { record(context, 'T'); }
static int find_orbit_escape(void *context, SurveyPoint robot, int start_index) {
  (void)robot;
  record(context, 'E');
  return start_index == 5 ? -1 : 8;
}
static void clear_navigation(void *context) { record(context, 'C'); }
static void begin_navigation(void *context, int waypoint_index, SurveyPoint robot) {
  (void)robot;
  assert(waypoint_index == 8);
  record(context, 'B');
}
static void update_distance(void *context, int waypoint_index, SurveyPoint robot) {
  (void)robot;
  assert(waypoint_index == 8);
  record(context, 'D');
}
static void mark_skipped(void *context) { record(context, 'T'); }
static int fallback_replan(void *context) {
  record(context, 'R');
  return 1;
}

int main(void) {
  RouteData active = {0};
  RouteData loaded = {0};
  loaded.count = 2;
  loaded.last_modified = 123;
  loaded.waypoints[0].x = 1.0;
  loaded.waypoints[1].x = 2.0;
  int waypoint_index = 7;
  int route_finished = 1;
  ControllerMappingSurveyState state;
  controller_mapping_survey_state_init(&state);

  controller_survey_lifecycle_accept_route(
      &active,
      &loaded,
      &waypoint_index,
      &route_finished,
      &state,
      1,
      MAPPING_SURVEY_MODE_DOUBLE);
  assert(active.count == 2 && active.last_modified == 123);
  assert(waypoint_index == 0 && route_finished == 0);
  assert(state.route_active && state.mode == MAPPING_SURVEY_MODE_DOUBLE);

  waypoint_index = 4;
  route_finished = 1;
  state.room_zone_index = 3;
  controller_survey_lifecycle_accept_route(
      &active,
      &loaded,
      &waypoint_index,
      &route_finished,
      &state,
      0,
      MAPPING_SURVEY_MODE_SNAKE);
  assert(waypoint_index == 0 && route_finished == 0);
  assert(!state.route_active && state.room_zone_index == -1);

  const ControllerSurveyStartCallbacks callbacks = {
      clear_error,
      apply_speed,
      generate,
      load,
      reset_avoidance,
      reset_navigation,
      mark_started,
  };
  const RuntimeCommand command = {
      .mission_id = "survey-1",
      .clear_map = 1,
      .survey_mode = MAPPING_SURVEY_MODE_DOUBLE,
      .survey_speed_mps = 0.4,
  };
  StartContext start_context = {0};
  waypoint_index = 5;
  route_finished = 1;
  assert(controller_survey_lifecycle_start(
      &command,
      &active,
      &waypoint_index,
      &route_finished,
      &state,
      &callbacks,
      &start_context));
  assert(active.count == 3 && waypoint_index == 0 && !route_finished);
  assert(strcmp(active.command_id, "survey-1") == 0);
  assert(state.route_active && state.mode == MAPPING_SURVEY_MODE_DOUBLE);
  assert(start_context.count == 7);
  assert(start_context.calls[0] == 'C' && start_context.calls[1] == 'S' &&
      start_context.calls[2] == 'G' && start_context.calls[3] == 'L' &&
      start_context.calls[4] == 'A' && start_context.calls[5] == 'N' &&
      start_context.calls[6] == 'T');

  const ControllerSurveyReplanCallbacks replan_callbacks = {
      merge_map,
      generate_replan,
      load,
      find_escape,
      reset_navigation,
      clear_error,
      mark_replanned,
  };
  start_context = (StartContext){0};
  state.route_active = 1;
  state.mode = MAPPING_SURVEY_MODE_DOUBLE;
  route_finished = 1;
  assert(controller_survey_lifecycle_replan(
      (SurveyPoint){2.0, 3.0},
      &active,
      &waypoint_index,
      &route_finished,
      &state,
      25,
      &replan_callbacks,
      &start_context));
  assert(active.count == 3 && waypoint_index == 2 && !route_finished);
  assert(strcmp(active.command_id, "survey-1") == 0);
  assert(state.route_active && state.replan_cooldown_steps == 25);
  assert(start_context.count == 7);
  assert(start_context.calls[0] == 'M' && start_context.calls[1] == 'G' &&
      start_context.calls[2] == 'L' && start_context.calls[3] == 'E' &&
      start_context.calls[4] == 'N' && start_context.calls[5] == 'C' &&
      start_context.calls[6] == 'T');

  const ControllerSurveyOrbitCallbacks orbit_callbacks = {
      merge_map,
      find_orbit_escape,
      clear_navigation,
      begin_navigation,
      update_distance,
      clear_error,
      mark_skipped,
      fallback_replan,
  };
  start_context = (StartContext){0};
  active.count = 12;
  waypoint_index = 5;
  assert(controller_survey_lifecycle_escape_orbit(
      (SurveyPoint){2.0, 3.0},
      active.count,
      &waypoint_index,
      &state,
      30,
      &orbit_callbacks,
      &start_context));
  assert(waypoint_index == 8 && state.replan_cooldown_steps == 30);
  assert(start_context.count == 8);
  assert(start_context.calls[0] == 'M' && start_context.calls[1] == 'E' &&
      start_context.calls[2] == 'E' && start_context.calls[3] == 'C' &&
      start_context.calls[4] == 'B' && start_context.calls[5] == 'D' &&
      start_context.calls[6] == 'C' && start_context.calls[7] == 'T');

  puts("controller_survey_lifecycle_test: OK");
  return 0;
}
