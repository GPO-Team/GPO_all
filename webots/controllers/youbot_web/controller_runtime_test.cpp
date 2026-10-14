#include "controller_runtime.h"

int main(void) {
  ControllerRuntime runtime;
  controller_runtime_init(&runtime);

  if (runtime.route.count != 0 || runtime.limit_zones.count != 0 ||
      runtime.surface_zones.count != 0 || runtime.current_waypoint_index != 0 ||
      runtime.route_finished || runtime.navigation_mode != NAV_MODE_IDLE ||
      runtime.avoidance.mode != AVOID_MODE_NONE ||
      runtime.mapping_survey.room_zone_index != -1) {
    return 1;
  }

  const ControllerRuntimeSensorFrame frame = {0.0, 0.0, 0.0, 0};
  ControllerRuntimeFrameResult result{};
  if (controller_runtime_process_sensor_frame(&runtime, &frame, &result) !=
      CONTROLLER_RUNTIME_FRAME_WAIT_FOR_ROUTE) {
    return 2;
  }
  if (result.motion.command != CONTROLLER_RUNTIME_MOTION_STOP) return 3;

  runtime.route.count = 1;
  runtime.route.waypoints[0] = Waypoint{1.0, 0.0, 0.0, 0};
  const ControllerRuntimeNavigationConfig config = {0.05, 0.08, 0.32, 0.45, 1.2};
  const ControllerRuntimeNavigationResult navigation =
      controller_runtime_process_navigation_frame(&runtime, &frame, &config);
  if (navigation.action != CONTROLLER_RUNTIME_ACTION_TRACK_ROUTE ||
      navigation.target.x != 1.0 || navigation.target.z != 0.0) {
    return 4;
  }
  return 0;
}
