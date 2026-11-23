#include "controller_runtime.h"

#include <string.h>

void controller_runtime_init(ControllerRuntime *runtime) {
  if (!runtime) return;
  memset(runtime, 0, sizeof(*runtime));
  runtime->navigation_mode = NAV_MODE_IDLE;
  runtime->navigation_waypoint_index = -1;
  runtime->avoidance.turn_sign = 1.0;
  controller_mapping_survey_state_init(&runtime->mapping_survey);
}

ControllerRuntimeMotionCommand controller_runtime_calculate_motion_command(
    const ControllerRuntime *runtime) {
  ControllerRuntimeMotionCommand command = {CONTROLLER_RUNTIME_MOTION_STOP};
  if (runtime && !runtime->route_finished &&
      runtime->current_waypoint_index < runtime->route.count) {
    command.command = CONTROLLER_RUNTIME_MOTION_CALCULATE;
  }
  return command;
}

ControllerRuntimeFrameDecision controller_runtime_process_sensor_frame(
    ControllerRuntime *runtime,
    const ControllerRuntimeSensorFrame *frame,
    ControllerRuntimeFrameResult *result) {
  if (!result) return CONTROLLER_RUNTIME_FRAME_WAIT_FOR_ROUTE;
  result->motion = ControllerRuntimeMotionCommand{CONTROLLER_RUNTIME_MOTION_STOP};
  if (!runtime || !frame || runtime->route.count <= 0) {
    return CONTROLLER_RUNTIME_FRAME_WAIT_FOR_ROUTE;
  }
  if (runtime->route_finished) return CONTROLLER_RUNTIME_FRAME_STOP_FINISHED;

  result->motion = controller_runtime_calculate_motion_command(runtime);
  return result->motion.command == CONTROLLER_RUNTIME_MOTION_CALCULATE
             ? CONTROLLER_RUNTIME_FRAME_READY
             : CONTROLLER_RUNTIME_FRAME_STOP_FINISHED;
}

static ControllerRuntimeAction action_from_navigation_decision(
    ControllerNavigationServiceFrameDecision decision) {
  switch (decision) {
    case CONTROLLER_NAVIGATION_FRAME_STOP_FINISHED:
      return CONTROLLER_RUNTIME_ACTION_STOP_FINISHED;
    case CONTROLLER_NAVIGATION_FRAME_RELOCALIZE:
      return CONTROLLER_RUNTIME_ACTION_RELOCALIZE;
    case CONTROLLER_NAVIGATION_FRAME_ROUTE_COMPLETED:
      return CONTROLLER_RUNTIME_ACTION_ROUTE_COMPLETED;
    case CONTROLLER_NAVIGATION_FRAME_SKIP_BLOCKED_TARGET:
      return CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_TARGET;
    case CONTROLLER_NAVIGATION_FRAME_SKIP_BLOCKED_SEGMENT:
      return CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_SEGMENT;
    case CONTROLLER_NAVIGATION_FRAME_BLOCKED_TARGET:
      return CONTROLLER_RUNTIME_ACTION_BLOCKED_TARGET;
    case CONTROLLER_NAVIGATION_FRAME_BLOCKED_SEGMENT:
      return CONTROLLER_RUNTIME_ACTION_BLOCKED_SEGMENT;
    case CONTROLLER_NAVIGATION_FRAME_READY:
      return CONTROLLER_RUNTIME_ACTION_TRACK_ROUTE;
    case CONTROLLER_NAVIGATION_FRAME_WAIT_FOR_ROUTE:
    default:
      return CONTROLLER_RUNTIME_ACTION_WAIT_FOR_ROUTE;
  }
}

ControllerRuntimeNavigationResult controller_runtime_process_navigation_frame(
    ControllerRuntime *runtime,
    const ControllerRuntimeSensorFrame *frame,
    const ControllerRuntimeNavigationConfig *config) {
  ControllerRuntimeNavigationResult result = {
      .action = CONTROLLER_RUNTIME_ACTION_WAIT_FOR_ROUTE};
  if (!runtime || !frame || !config) return result;

  const int manual_relocation_detected =
      frame->manual_relocation_detected || controller_navigation_context_update_pose(
          &runtime->navigation_pose_history,
          frame->x,
          frame->z,
          frame->heading,
          config->relocation_distance,
          config->relocation_heading_rad);
  const ControllerNavigationServiceFrameInput input = {
      .route = &runtime->route,
      .current_waypoint_index = &runtime->current_waypoint_index,
      .route_finished = &runtime->route_finished,
      .manual_relocation_detected = manual_relocation_detected,
      .x = frame->x,
      .z = frame->z,
      .heading = frame->heading,
      .position_tolerance = config->position_tolerance,
      .heading_tolerance_rad = config->heading_tolerance_rad,
      .zones = &runtime->limit_zones,
      .zone_clearance = config->zone_clearance,
      .mapping_survey = runtime->mapping_survey.route_active,
      .survey_room_zone_index = runtime->mapping_survey.room_zone_index,
  };
  result.action = action_from_navigation_decision(
      controller_navigation_service_process_frame(&input, &result.navigation));
  result.target = result.navigation.route.route.target;
  return result;
}
