#include "controller_survey_integration.h"

#include <assert.h>
#include <cmath>
#include <stdio.h>

static char calls[8];
static int call_count = 0;

static void record(char call) { calls[call_count++] = call; }
static void clear_error(void) { record('C'); }
static void apply_speed(double speed) {
  assert(speed == 0.3);
  record('S');
}
static int generate(const char *path, int clear_map, const RuntimeCommand *command) {
  assert(path && ((clear_map == 1 && command) || (clear_map == 0 && !command)));
  record('G');
  return 1;
}
static int load_route(RouteData *route) {
  record('L');
  route->count = 2;
  route->waypoints[1].x = 3.0;
  route->waypoints[1].z = 4.0;
  return 1;
}
static void reset_avoidance(void) { record('A'); }
static void reset_navigation(void) { record('N'); }
static void set_status(const char *status) {
  assert(status);
  record('T');
}
static double current_time(void) { return 10.0; }
static void merge_map(double now) {
  assert(now == 10.0);
  record('M');
}
static int find_escape(double x, double y, int start_index) {
  assert(x == 2.0 && y == 3.0 && start_index >= 0);
  record('E');
  return 1;
}
static void clear_navigation(void) { record('C'); }
static void begin_navigation(int waypoint_index, double x, double y) {
  assert(waypoint_index == 1 && x == 2.0 && y == 3.0);
  record('B');
}

int main(void) {
  const ControllerSurveyIntegrationOps ops = {
      .clear_error = clear_error,
      .apply_speed = apply_speed,
      .generate = generate,
      .load_route = load_route,
      .reset_avoidance = reset_avoidance,
      .reset_navigation = reset_navigation,
      .set_status = set_status,
      .current_time = current_time,
      .merge_map = merge_map,
      .find_escape = find_escape,
      .clear_navigation = clear_navigation,
      .begin_navigation = begin_navigation,
  };
  const RuntimeCommand command = {
      .clear_map = 1,
      .survey_mode = MAPPING_SURVEY_MODE_DOUBLE,
      .survey_speed_mps = 0.3,
  };
  RouteData route = {0};
  int waypoint_index = 5;
  int route_finished = 1;
  ControllerMappingSurveyState state;
  controller_mapping_survey_state_init(&state);

  assert(controller_survey_integration_start(
      "route.csv", &command, &route, &waypoint_index,
      &route_finished, &state, &ops));
  assert(route.count == 2 && waypoint_index == 0 && !route_finished);
  assert(state.route_active && call_count == 7);
  assert(calls[0] == 'C' && calls[1] == 'S' && calls[2] == 'G' &&
      calls[3] == 'L' && calls[4] == 'A' && calls[5] == 'N' && calls[6] == 'T');

  call_count = 0;
  assert(controller_survey_integration_replan(
      "route.csv", SurveyPoint{2.0, 3.0}, &route, &waypoint_index,
      &route_finished, &state, 20, &ops));
  assert(waypoint_index == 1 && state.replan_cooldown_steps == 20);

  call_count = 0;
  waypoint_index = 0;
  double distance = 0.0;
  assert(controller_survey_integration_escape_orbit(
      "route.csv", SurveyPoint{2.0, 3.0}, &route, &waypoint_index,
      &route_finished, &distance, &state, 30, &ops));
  assert(waypoint_index == 1 && fabs(distance - sqrt(2.0)) < 1e-9);

  puts("controller_survey_integration_test: OK");
  return 0;
}
