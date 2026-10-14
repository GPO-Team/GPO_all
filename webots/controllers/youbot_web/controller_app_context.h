#ifndef YOUBOT_WEB_CONTROLLER_APP_CONTEXT_H
#define YOUBOT_WEB_CONTROLLER_APP_CONTEXT_H

#include "controller_application_state.h"
#include "controller_camera_runtime.h"
#include "controller_control_config.h"
#include "controller_input_orchestration.h"
#include "controller_mapping_runtime.h"
#include "controller_mapping_survey_safety_service.h"
#include "controller_motion_profile_reload_service.h"
#include "controller_paths.h"
#include "controller_perception_runtime.h"
#include "controller_route_zone_reload_service.h"
#include "controller_runtime_command_reload_service.h"
#include "controller_webots_adapter.h"
#include "controller_webots_devices.h"
#include "controller_webots_manipulator.h"
#include "controller_webots_motion_state.h"
#include "controller_webots_pose.h"
#include "controller_webots_sensors.h"
#include "controller_webots_simulation.h"
#include "controller_webots_zone_sync.h"

typedef struct {
  ControllerWebotsDevices webots_devices;
  ControllerWebotsManipulator manipulator;
  ControllerWebotsAdapter webots_adapter;
  ControllerWebotsPose webots_pose;
  ControllerWebotsSensors webots_sensors;
  ControllerRuntime controller_runtime;
  ControllerRouteZoneService route_zone_service;
  ControllerRouteZoneReloadService route_zone_reload_service;
  ControllerWebotsSimulationNodeRegistry zone_node_registry;
  ControllerWebotsSimulationNodeRegistry surface_zone_registry;
  ControllerWebotsSimulationNodeRegistry runtime_obstacle_registry;
  ControllerWebotsZoneSyncContext webots_zone_sync;
  ControllerMappingRuntime mapping_runtime;
  ControllerMappingSurveySafetyService mapping_survey_safety_service;
  ControllerPerceptionRuntime perception_runtime;
  ControllerCameraRuntime camera_runtime;
  ControllerApplicationState application_state;
  ControllerWebotsMotionState motion_state;
  ControllerMotionProfileReloadService motion_profile_reload_service;
  ControllerRuntimeCommandReloadService runtime_command_reload_service;
  ControllerInputOrchestration input_orchestration;
  ControllerPaths paths;
  ControllerControlConfig control_config;
} ControllerAppContext;

void controller_app_context_init(ControllerAppContext *context);

extern ControllerAppContext controller_app;

#endif
