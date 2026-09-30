#include "controller_survey_runtime.h"

#include "controller_app_config.h"
#include "controller_app_internal.h"
#include "controller_input_runtime.h"
#include "controller_io.h"
#include "controller_lidar_runtime.h"

#include "controller_mapping_route_io.h"
#include "controller_mapping_scan_service.h"
#include "controller_mapping_scan_transition.h"
#include "controller_mapping_survey_contour_service.h"
#include "controller_mapping_survey_coverage_service.h"
#include "controller_mapping_survey_generator_callbacks.h"
#include "controller_mapping_survey_grid_adapter.h"
#include "controller_mapping_survey_lifecycle_service.h"
#include "controller_mapping_survey_route_generation_service.h"
#include "controller_mapping_survey_runtime_safety.h"
#include "controller_mapping_survey_safety.h"
#include "controller_mapping_survey_safety_service.h"
#include "controller_math.h"
#include "controller_survey_geometry.h"
#include "controller_survey_grid.h"
#include "controller_survey_state.h"
#include "controller_webots_motion_state.h"

#include <webots/robot.h>

void read_pose(double *x, double *y, double *heading);
void clear_persistent_map(void);
void reset_route_avoidance_metrics(void);
void reset_navigation_mode(void);
void clear_local_navigation_state(void);
void begin_navigation_for_waypoint(int waypoint_index, double x, double y);
void stop_robot(void);

ControllerMappingSurveySafetyContext mapping_survey_safety_context(void) {
  return controller_mapping_survey_safety_service_context(
      &mapping_survey_safety_service, wb_robot_get_time());
}

int survey_map_obstacle_near(double x, double y, double clearance) {
  const ControllerMappingSurveySafetyContext context = mapping_survey_safety_context();
  return controller_mapping_survey_runtime_map_obstacle_near(&context, x, y, clearance);
}

int survey_point_safe(double x, double y, int room_zone_index, double clearance) {
  const ControllerMappingSurveySafetyContext context = mapping_survey_safety_context();
  return controller_mapping_survey_runtime_point_safe(
      &context, x, y, room_zone_index, clearance);
}

int survey_known_obstacle_near(double x, double y, double clearance) {
  const ControllerMappingSurveySafetyContext context = mapping_survey_safety_context();
  return controller_mapping_survey_runtime_known_obstacle_near(&context, x, y, clearance);
}

int mapping_survey_segment_clear_of_known_obstacles(
    double ax,
    double ay,
    double bx,
    double by,
    double clearance) {
  const ControllerMappingSurveySafetyContext context = mapping_survey_safety_context();
  return controller_mapping_survey_runtime_segment_clear(
      &context,
      ax,
      ay,
      bx,
      by,
      clearance,
      LIDAR_NEAR_ROBOT_IGNORE_RADIUS);
}

int mapping_survey_segment_stays_in_room(double ax, double ay, double bx, double by) {
  if (controller_runtime.mapping_survey.room_zone_index < 0) return 1;
  const LimitZone *room = &controller_runtime.limit_zones.zones[controller_runtime.mapping_survey.room_zone_index];
  return controller_mapping_survey_segment_stays_in_room(room, ax, ay, bx, by, MAPPING_SURVEY_GRID_CELL);
}

int find_mapping_survey_escape_waypoint(double x, double y, int start_index) {
  return controller_mapping_survey_safety_service_find_escape_waypoint(
      &mapping_survey_safety_service,
      x,
      y,
      start_index,
      MAPPING_SURVEY_ESCAPE_MIN_TARGET_DISTANCE,
      MAPPING_SURVEY_ESCAPE_SCAN_AHEAD,
      MAPPING_SURVEY_ESCAPE_OBSTACLE_CLEARANCE,
      MAPPING_SURVEY_ESCAPE_SEGMENT_CLEARANCE,
      LIDAR_NEAR_ROBOT_IGNORE_RADIUS,
      wb_robot_get_time());
}

#define survey_route_add(route, count, x, y) \
  controller_survey_route_add((route), (count), MAX_WAYPOINTS, 0.18, (x), (y))
int mapping_survey_contour_point_is_safe(
    void *context,
    double x,
    double y,
    int room_zone_index,
    double clearance) {
  (void)context;
  return survey_point_safe(
      x, y, room_zone_index, clearance);
}

int append_room_contour_phase(
    SurveyPoint *route,
    int *route_count,
    int room_zone_index,
    double robot_x,
    double robot_y) {
  const ControllerMappingSurveyContourService contour_service = {
      &controller_runtime.limit_zones,
      mapping_survey_contour_point_is_safe,
      NULL,
      MAPPING_SURVEY_CONTOUR_OFFSET,
      0.72,
      0.18,
      MAPPING_SURVEY_MAX_CONTOUR_STEP};
  return controller_mapping_survey_contour_service_append(
      &contour_service, route, route_count, room_zone_index, robot_x, robot_y);
}

int survey_build_grid(
    SurveyGrid *grid,
    int room_zone_index,
    double robot_x,
    double robot_y,
    double clearance,
    const RuntimeCommand *command) {
  ControllerMappingSurveyGridAdapter adapter = {
      mapping_survey_safety_context(),
      {
      SURVEY_X_MIN,
      SURVEY_X_MAX,
      SURVEY_Y_MIN,
      SURVEY_Y_MAX,
      MAPPING_SURVEY_MAX_EXTENT_X,
      MAPPING_SURVEY_MAX_EXTENT_Y,
      MAPPING_SURVEY_GRID_CELL,
      MAPPING_SURVEY_MAX_GRID_CELLS,
      },
      command};
  return controller_mapping_survey_grid_adapter_build(
      &adapter, grid, room_zone_index, (SurveyPoint){robot_x, robot_y}, clearance);
}

#define append_grid_boundary_contour_phase(grid, route, route_count, robot_x, robot_y) \
  controller_survey_append_boundary_contour( \
      (grid), (route), (route_count), MAX_WAYPOINTS, MAPPING_SURVEY_MAX_BOUNDARY_POINTS, \
      (robot_x), (robot_y), 0.18, MAPPING_SURVEY_MAX_CONTOUR_STEP, 3.2, MAPPING_SURVEY_RDP_EPS)

ControllerMappingSurveyCoverageService mapping_survey_coverage_service(void) {
  return (ControllerMappingSurveyCoverageService){
      mapping_survey_safety_context(),
      MAPPING_SURVEY_INTERIOR_OFFSET,
      MAPPING_SURVEY_MIN_STRIP_LENGTH,
      MAPPING_SURVEY_STRIP,
      0.18,
      EPS,
      MAX_WAYPOINTS};
}

void append_scanline_coverage_phase(
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index) {
  const ControllerMappingSurveyCoverageService service = mapping_survey_coverage_service();
  controller_mapping_survey_coverage_service_append_horizontal(
      &service, grid, route, route_count, room_zone_index);
}

void append_vertical_coverage_phase(
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index) {
  const ControllerMappingSurveyCoverageService service = mapping_survey_coverage_service();
  controller_mapping_survey_coverage_service_append_vertical(
      &service, grid, route, route_count, room_zone_index);
}

void mapping_survey_generator_clear_map(void *context) {
  (void)context;
  clear_persistent_map();
}

void mapping_survey_generator_prepare(void *context, MappingSurveyMode mode) {
  (void)context;
  controller_mapping_survey_state_prepare(&controller_runtime.mapping_survey, mode);
}

SurveyPoint mapping_survey_generator_read_robot(void *context) {
  (void)context;
  double x = 0.0;
  double y = 0.0;
  double heading = 0.0;
  read_pose(&x, &y, &heading);
  return (SurveyPoint){x, y};
}

int mapping_survey_generator_find_room(void *context, SurveyPoint robot) {
  (void)context;
  return find_room_zone_index(robot.x, robot.y);
}

int mapping_survey_generator_build_grid(
    void *context,
    SurveyGrid *grid,
    SurveyPoint robot,
    int room_zone_index,
    const RuntimeCommand *command) {
  (void)context;
  return survey_build_grid(
      grid, room_zone_index, robot.x, robot.y, MAPPING_SURVEY_INTERIOR_OFFSET, command);
}

int mapping_survey_generator_flood_grid(
    void *context,
    SurveyGrid *grid,
    SurveyPoint robot) {
  (void)context;
  return controller_survey_flood_component(grid, robot.x, robot.y);
}

int mapping_survey_generator_start_is_safe(
    void *context,
    SurveyPoint start,
    int room_zone_index,
    double clearance) {
  (void)context;
  return survey_point_safe(start.x, start.y, room_zone_index, clearance);
}

void mapping_survey_generator_add_route_point(
    void *context,
    SurveyPoint *route,
    int *route_count,
    SurveyPoint point) {
  (void)context;
  survey_route_add(route, route_count, point.x, point.y);
}

int mapping_survey_generator_append_room_contour(
    void *context,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index,
    SurveyPoint robot) {
  (void)context;
  (void)grid;
  return append_room_contour_phase(route, route_count, room_zone_index, robot.x, robot.y);
}

void mapping_survey_generator_append_grid_boundary(
    void *context,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    SurveyPoint robot) {
  (void)context;
  append_grid_boundary_contour_phase(grid, route, route_count, robot.x, robot.y);
}

void mapping_survey_generator_append_horizontal_coverage(
    void *context,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index) {
  (void)context;
  append_scanline_coverage_phase(grid, route, route_count, room_zone_index);
}

void mapping_survey_generator_append_vertical_coverage(
    void *context,
    SurveyGrid *grid,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index) {
  (void)context;
  append_vertical_coverage_phase(grid, route, route_count, room_zone_index);
}

typedef struct {
  const char *mission_id;
  int written;
} SurveyWriteContext;

void mapping_survey_generator_write_route(
    void *context,
    const char *path,
    MappingSurveyMode mode,
    const SurveyPoint *route,
    int route_count) {
  SurveyWriteContext *write_context = context;
  write_context->written = controller_mapping_route_write(
      path, route, route_count, mode, write_context->mission_id);
  if (!write_context->written) set_error("Cannot write mapping survey route to route.csv");
}

int generate_mapping_survey_route(
    const char *path,
    int clear_map_before_start,
    const RuntimeCommand *command) {
  const MappingSurveyMode survey_mode =
      command ? command->survey_mode : controller_runtime.mapping_survey.mode;
  SurveyWriteContext write_context = {
      command ? command->mission_id : controller_runtime.route.command_id, 0};
  const ControllerMappingSurveyGeneratorCallbackOperations operations = {
      mapping_survey_generator_clear_map,
      mapping_survey_generator_prepare,
      mapping_survey_generator_read_robot,
      mapping_survey_generator_find_room,
      mapping_survey_generator_build_grid,
      mapping_survey_generator_flood_grid,
      mapping_survey_generator_start_is_safe,
      mapping_survey_generator_add_route_point,
      mapping_survey_generator_append_room_contour,
      mapping_survey_generator_append_grid_boundary,
      mapping_survey_generator_append_horizontal_coverage,
      mapping_survey_generator_append_vertical_coverage,
      mapping_survey_generator_write_route,
  };
  ControllerMappingSurveyGeneratorCallbacksAdapter adapter;
  controller_mapping_survey_generator_callbacks_adapter_init(
      &adapter,
      &operations,
      &write_context,
      path,
      command,
      MAPPING_SURVEY_INTERIOR_OFFSET * 0.45);
  const ControllerMappingSurveyRouteGenerationService service = {
      controller_mapping_survey_generator_callbacks_adapter_callbacks(&adapter), &adapter, set_error};
  const int generated = controller_mapping_survey_route_generation_service_generate(
      &service,
      clear_map_before_start,
      survey_mode,
      &controller_runtime.mapping_survey.room_zone_index,
      &controller_runtime.mapping_survey.interior_start_index);
  return generated && write_context.written;
}

void survey_integration_apply_speed(double speed_mps) {
  configured_cruise_speed_mps =
      clamp_value(speed_mps, MIN_CRUISE_SPEED_MPS, MAX_CRUISE_SPEED_MPS);
  controller_webots_motion_state_apply(&motion_state);
}

ControllerSurveyIntegrationOps survey_integration_ops(void) {
  const ControllerSurveyIntegrationOps ops = {
      .clear_error = clear_error,
      .apply_speed = survey_integration_apply_speed,
      .generate = generate_mapping_survey_route,
      .load_route = load_route,
      .reset_avoidance = reset_route_avoidance_metrics,
      .reset_navigation = reset_navigation_mode,
      .set_status = set_status,
      .current_time = (double (*)(void))wb_robot_get_time,
      .merge_map = merge_trace_into_map,
      .find_escape = find_mapping_survey_escape_waypoint,
      .clear_navigation = clear_local_navigation_state,
      .begin_navigation = begin_navigation_for_waypoint,
  };
  return ops;
}

int escape_mapping_survey_orbit(double x, double y) {
  const ControllerSurveyIntegrationOps ops = survey_integration_ops();
  return controller_survey_integration_escape_orbit(
      ROUTE_PATH,
      (SurveyPoint){x, y},
      &controller_runtime.route,
      &controller_runtime.current_waypoint_index,
      &controller_runtime.route_finished,
      &controller_runtime.distance_to_target,
      &controller_runtime.mapping_survey,
      MAPPING_SURVEY_REPLAN_COOLDOWN_STEPS,
      &ops);
}

void wait_for_fresh_route() {
  controller_runtime.route.count = 0;
  controller_runtime.route.last_modified = get_file_mtime(ROUTE_PATH);
  controller_runtime.current_waypoint_index = 0;
  controller_runtime.route_finished = 0;
  controller_mapping_survey_state_reset_route(&controller_runtime.mapping_survey);
  reset_route_avoidance_metrics();
  reset_navigation_mode();
  controller_runtime.distance_to_target = 0.0;
  clear_error();
  set_status("waiting_for_route");
  stop_robot();
}

int mapping_survey_scan_point_allowed(double x, double y) {
  return controller_mapping_survey_safety_service_scan_point_allowed(
      &mapping_survey_safety_service,
      x,
      y,
      controller_runtime.mapping_survey.room_zone_index,
      ZONE_CLEARANCE,
      ZONE_CLEARANCE * 0.68,
      wb_robot_get_time());
}

int mapping_survey_scan_point_allowed_callback(void *context, double x, double y) {
  (void)context;
  return mapping_survey_scan_point_allowed(x, y);
}

int insert_mapping_survey_obstacle_scan_route(
    double x,
    double z,
    double heading,
    const Waypoint *target,
    const LidarObstacleContext *lidar_context,
    double turn_sign) {
  const ControllerMappingScanServiceConfig scan_config = {
      .max_scan_points = MAPPING_SURVEY_OBSTACLE_SCAN_POINTS + 3,
      .scan = {
          .sensor_local_x = LIDAR_LOCAL_X,
          .sensor_local_y = LIDAR_LOCAL_Y,
          .min_range = LIDAR_MIN_TRACE_RANGE,
          .max_range = LIDAR_MAX_TRACE_RANGE,
          .min_repeat_distance = MAPPING_SURVEY_OBSTACLE_SCAN_MIN_REPEAT_DISTANCE,
          .radius = MAPPING_SURVEY_OBSTACLE_SCAN_RADIUS,
          .circle_point_count = MAPPING_SURVEY_OBSTACLE_SCAN_POINTS,
          .min_point_spacing = 0.18,
      },
  };
  const ControllerMappingScanServiceInput scan_input = {
      .mapping_survey = controller_runtime.mapping_survey.route_active,
      .route = &controller_runtime.route,
      .state = &controller_runtime.mapping_survey,
      .current_waypoint_index = controller_runtime.current_waypoint_index,
      .robot_x = x,
      .robot_y = z,
      .heading = heading,
      .target = target,
      .lidar_context = lidar_context,
      .turn_sign = turn_sign,
      .segment_start_x = controller_runtime.navigation_segment_start_x,
      .segment_start_y = controller_runtime.navigation_segment_start_z,
  };
  ControllerMappingScanServiceOutput scan_output;
  if (!controller_mapping_scan_service_start(
          &scan_config,
          &scan_input,
          mapping_survey_scan_point_allowed_callback,
          NULL,
          &scan_output)) {
    return 0;
  }
  clear_local_navigation_state();
  controller_mapping_scan_transition_apply(&controller_runtime, x, z);
  clear_error();
  set_status("mapping_survey_circle_scan_started");
  return 1;
}
