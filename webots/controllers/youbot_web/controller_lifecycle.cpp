#include "controller_lifecycle.h"

#include <stddef.h>

static int task_is_due(int step, int interval) {
  return interval > 0 && step >= 0 && (step % interval) == 0;
}

ControllerLifecycleTasks controller_lifecycle_tasks_for_step(
    int step, const ControllerLifecycleScheduleConfig *config) {
  if (!config) return ControllerLifecycleTasks{0};
  return ControllerLifecycleTasks{
      .reload_zones = task_is_due(step, config->zone_reload_interval),
      .reload_route = task_is_due(step, config->route_reload_interval),
      .reload_motion = task_is_due(step, config->motion_reload_interval),
      .reload_runtime_command =
          task_is_due(step, config->runtime_command_reload_interval),
      .write_maps = task_is_due(step, config->map_write_interval),
      .capture_camera = task_is_due(step, config->camera_capture_interval),
      .write_camera_frame = task_is_due(step, config->camera_write_interval),
  };
}
