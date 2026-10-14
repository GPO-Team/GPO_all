#include "controller_lifecycle.h"

int main(void) {
  const ControllerLifecycleScheduleConfig config = {10, 20, 20, 6, 60, 4, 12};
  ControllerLifecycleTasks tasks = controller_lifecycle_tasks_for_step(0, &config);
  if (!tasks.reload_zones || !tasks.reload_route || !tasks.reload_motion ||
      !tasks.reload_runtime_command || !tasks.write_maps ||
      !tasks.capture_camera || !tasks.write_camera_frame) {
    return 1;
  }

  tasks = controller_lifecycle_tasks_for_step(12, &config);
  if (tasks.reload_zones || tasks.reload_route || tasks.reload_motion ||
      !tasks.reload_runtime_command || tasks.write_maps ||
      !tasks.capture_camera || !tasks.write_camera_frame) {
    return 2;
  }

  tasks = controller_lifecycle_tasks_for_step(60, &config);
  if (!tasks.reload_zones || !tasks.reload_route || !tasks.reload_motion ||
      !tasks.reload_runtime_command || !tasks.write_maps ||
      !tasks.capture_camera || !tasks.write_camera_frame) {
    return 3;
  }

  ControllerLifecycleScheduleConfig disabled = config;
  disabled.zone_reload_interval = 0;
  tasks = controller_lifecycle_tasks_for_step(10, &disabled);
  if (tasks.reload_zones) return 4;

  return 0;
}
