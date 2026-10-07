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
  input.release_safe = 1;
  return input;
}

int main() {
  ControllerObjectTransferService service;
  controller_object_transfer_service_init(&service);
  controller_object_transfer_service_start(&service, "guarded", "demo-box", 1.0, 0.0, 0.0);
  service.state.stage = CONTROLLER_TRANSFER_GRASPING;
  ControllerObjectTransferInput premature = ready_input();
  premature.arm_reached = 0;
  ControllerObjectTransferOutput guarded_output = {};
  controller_object_transfer_service_step(&service, &premature, 0.1, &guarded_output);
  assert(service.state.stage == CONTROLLER_TRANSFER_GRASPING);
  assert(!guarded_output.attach_object);
  service.state.stage=CONTROLLER_TRANSFER_RELEASING;
  premature.arm_reached=1;
  premature.release_safe=0;
  controller_object_transfer_service_step(&service,&premature,0.2,&guarded_output);
  assert(!guarded_output.detach_object);
  service.state.stage=CONTROLLER_TRANSFER_TRANSPORTING;
  service.state.attached=1;
  premature.attached=0;
  controller_object_transfer_service_step(&service,&premature,0.3,&guarded_output);
  assert(service.state.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY);
  controller_object_transfer_service_init(&service);
  assert(controller_object_transfer_service_start(
      &service, "transfer-1", "demo-box", 4.0, -2.0, 0.0));
  assert(service.state.stage == CONTROLLER_TRANSFER_APPROACHING_OBJECT);

  ControllerObjectTransferInput input = ready_input();
  double now = 1.0;
  while (service.state.status != CONTROLLER_TRANSFER_COMPLETED && now < 20.0) {
    ControllerObjectTransferOutput output = {};
    controller_object_transfer_service_step(&service, &input, now, &output);
    now += 1.0;
  }
  assert(service.state.status == CONTROLLER_TRANSFER_COMPLETED);
  assert(service.state.stage == CONTROLLER_TRANSFER_STAGE_NONE);
  assert(service.state.progress == 100);

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
  input = ready_input();
  input.cancel_requested = 1;
  input.release_safe = 0;
  controller_object_transfer_service_step(&service, &input, 1.0, &output);
  assert(service.state.status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY);
  assert(strcmp(service.state.error_code, "unsafe_release") == 0);
  assert(controller_object_transfer_service_resume(&service, 2.0));
  assert(service.state.status == CONTROLLER_TRANSFER_RUNNING);
  assert(service.state.stage == CONTROLLER_TRANSFER_LIFTING);
  service.state.status=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
  service.state.attached=0;
  assert(controller_object_transfer_service_resume(&service,3.0));
  assert(service.state.stage==CONTROLLER_TRANSFER_RETURNING_ARM);
  assert(service.state.cancel_pending);
  service.state.status=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
  assert(!controller_object_transfer_service_start(&service,"replacement","demo-box",1.0,0.0,4.0));
  return 0;
}
