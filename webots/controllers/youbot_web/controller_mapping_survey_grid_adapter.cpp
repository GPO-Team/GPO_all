#include "controller_mapping_survey_grid_adapter.h"

static int point_is_safe(
    void *context, double x, double y, int room_zone_index, double clearance) {
  const ControllerMappingSurveyGridAdapter *adapter = static_cast<const ControllerMappingSurveyGridAdapter *>(context);
  return controller_mapping_survey_runtime_point_safe(
      &adapter->safety, x, y, room_zone_index, clearance);
}

int controller_mapping_survey_grid_adapter_build(
    ControllerMappingSurveyGridAdapter *adapter,
    SurveyGrid *grid,
    int room_zone_index,
    SurveyPoint robot,
    double clearance) {
  if (!adapter || !grid) return 0;
  const RuntimeCommand *command = adapter->command;
  const ControllerSurveyGridInput input = {
      adapter->safety.zones, adapter->safety.persistent_map, adapter->safety.persistent_map_count,
      room_zone_index, robot.x, robot.y, clearance,
      command && command->has_field_bounds,
      command ? command->field_min_x : 0.0, command ? command->field_max_x : 0.0,
      command ? command->field_min_y : 0.0, command ? command->field_max_y : 0.0};
  return controller_survey_grid_build(grid, &adapter->grid_config, &input, point_is_safe, adapter);
}
