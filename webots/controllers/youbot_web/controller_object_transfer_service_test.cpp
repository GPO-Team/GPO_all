#include "controller_object_transfer_service.h"

#include <assert.h>
#include <string.h>

static ControllerObjectTransferInput ready_input() {
  ControllerObjectTransferInput input = {};
  input.navigation_reached = 1;
  input.base_aligned = 1;
  input.arm_reached = 1;
  input.grasp_valid = 1;
  input.attached = 1;
  input.platform_pose_reached = 1;
  input.release_safe = 1;
  return input;
}

int main() {
  ControllerObjectTransferService service;
  controller_object_transfer_service_init(&service);
  assert(controller_object_transfer_service_start(
      &service, "transfer-1", "demo-box", 4.0, -2.0, 0.0));
  assert(service.state.stage == CONTROLLER_TRANSFER_APPROACHING_OBJECT);

  ControllerObjectTransferInput input = ready_input();
  double now = 1.0;
  int stored_on_platform = 0;
  int taken_from_platform = 0;
  int transported_on_platform = 0;
  while (service.state.status != CONTROLLER_TRANSFER_COMPLETED && now < 20.0) {
    input.on_platform = service.state.on_platform;
    ControllerObjectTransferOutput output = {};
    controller_object_transfer_service_step(&service, &input, now, &output);
    stored_on_platform |= output.store_object_on_platform;
    taken_from_platform |= output.take_object_from_platform;
    transported_on_platform |=
        service.state.stage == CONTROLLER_TRANSFER_TRANSPORTING &&
        service.state.on_platform;
    now += 1.0;
  }
  assert(service.state.status == CONTROLLER_TRANSFER_COMPLETED);
  assert(service.state.stage == CONTROLLER_TRANSFER_STAGE_NONE);
  assert(service.state.progress == 100);
  assert(stored_on_platform);
  assert(taken_from_platform);
  assert(transported_on_platform);
  assert(!service.state.on_platform);

  controller_object_transfer_service_init(&service);
  assert(controller_object_transfer_service_start(&service, "transfer-2", "demo-box", 1.0, 1.0, 0.0));
  input = ready_input();
  input.base_aligned = 0;
  ControllerObjectTransferOutput output = {};
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  controller_object_transfer_service_step(&service, &input, 32.0, &output);
  assert(service.state.alignment_retries == 1);
  controller_object_transfer_service_step(&service, &input, 63.0, &output);
  assert(service.state.status == CONTROLLER_TRANSFER_FAILED);
  assert(strcmp(service.state.error_code, "alignment_failed") == 0);

  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(&service, "transfer-3", "demo-box", 1.0, 1.0, 0.0);
  service.state.attached = 1;
  service.state.on_platform = 1;
  input = ready_input();
  input.cancel_requested = 1;
  input.release_safe = 0;
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  assert(service.state.status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY);
  assert(strcmp(service.state.error_code, "unsafe_release") == 0);
  assert(controller_object_transfer_service_resume(&service, 2.0));
  assert(service.state.status == CONTROLLER_TRANSFER_RUNNING);
  assert(service.state.stage == CONTROLLER_TRANSFER_TRANSPORTING);

  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(
      &service, "transfer-4", "demo-box", 1.0, 1.0, 0.0);
  input = ready_input();
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  controller_object_transfer_service_step(&service, &input, 2.0, &output);
  controller_object_transfer_service_step(&service, &input, 3.0, &output);
  input.grasp_valid = 0;
  controller_object_transfer_service_step(&service, &input, 4.0, &output);
  assert(service.state.stage == CONTROLLER_TRANSFER_GRASPING);
  controller_object_transfer_service_step(&service, &input, 35.0, &output);
  assert(service.state.status == CONTROLLER_TRANSFER_FAILED);
  assert(strcmp(service.state.error_code, "grasp_failed") == 0);

  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(
      &service, "transfer-grip-gate", "demo-box", 1.0, 1.0, 0.0);
  service.state.stage = CONTROLLER_TRANSFER_GRASPING;
  service.state.stage_started_at = 0.0;
  input = ready_input();
  input.arm_reached = 0;
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  assert(service.state.stage == CONTROLLER_TRANSFER_GRASPING);
  assert(output.close_gripper == 1);
  assert(output.attach_object == 0);
  input.arm_reached = 1;
  controller_object_transfer_service_step(&service, &input, 2.0, &output);
  assert(service.state.stage == CONTROLLER_TRANSFER_LIFTING);
  assert(output.attach_object == 1);

  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(
      &service, "transfer-platform-release", "demo-box", 1.0, 1.0, 0.0);
  service.state.stage = CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM;
  service.state.stage_started_at = 0.0;
  service.state.attached = 1;
  input = ready_input();
  input.arm_reached = 0;
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  assert(service.state.stage == CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM);
  assert(output.store_object_on_platform == 0);
  input.arm_reached = 1;
  input.platform_pose_reached = 0;
  controller_object_transfer_service_step(&service, &input, 2.0, &output);
  assert(service.state.stage == CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM);
  assert(output.store_object_on_platform == 0);
  input.platform_pose_reached = 1;
  controller_object_transfer_service_step(&service, &input, 3.0, &output);
  assert(service.state.stage == CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT);
  assert(output.store_object_on_platform == 1);

  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(
      &service, "transfer-final-recovery", "demo-box", 1.0, 1.0, 0.0);
  service.state.stage = CONTROLLER_TRANSFER_PLACING;
  service.state.stage_started_at = 0.0;
  service.state.attached = 1;
  input = ready_input();
  input.release_safe = 0;
  controller_object_transfer_service_step(&service, &input, 31.0, &output);
  assert(service.state.status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY);
  assert(controller_object_transfer_service_resume(&service, 32.0));
  assert(service.state.stage == CONTROLLER_TRANSFER_PLACING);

  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(
      &service, "transfer-5", "demo-box", 1.0, 1.0, 0.0);
  service.state.attached = 1;
  service.state.on_platform = 1;
  input = ready_input();
  input.cancel_requested = 1;
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  assert(service.state.status == CONTROLLER_TRANSFER_CANCELLED);
  assert(output.detach_object == 1);
  return 0;
}
