#ifndef YOUBOT_WEB_CONTROLLER_NAVIGATION_SERVICE_H
#define YOUBOT_WEB_CONTROLLER_NAVIGATION_SERVICE_H

#include "controller_navigation_route.h"
#include "controller_navigation_session.h"
#include "controller_navigation_motion_service.h"
#include "controller_navigation_zone_guard.h"

typedef struct {
  ControllerNavigationSessionOutput session;
} ControllerNavigationServiceSessionOutput;

typedef struct {
  ControllerNavigationRouteOutput route;
} ControllerNavigationServiceRouteOutput;

typedef struct {
  int final_alignment;
  ControllerNavigationMotionServiceOutput motion;
} ControllerNavigationServiceMotionOutput;

typedef enum {
  CONTROLLER_NAVIGATION_FRAME_WAIT_FOR_ROUTE = 0,
  CONTROLLER_NAVIGATION_FRAME_STOP_FINISHED = 1,
  CONTROLLER_NAVIGATION_FRAME_RELOCALIZE = 2,
  CONTROLLER_NAVIGATION_FRAME_ROUTE_COMPLETED = 3,
  CONTROLLER_NAVIGATION_FRAME_SKIP_BLOCKED_TARGET = 4,
  CONTROLLER_NAVIGATION_FRAME_SKIP_BLOCKED_SEGMENT = 5,
  CONTROLLER_NAVIGATION_FRAME_BLOCKED_TARGET = 6,
  CONTROLLER_NAVIGATION_FRAME_BLOCKED_SEGMENT = 7,
  CONTROLLER_NAVIGATION_FRAME_READY = 8,
} ControllerNavigationServiceFrameDecision;

typedef struct {
  RouteData *route;
  int *current_waypoint_index;
  int *route_finished;
  int manual_relocation_detected;
  double x;
  double z;
  double heading;
  double position_tolerance;
  double heading_tolerance_rad;
  const ZoneData *zones;
  double zone_clearance;
  int mapping_survey;
  int survey_room_zone_index;
} ControllerNavigationServiceFrameInput;

typedef struct {
  ControllerNavigationServiceSessionOutput session;
  ControllerNavigationServiceRouteOutput route;
  ControllerNavigationRouteDecision route_decision;
  ControllerNavigationZoneDecision zone_decision;
} ControllerNavigationServiceFrameOutput;

ControllerNavigationSessionDecision controller_navigation_service_begin_step(
    const RouteData *route,
    int route_finished,
    int manual_relocation_detected,
    int current_waypoint_index,
    double x,
    double z,
    ControllerNavigationServiceSessionOutput *output);
ControllerNavigationRouteDecision controller_navigation_service_advance_route(
    const RouteData *route,
    int *current_waypoint_index,
    int *route_finished,
    double x,
    double z,
    double heading,
    double position_tolerance,
    double heading_tolerance_rad,
    ControllerNavigationServiceRouteOutput *output);
ControllerNavigationZoneDecision controller_navigation_service_guard_route(
    const ZoneData *zones,
    double current_x,
    double current_z,
    const Waypoint *target,
    double clearance,
    int mapping_survey,
    int mapping_survey_room_zone_index,
    int has_next_waypoint);
int controller_navigation_service_calculate_motion(
    const ControllerNavigationTrackingConfig *tracking_config,
    const ControllerNavigationLidarConfig *lidar_config,
    const ControllerNavigationMotionServiceInput *input,
    ControllerNavigationServiceMotionOutput *output);
ControllerNavigationServiceFrameDecision controller_navigation_service_process_frame(
    const ControllerNavigationServiceFrameInput *input,
    ControllerNavigationServiceFrameOutput *output);

#endif
