#ifndef YOUBOT_WEB_CONTROLLER_RUNTIME_H
#define YOUBOT_WEB_CONTROLLER_RUNTIME_H

#include "controller_avoidance.h"
#include "controller_navigation_context.h"
#include "controller_navigation_service.h"
#include "controller_survey_state.h"
#include "controller_types.h"

typedef struct {
  RouteData route;
  ZoneData limit_zones;
  SurfaceZoneData surface_zones;
  int current_waypoint_index;
  int route_finished;
  char cancelled_mission_id[64];
  char failed_mission_id[64];
  NavigationMode navigation_mode;
  int navigation_waypoint_index;
  double navigation_segment_start_x;
  double navigation_segment_start_z;
  double distance_to_target;
  ControllerNavigationPoseHistory navigation_pose_history;
  ControllerAvoidanceState avoidance;
  double lidar_priority_turn_sign;
  int lidar_priority_hold_steps;
  ControllerMappingSurveyState mapping_survey;
} ControllerRuntime;

typedef struct {
  double x;
  double z;
  double heading;
  int manual_relocation_detected;
} ControllerRuntimeSensorFrame;

typedef enum {
  CONTROLLER_RUNTIME_MOTION_STOP = 0,
  CONTROLLER_RUNTIME_MOTION_CALCULATE = 1,
} ControllerRuntimeMotionKind;

typedef struct {
  ControllerRuntimeMotionKind command;
} ControllerRuntimeMotionCommand;

typedef enum {
  CONTROLLER_RUNTIME_FRAME_WAIT_FOR_ROUTE = 0,
  CONTROLLER_RUNTIME_FRAME_STOP_FINISHED = 1,
  CONTROLLER_RUNTIME_FRAME_READY = 2,
} ControllerRuntimeFrameDecision;

typedef struct {
  ControllerRuntimeMotionCommand motion;
} ControllerRuntimeFrameResult;

typedef struct {
  double position_tolerance;
  double heading_tolerance_rad;
  double zone_clearance;
  double relocation_distance;
  double relocation_heading_rad;
} ControllerRuntimeNavigationConfig;

typedef enum {
  CONTROLLER_RUNTIME_ACTION_WAIT_FOR_ROUTE = 0,
  CONTROLLER_RUNTIME_ACTION_STOP_FINISHED = 1,
  CONTROLLER_RUNTIME_ACTION_RELOCALIZE = 2,
  CONTROLLER_RUNTIME_ACTION_ROUTE_COMPLETED = 3,
  CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_TARGET = 4,
  CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_SEGMENT = 5,
  CONTROLLER_RUNTIME_ACTION_BLOCKED_TARGET = 6,
  CONTROLLER_RUNTIME_ACTION_BLOCKED_SEGMENT = 7,
  CONTROLLER_RUNTIME_ACTION_TRACK_ROUTE = 8,
} ControllerRuntimeAction;

typedef struct {
  ControllerRuntimeAction action;
  Waypoint target;
  ControllerNavigationServiceFrameOutput navigation;
} ControllerRuntimeNavigationResult;

void controller_runtime_init(ControllerRuntime *runtime);
ControllerRuntimeFrameDecision controller_runtime_process_sensor_frame(
    ControllerRuntime *runtime,
    const ControllerRuntimeSensorFrame *frame,
    ControllerRuntimeFrameResult *result);
ControllerRuntimeMotionCommand controller_runtime_calculate_motion_command(
    const ControllerRuntime *runtime);
ControllerRuntimeNavigationResult controller_runtime_process_navigation_frame(
    ControllerRuntime *runtime,
    const ControllerRuntimeSensorFrame *frame,
    const ControllerRuntimeNavigationConfig *config);

#endif
