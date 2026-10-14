#include "controller_input_orchestration.h"

static int is_due(int step_counter, int interval) {
  return interval > 0 && (step_counter % interval) == 0;
}

void controller_input_orchestration_init(
    ControllerInputOrchestration *input,
    const ControllerInputOrchestrationOperations *operations,
    void *operations_context,
    int zone_reload_interval,
    int route_reload_interval,
    int runtime_command_reload_interval) {
  if (!input) return;
  *input = ControllerInputOrchestration{
      operations,
      operations_context,
      zone_reload_interval,
      route_reload_interval,
      runtime_command_reload_interval};
}

void controller_input_orchestration_reload_motion(
    ControllerInputOrchestration *input,
    int step_counter) {
  (void)step_counter;
  if (!input || !input->operations || !input->operations->reload_motion) return;
  if (input->operations->reload_motion(input->operations_context) ==
          CONTROLLER_INPUT_MOTION_RELOAD_CHANGED &&
      input->operations->set_status) {
    input->operations->set_status(input->operations_context, "motion_profile_reloaded");
  }
}

void controller_input_orchestration_reload_runtime_command(
    ControllerInputOrchestration *input,
    int step_counter) {
  if (!input || !input->operations || !input->operations->reload_runtime_command ||
      !is_due(step_counter, input->runtime_command_reload_interval)) return;
  input->operations->reload_runtime_command(input->operations_context);
}

void controller_input_orchestration_reload_zones(
    ControllerInputOrchestration *input,
    int step_counter) {
  if (!input || !input->operations || !input->operations->reload_limit_zones ||
      !is_due(step_counter, input->zone_reload_interval)) return;
  input->operations->reload_limit_zones(input->operations_context);
}

void controller_input_orchestration_reload_surface_zones(
    ControllerInputOrchestration *input,
    int step_counter) {
  if (!input || !input->operations || !input->operations->reload_surface_zones ||
      !is_due(step_counter, input->zone_reload_interval)) return;
  input->operations->reload_surface_zones(input->operations_context);
}

void controller_input_orchestration_reload_route(
    ControllerInputOrchestration *input,
    int step_counter) {
  if (!input || !input->operations || !input->operations->reload_route ||
      !is_due(step_counter, input->route_reload_interval)) return;
  input->operations->reload_route(input->operations_context);
}
