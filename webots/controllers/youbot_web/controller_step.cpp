#include "controller_step.h"

#include <stddef.h>

static void call_if_present(ControllerStepCallback callback, void *context) {
  if (callback) callback(context);
}

void controller_step_run(
    int step,
    const ControllerLifecycleScheduleConfig *schedule,
    const ControllerStepCallbacks *callbacks,
    void *context) {
  if (!callbacks) return;
  const ControllerLifecycleTasks tasks =
      controller_lifecycle_tasks_for_step(step, schedule);

  if (tasks.reload_zones) {
    call_if_present(callbacks->reload_zones, context);
    call_if_present(callbacks->reload_surface_zones, context);
  }
  if (tasks.reload_route) call_if_present(callbacks->reload_route, context);
  if (tasks.reload_motion) call_if_present(callbacks->reload_motion, context);
  if (tasks.reload_runtime_command) call_if_present(callbacks->reload_runtime_command, context);
  call_if_present(callbacks->capture_lidar, context);
  call_if_present(callbacks->merge_trace, context);
  if (tasks.write_maps) call_if_present(callbacks->write_map, context);
  if (tasks.capture_camera) call_if_present(callbacks->capture_camera, context);
  if (tasks.write_camera_frame) call_if_present(callbacks->write_camera_frame, context);
  if (tasks.write_maps) call_if_present(callbacks->write_camera_map, context);
  call_if_present(callbacks->navigate, context);
  call_if_present(callbacks->update_avoidance_metrics, context);
  call_if_present(callbacks->write_snapshot, context);
}
