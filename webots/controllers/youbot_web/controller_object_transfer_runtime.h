#ifndef CONTROLLER_OBJECT_TRANSFER_RUNTIME_H
#define CONTROLLER_OBJECT_TRANSFER_RUNTIME_H

#include "controller_manipulator_service.h"
#include "controller_object_transfer_service.h"
#include "controller_runtime.h"
#include "controller_types.h"
#include "controller_webots_devices.h"
#include "controller_webots_object_adapter.h"

typedef struct {
  ControllerObjectTransferService service;
  ControllerManipulatorService manipulator;
  ControllerWebotsObjectAdapter object;
  ControllerRuntime *navigation;
  ControllerWebotsDevices *devices;
  ControllerObjectTransferStage configured_stage;
  int available;
} ControllerObjectTransferRuntime;

void controller_object_transfer_carry_pose(
    ControllerObjectTransferStage stage,
    double *offset,
    double *height);

void controller_object_transfer_runtime_init(
    ControllerObjectTransferRuntime *runtime,
    ControllerRuntime *navigation,
    ControllerWebotsDevices *devices);
void controller_object_transfer_runtime_command(
    ControllerObjectTransferRuntime *runtime,
    const RuntimeCommand *command,
    double now);
int controller_object_transfer_runtime_set_pose(
    ControllerObjectTransferRuntime *runtime,
    const char *pose_name,
    double now);
void controller_object_transfer_runtime_step(
    ControllerObjectTransferRuntime *runtime,
    double now,
    double robot_x,
    double robot_y,
    double heading);

#endif
