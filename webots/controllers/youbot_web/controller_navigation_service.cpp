#include "controller_navigation_service.h"

#include <string.h>

ControllerNavigationSessionDecision controller_navigation_service_begin_step(
    const RouteData *route,
    int route_finished,
    int manual_relocation_detected,
    int current_waypoint_index,
    double x,
    double z,
    ControllerNavigationServiceSessionOutput *output) {
  if (!output) return CONTROLLER_NAVIGATION_SESSION_CONTINUE;
  return controller_navigation_session_evaluate(
      route,
      route_finished,
      manual_relocation_detected,
      current_waypoint_index,
      x,
      z,
      &output->session);
}

ControllerNavigationRouteDecision controller_navigation_service_advance_route(
    const RouteData *route,
    int *current_waypoint_index,
    int *route_finished,
    double x,
    double z,
    double heading,
    double position_tolerance,
    double heading_tolerance_rad,
    ControllerNavigationServiceRouteOutput *output) {
  if (!output) return CONTROLLER_NAVIGATION_ROUTE_WAITING;
  return controller_navigation_route_evaluate(
      route,
      current_waypoint_index,
      route_finished,
      x,
      z,
      heading,
      position_tolerance,
      heading_tolerance_rad,
      &output->route);
}

ControllerNavigationZoneDecision controller_navigation_service_guard_route(
    const ZoneData *zones,
    double current_x,
    double current_z,
    const Waypoint *target,
    double clearance,
    int mapping_survey,
    int mapping_survey_room_zone_index,
    int has_next_waypoint) {
  return controller_navigation_zone_guard_evaluate(
      zones,
      current_x,
      current_z,
      target,
      clearance,
      mapping_survey,
      mapping_survey_room_zone_index,
      has_next_waypoint);
}

int controller_navigation_service_calculate_motion(
    const ControllerNavigationTrackingConfig *tracking_config,
    const ControllerNavigationLidarConfig *lidar_config,
    const ControllerNavigationMotionServiceInput *input,
    ControllerNavigationServiceMotionOutput *output) {
  if (!output) return 0;
  output->final_alignment = controller_navigation_motion_service_compute(
      tracking_config, lidar_config, input, &output->motion);
  return output->final_alignment;
}

ControllerNavigationServiceFrameDecision controller_navigation_service_process_frame(
    const ControllerNavigationServiceFrameInput *input,
    ControllerNavigationServiceFrameOutput *output) {
  if (!input || !output || !input->route || !input->current_waypoint_index ||
      !input->route_finished) {
    return CONTROLLER_NAVIGATION_FRAME_WAIT_FOR_ROUTE;
  }
  memset(output, 0, sizeof(*output));

  const ControllerNavigationSessionDecision session_decision =
      controller_navigation_service_begin_step(
          input->route,
          *input->route_finished,
          input->manual_relocation_detected,
          *input->current_waypoint_index,
          input->x,
          input->z,
          &output->session);
  if (session_decision == CONTROLLER_NAVIGATION_SESSION_WAIT_FOR_ROUTE) {
    return CONTROLLER_NAVIGATION_FRAME_WAIT_FOR_ROUTE;
  }
  if (session_decision == CONTROLLER_NAVIGATION_SESSION_STOP_FINISHED) {
    return CONTROLLER_NAVIGATION_FRAME_STOP_FINISHED;
  }
  if (session_decision == CONTROLLER_NAVIGATION_SESSION_RELOCALIZE) {
    return CONTROLLER_NAVIGATION_FRAME_RELOCALIZE;
  }

  const ControllerNavigationRouteDecision route_decision =
      controller_navigation_service_advance_route(
          input->route,
          input->current_waypoint_index,
          input->route_finished,
          input->x,
          input->z,
          input->heading,
          input->position_tolerance,
          input->heading_tolerance_rad,
          &output->route);
  output->route_decision = route_decision;
  if (route_decision == CONTROLLER_NAVIGATION_ROUTE_COMPLETED) {
    return CONTROLLER_NAVIGATION_FRAME_ROUTE_COMPLETED;
  }
  if (route_decision != CONTROLLER_NAVIGATION_ROUTE_ACTIVE &&
      route_decision != CONTROLLER_NAVIGATION_ROUTE_ADVANCED) {
    return CONTROLLER_NAVIGATION_FRAME_WAIT_FOR_ROUTE;
  }

  output->zone_decision = controller_navigation_service_guard_route(
      input->zones,
      input->x,
      input->z,
      &output->route.route.target,
      input->zone_clearance,
      input->mapping_survey,
      input->survey_room_zone_index,
      *input->current_waypoint_index + 1 < input->route->count);
  switch (output->zone_decision) {
    case CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_TARGET:
      return CONTROLLER_NAVIGATION_FRAME_SKIP_BLOCKED_TARGET;
    case CONTROLLER_NAVIGATION_ZONE_SKIP_BLOCKED_SEGMENT:
      return CONTROLLER_NAVIGATION_FRAME_SKIP_BLOCKED_SEGMENT;
    case CONTROLLER_NAVIGATION_ZONE_BLOCKED_TARGET:
      return CONTROLLER_NAVIGATION_FRAME_BLOCKED_TARGET;
    case CONTROLLER_NAVIGATION_ZONE_BLOCKED_SEGMENT:
      return CONTROLLER_NAVIGATION_FRAME_BLOCKED_SEGMENT;
    case CONTROLLER_NAVIGATION_ZONE_CLEAR:
    default:
      return CONTROLLER_NAVIGATION_FRAME_READY;
  }
}
