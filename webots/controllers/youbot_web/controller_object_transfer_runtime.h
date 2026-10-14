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
  WbNodeRef tcp_node;
  char boot_id[64];
  int arm_phase;
  double initial_object_z;
  double grip_offset[3];
  double stable_since;
  double last_object_pose[3];
  double last_time;
  double contacts[2];
  int cancel_recovery_attempted;
  int have_joint_measurement;
  double last_grip_seen;
} ControllerObjectTransferRuntime;

void controller_object_transfer_runtime_init(
    ControllerObjectTransferRuntime *runtime,
    ControllerRuntime *navigation,
    ControllerWebotsDevices *devices);
void controller_object_transfer_runtime_command(
    ControllerObjectTransferRuntime *runtime,
    const RuntimeCommand *command,
    double now);
void controller_object_transfer_runtime_step(
    ControllerObjectTransferRuntime *runtime,
    double now,
    double robot_x,
    double robot_y,
    double heading);
int controller_object_transfer_runtime_allows_navigation(const ControllerObjectTransferRuntime *runtime);
void controller_object_transfer_runtime_hold(ControllerObjectTransferRuntime *runtime,const char *reason);

#endif
