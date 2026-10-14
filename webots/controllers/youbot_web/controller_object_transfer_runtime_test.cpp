#include "controller_object_transfer_runtime.h"
#include <cassert>
#include <cstring>

int main() {
  ControllerObjectTransferRuntime transfer={};
  ControllerRuntime navigation={};
  transfer.navigation=&navigation;
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.status=CONTROLLER_TRANSFER_RUNNING;
  transfer.service.state.stage=CONTROLLER_TRANSFER_APPROACHING_OBJECT;
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.stage=CONTROLLER_TRANSFER_GRASPING;
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.stage=CONTROLLER_TRANSFER_TRANSPORTING;
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.status=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.status=CONTROLLER_TRANSFER_FAILED;
  std::strcpy(transfer.service.state.mission_id,"failed-transfer");
  std::strcpy(navigation.route.command_id,"failed-transfer");
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  std::strcpy(navigation.route.command_id,"new-route");
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  return 0;
}
