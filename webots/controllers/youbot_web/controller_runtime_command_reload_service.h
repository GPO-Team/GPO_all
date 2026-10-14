#ifndef CONTROLLER_RUNTIME_COMMAND_RELOAD_SERVICE_H
#define CONTROLLER_RUNTIME_COMMAND_RELOAD_SERVICE_H

#include "controller_runtime.h"
#include "controller_runtime_command.h"
#include "controller_survey_integration.h"

typedef enum {
  CONTROLLER_RUNTIME_COMMAND_RELOAD_NOT_DUE,
  CONTROLLER_RUNTIME_COMMAND_RELOAD_MISSING,
  CONTROLLER_RUNTIME_COMMAND_RELOAD_UNCHANGED,
  CONTROLLER_RUNTIME_COMMAND_RELOAD_INVALID,
  CONTROLLER_RUNTIME_COMMAND_RELOAD_DUPLICATE,
  CONTROLLER_RUNTIME_COMMAND_RELOAD_APPLIED,
} ControllerRuntimeCommandReloadResult;

typedef struct {
  const char *command_path;
  const char *route_path;
  ControllerRuntimeCommandLimits limits;
  ControllerRuntime *runtime;
  ControllerSurveyIntegrationOps survey_ops;
  void (*spawn_obstacle)(const RuntimeCommand *command);
  void (*start_pick_place)(const RuntimeCommand *command);
  void (*cancel_pick_place)(const char *mission_id);
  long long last_modified;
  long long last_processed_id;
  int (*motion_blocked)(void);
} ControllerRuntimeCommandReloadService;

void controller_runtime_command_reload_service_init(
    ControllerRuntimeCommandReloadService *service,
    const char *command_path,
    const char *route_path,
    ControllerRuntimeCommandLimits limits,
    ControllerRuntime *runtime,
    const ControllerSurveyIntegrationOps *survey_ops,
    void (*spawn_obstacle)(const RuntimeCommand *command));
ControllerRuntimeCommandReloadResult controller_runtime_command_reload_service_run(
    ControllerRuntimeCommandReloadService *service,
    int step_counter,
    int reload_interval);

#endif
