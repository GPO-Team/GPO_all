#include "controller_step.h"

#include <assert.h>
#include <string.h>

static char call_log[32];
static int call_count = 0;
static void *expected_context = NULL;

#define DEFINE_CALLBACK(name, code) \
  static void name(void *context) { assert(context == expected_context); call_log[call_count++] = (code); }

DEFINE_CALLBACK(reload_zones, 'Z')
DEFINE_CALLBACK(reload_surface_zones, 'S')
DEFINE_CALLBACK(reload_route, 'R')
DEFINE_CALLBACK(reload_motion, 'M')
DEFINE_CALLBACK(reload_command, 'C')
DEFINE_CALLBACK(capture_lidar, 'L')
DEFINE_CALLBACK(merge_trace, 'T')
DEFINE_CALLBACK(write_map, 'A')
DEFINE_CALLBACK(capture_camera, 'P')
DEFINE_CALLBACK(write_camera_frame, 'F')
DEFINE_CALLBACK(write_camera_map, 'B')
DEFINE_CALLBACK(navigate, 'N')
DEFINE_CALLBACK(update_metrics, 'E')
DEFINE_CALLBACK(write_snapshot, 'Q')

static const ControllerStepCallbacks callbacks = {
    reload_zones,
    reload_surface_zones,
    reload_route,
    reload_motion,
    reload_command,
    capture_lidar,
    merge_trace,
    write_map,
    capture_camera,
    write_camera_frame,
    write_camera_map,
    navigate,
    update_metrics,
    write_snapshot,
};

int main(void) {
  int context = 0;
  expected_context = &context;
  const ControllerLifecycleScheduleConfig schedule = {10, 20, 20, 6, 60, 4, 12};
  controller_step_run(60, &schedule, &callbacks, &context);
  call_log[call_count] = '\0';
  if (strcmp(call_log, "ZSRMCLTAPFBNEQ") != 0) return 1;

  call_count = 0;
  controller_step_run(12, &schedule, &callbacks, &context);
  call_log[call_count] = '\0';
  if (strcmp(call_log, "CLTPFNEQ") != 0) return 2;

  return 0;
}
