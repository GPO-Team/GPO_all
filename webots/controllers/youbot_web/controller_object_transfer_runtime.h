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
  WbNodeRef platform_node;
  int finger_node_ids[2];
  char boot_id[64];
  int arm_phase;
  double initial_object_z;
  double grip_roll;
  double lift_origin[3];
  double stable_since;
  double floor_support_pose[3];
  int floor_support_confirmed;
  double last_time;
  double contacts[2];
  int cancel_recovery_attempted;
  int have_joint_measurement;
  int manual_active;
  double last_grip_seen;
  double last_platform_seen;
  double linear_speed_limit,angular_speed_limit;
  double progress_pose[3];
} ControllerObjectTransferRuntime;

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
int controller_object_transfer_runtime_allows_navigation(const ControllerObjectTransferRuntime *runtime);
void controller_object_transfer_runtime_hold(ControllerObjectTransferRuntime *runtime,const char *reason);
void controller_object_transfer_platform_pose(
    double robot_x,double robot_y,double robot_z,double heading,double pose[3]);
int controller_object_transfer_object_on_platform(
    double robot_x,double robot_y,double robot_z,double heading,
    double object_x,double object_y,double object_z);
void controller_object_transfer_runtime_set_speed_limits(ControllerObjectTransferRuntime *runtime,
    double linear_speed_limit, double angular_speed_limit);
int controller_object_transfer_release_safe(const ControllerObjectTransferState *state,
    int floor_contact, double linear_speed, double angular_speed);
int controller_object_transfer_release_supported(const ControllerObjectTransferState *state,
    int floor_contact);
int controller_object_transfer_floor_supported(ControllerObjectTransferRuntime *runtime,
    int floor_contact, double linear_speed, double angular_speed);
ControllerManipulatorTarget controller_object_transfer_runtime_sample(
    const ControllerObjectTransferRuntime *runtime, double now);

#endif
