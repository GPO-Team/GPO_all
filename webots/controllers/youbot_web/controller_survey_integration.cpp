#include "controller_survey_integration.h"

#include "controller_survey_lifecycle.h"

#include <cmath>
#include <stddef.h>

typedef struct {
  const char *route_path;
  const ControllerSurveyIntegrationOps *ops;
} StartIntegrationContext;

static void start_clear_error(void *context) {
  ((StartIntegrationContext *)context)->ops->clear_error();
}

static void start_apply_speed(void *context, double speed_mps) {
  ((StartIntegrationContext *)context)->ops->apply_speed(speed_mps);
}

static int start_generate(void *context, const RuntimeCommand *command) {
  StartIntegrationContext *integration = static_cast<StartIntegrationContext *>(context);
  return integration->ops->generate(
      integration->route_path, command->clear_map, command);
}

static int start_load_route(void *context, RouteData *route) {
  return ((StartIntegrationContext *)context)->ops->load_route(route);
}

static void start_reset_avoidance(void *context) {
  ((StartIntegrationContext *)context)->ops->reset_avoidance();
}

static void start_reset_navigation(void *context) {
  ((StartIntegrationContext *)context)->ops->reset_navigation();
}

static void start_mark_started(void *context) {
  ((StartIntegrationContext *)context)->ops->set_status("mapping_survey_started");
}

int controller_survey_integration_start(
    const char *route_path,
    const RuntimeCommand *command,
    RouteData *active_route,
    int *current_waypoint_index,
    int *route_finished,
    ControllerMappingSurveyState *state,
    const ControllerSurveyIntegrationOps *ops) {
  if (!route_path || !ops || !ops->clear_error || !ops->apply_speed ||
      !ops->generate || !ops->load_route || !ops->reset_avoidance ||
      !ops->reset_navigation || !ops->set_status) {
    return 0;
  }
  StartIntegrationContext context = {route_path, ops};
  const ControllerSurveyStartCallbacks callbacks = {
      start_clear_error,
      start_apply_speed,
      start_generate,
      start_load_route,
      start_reset_avoidance,
      start_reset_navigation,
      start_mark_started,
  };
  return controller_survey_lifecycle_start(
      command, active_route, current_waypoint_index, route_finished,
      state, &callbacks, &context);
}

typedef struct {
  const char *route_path;
  const ControllerSurveyIntegrationOps *ops;
} ReplanIntegrationContext;

static void replan_merge_map(void *context) {
  const ControllerSurveyIntegrationOps *ops =
      ((ReplanIntegrationContext *)context)->ops;
  ops->merge_map(ops->current_time());
}

static int replan_generate(void *context) {
  ReplanIntegrationContext *integration = static_cast<ReplanIntegrationContext *>(context);
  return integration->ops->generate(integration->route_path, 0, NULL);
}

static int replan_load_route(void *context, RouteData *route) {
  return ((ReplanIntegrationContext *)context)->ops->load_route(route);
}

static int replan_find_escape(
    void *context,
    SurveyPoint robot,
    int start_index) {
  return ((ReplanIntegrationContext *)context)->ops->find_escape(
      robot.x, robot.y, start_index);
}

static void replan_reset_navigation(void *context) {
  ((ReplanIntegrationContext *)context)->ops->reset_navigation();
}

static void replan_clear_error(void *context) {
  ((ReplanIntegrationContext *)context)->ops->clear_error();
}

static void replan_mark_replanned(void *context) {
  ((ReplanIntegrationContext *)context)->ops->set_status(
      "mapping_survey_replanned_around_obstacle");
}

int controller_survey_integration_replan(
    const char *route_path,
    SurveyPoint robot,
    RouteData *active_route,
    int *current_waypoint_index,
    int *route_finished,
    ControllerMappingSurveyState *state,
    int cooldown_steps,
    const ControllerSurveyIntegrationOps *ops) {
  if (!route_path || !ops || !ops->current_time || !ops->merge_map ||
      !ops->find_escape || !ops->generate || !ops->load_route ||
      !ops->reset_navigation || !ops->clear_error || !ops->set_status) {
    return 0;
  }
  ReplanIntegrationContext context = {route_path, ops};
  const ControllerSurveyReplanCallbacks callbacks = {
      replan_merge_map,
      replan_generate,
      replan_load_route,
      replan_find_escape,
      replan_reset_navigation,
      replan_clear_error,
      replan_mark_replanned,
  };
  return controller_survey_lifecycle_replan(
      robot, active_route, current_waypoint_index, route_finished,
      state, cooldown_steps, &callbacks, &context);
}

typedef struct {
  const char *route_path;
  SurveyPoint robot;
  RouteData *active_route;
  int *current_waypoint_index;
  int *route_finished;
  double *distance_to_target;
  ControllerMappingSurveyState *state;
  int cooldown_steps;
  const ControllerSurveyIntegrationOps *ops;
} OrbitIntegrationContext;

static void orbit_merge_map(void *context) {
  const ControllerSurveyIntegrationOps *ops =
      ((OrbitIntegrationContext *)context)->ops;
  ops->merge_map(ops->current_time());
}

static int orbit_find_escape(
    void *context,
    SurveyPoint robot,
    int start_index) {
  return ((OrbitIntegrationContext *)context)->ops->find_escape(
      robot.x, robot.y, start_index);
}

static void orbit_clear_navigation(void *context) {
  ((OrbitIntegrationContext *)context)->ops->clear_navigation();
}

static void orbit_begin_navigation(
    void *context,
    int waypoint_index,
    SurveyPoint robot) {
  ((OrbitIntegrationContext *)context)->ops->begin_navigation(
      waypoint_index, robot.x, robot.y);
}

static void orbit_update_distance(
    void *context,
    int waypoint_index,
    SurveyPoint robot) {
  OrbitIntegrationContext *integration = static_cast<OrbitIntegrationContext *>(context);
  const Waypoint *target = &integration->active_route->waypoints[waypoint_index];
  *integration->distance_to_target = hypot(target->x - robot.x, target->z - robot.y);
}

static void orbit_mark_skipped(void *context) {
  ((OrbitIntegrationContext *)context)->ops->set_status(
      "mapping_survey_skipped_orbiting_obstacle");
}

static void orbit_clear_error(void *context) {
  ((OrbitIntegrationContext *)context)->ops->clear_error();
}

static int orbit_replan(void *context) {
  OrbitIntegrationContext *integration = static_cast<OrbitIntegrationContext *>(context);
  return controller_survey_integration_replan(
      integration->route_path,
      integration->robot,
      integration->active_route,
      integration->current_waypoint_index,
      integration->route_finished,
      integration->state,
      integration->cooldown_steps,
      integration->ops);
}

int controller_survey_integration_escape_orbit(
    const char *route_path,
    SurveyPoint robot,
    RouteData *active_route,
    int *current_waypoint_index,
    int *route_finished,
    double *distance_to_target,
    ControllerMappingSurveyState *state,
    int cooldown_steps,
    const ControllerSurveyIntegrationOps *ops) {
  if (!route_path || !active_route || !current_waypoint_index ||
      !route_finished || !distance_to_target || !state || !ops ||
      !ops->clear_navigation || !ops->begin_navigation) {
    return 0;
  }
  OrbitIntegrationContext context = {
      route_path, robot, active_route, current_waypoint_index, route_finished,
      distance_to_target, state, cooldown_steps, ops};
  const ControllerSurveyOrbitCallbacks callbacks = {
      orbit_merge_map,
      orbit_find_escape,
      orbit_clear_navigation,
      orbit_begin_navigation,
      orbit_update_distance,
      orbit_clear_error,
      orbit_mark_skipped,
      orbit_replan,
  };
  return controller_survey_lifecycle_escape_orbit(
      robot, active_route->count, current_waypoint_index, state,
      cooldown_steps, &callbacks, &context);
}
