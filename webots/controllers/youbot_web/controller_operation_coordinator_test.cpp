#include "controller_operation_coordinator.h"

#include <assert.h>

int main() {
  ControllerOperationCoordinator coordinator;
  controller_operation_coordinator_init(&coordinator);
  assert(coordinator.owner == CONTROLLER_OPERATION_IDLE);
  assert(controller_operation_coordinator_acquire(&coordinator, CONTROLLER_OPERATION_ROUTE));
  assert(!controller_operation_coordinator_acquire(&coordinator, CONTROLLER_OPERATION_OBJECT_TRANSFER));
  assert(controller_operation_coordinator_release(&coordinator, CONTROLLER_OPERATION_ROUTE));
  assert(controller_operation_coordinator_acquire(&coordinator, CONTROLLER_OPERATION_OBJECT_TRANSFER));
  assert(!controller_operation_coordinator_release(&coordinator, CONTROLLER_OPERATION_ROUTE));
  assert(controller_operation_coordinator_release(&coordinator, CONTROLLER_OPERATION_OBJECT_TRANSFER));
  return 0;
}
