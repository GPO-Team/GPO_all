#include "controller_mapping_survey_generator_callbacks.h"

#include "controller_survey_route_builder.h"

typedef struct {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter;
  SurveyPoint *route;
  int *route_count;
  int room_zone_index;
  SurveyPoint robot;
} ControllerMappingSurveyRouteCallbacksContext;

static void clear_map(void *context) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  adapter->operations->clear_map(adapter->operations_context);
}

static void prepare(void *context, MappingSurveyMode mode) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  adapter->operations->prepare(adapter->operations_context, mode);
}

static SurveyPoint read_robot(void *context) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  return adapter->operations->read_robot(adapter->operations_context);
}

static int find_room(void *context, SurveyPoint robot) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  return adapter->operations->find_room(adapter->operations_context, robot);
}

static int build_grid(void *context, SurveyPoint robot, int room_zone_index) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  return adapter->operations->build_grid(
      adapter->operations_context, &adapter->grid, robot, room_zone_index, adapter->command);
}

static int flood_grid(void *context, SurveyPoint robot) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  return adapter->operations->flood_grid(adapter->operations_context, &adapter->grid, robot);
}

static int start_is_safe(void *context, SurveyPoint start) {
  const ControllerMappingSurveyRouteCallbacksContext *route = static_cast<const ControllerMappingSurveyRouteCallbacksContext *>(context);
  const ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = route->adapter;
  return adapter->operations->start_is_safe(
      adapter->operations_context, start, route->room_zone_index, adapter->start_clearance);
}

static void add_start(void *context, SurveyPoint start) {
  ControllerMappingSurveyRouteCallbacksContext *route = static_cast<ControllerMappingSurveyRouteCallbacksContext *>(context);
  route->adapter->operations->add_route_point(
      route->adapter->operations_context, route->route, route->route_count, start);
}

static int append_room_contour(void *context) {
  ControllerMappingSurveyRouteCallbacksContext *route = static_cast<ControllerMappingSurveyRouteCallbacksContext *>(context);
  return route->adapter->operations->append_room_contour(
      route->adapter->operations_context, &route->adapter->grid, route->route, route->route_count,
      route->room_zone_index, route->robot);
}

static void append_grid_boundary(void *context) {
  ControllerMappingSurveyRouteCallbacksContext *route = static_cast<ControllerMappingSurveyRouteCallbacksContext *>(context);
  route->adapter->operations->append_grid_boundary(
      route->adapter->operations_context, &route->adapter->grid, route->route, route->route_count,
      route->robot);
}

static void append_horizontal_coverage(void *context) {
  ControllerMappingSurveyRouteCallbacksContext *route = static_cast<ControllerMappingSurveyRouteCallbacksContext *>(context);
  route->adapter->operations->append_horizontal_coverage(
      route->adapter->operations_context, &route->adapter->grid, route->route, route->route_count,
      route->room_zone_index);
}

static void append_vertical_coverage(void *context) {
  ControllerMappingSurveyRouteCallbacksContext *route = static_cast<ControllerMappingSurveyRouteCallbacksContext *>(context);
  route->adapter->operations->append_vertical_coverage(
      route->adapter->operations_context, &route->adapter->grid, route->route, route->route_count,
      route->room_zone_index);
}

static int build_route(
    void *context,
    MappingSurveyMode mode,
    SurveyPoint robot,
    int room_zone_index,
    SurveyPoint *route,
    int *route_count,
    int *interior_start_index) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  ControllerMappingSurveyRouteCallbacksContext route_context = {
      adapter, route, route_count, room_zone_index, robot};
  const ControllerSurveyRouteCallbacks callbacks = {
      start_is_safe,
      add_start,
      append_room_contour,
      append_grid_boundary,
      append_horizontal_coverage,
      append_vertical_coverage};
  return controller_survey_build_route_phases(
      mode, robot, route_count, interior_start_index, &callbacks, &route_context);
}

static void write_route(
    void *context,
    MappingSurveyMode mode,
    const SurveyPoint *route,
    int route_count) {
  ControllerMappingSurveyGeneratorCallbacksAdapter *adapter = static_cast<ControllerMappingSurveyGeneratorCallbacksAdapter *>(context);
  adapter->operations->write_route(
      adapter->operations_context, adapter->path, mode, route, route_count);
}

void controller_mapping_survey_generator_callbacks_adapter_init(
    ControllerMappingSurveyGeneratorCallbacksAdapter *adapter,
    const ControllerMappingSurveyGeneratorCallbackOperations *operations,
    void *operations_context,
    const char *path,
    const RuntimeCommand *command,
    double start_clearance) {
  if (!adapter) return;
  *adapter = ControllerMappingSurveyGeneratorCallbacksAdapter{
      operations, operations_context, path, command, start_clearance, {0}};
}

const ControllerSurveyGeneratorCallbacks *
controller_mapping_survey_generator_callbacks_adapter_callbacks(
    const ControllerMappingSurveyGeneratorCallbacksAdapter *adapter) {
  (void)adapter;
  static const ControllerSurveyGeneratorCallbacks callbacks = {
      clear_map, prepare, read_robot, find_room, build_grid, flood_grid, build_route, write_route};
  return &callbacks;
}
