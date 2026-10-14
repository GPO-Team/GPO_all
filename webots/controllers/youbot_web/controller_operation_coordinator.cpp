#include "controller_operation_coordinator.h"
void controller_operation_coordinator_init(ControllerOperationCoordinator *coordinator){if(coordinator)coordinator->owner=CONTROLLER_OPERATION_IDLE;}
int controller_operation_coordinator_acquire(ControllerOperationCoordinator *coordinator,ControllerOperationOwner owner){if(!coordinator||owner==CONTROLLER_OPERATION_IDLE||coordinator->owner!=CONTROLLER_OPERATION_IDLE)return 0;coordinator->owner=owner;return 1;}
int controller_operation_coordinator_release(ControllerOperationCoordinator *coordinator,ControllerOperationOwner owner){if(!coordinator||coordinator->owner!=owner)return 0;coordinator->owner=CONTROLLER_OPERATION_IDLE;return 1;}
