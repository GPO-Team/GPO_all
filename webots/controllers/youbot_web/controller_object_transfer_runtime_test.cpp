#include "controller_object_transfer_runtime.h"
#include <cassert>
#include <cmath>
#include <cstring>

int main() {
  double platform[3]={};
  controller_object_transfer_platform_pose(1.0,2.0,0.102,0.0,platform);
  assert(std::fabs(platform[0]-0.91)<0.001);
  assert(std::fabs(platform[1]-2.0)<0.001);
  assert(std::fabs(platform[2]-0.2255)<0.001);
  assert(controller_object_transfer_object_on_platform(1.0,2.0,0.102,0.0,0.91,2.0,0.2255));
  assert(!controller_object_transfer_object_on_platform(1.0,2.0,0.102,0.0,1.1,2.0,0.2255));
  controller_object_transfer_platform_pose(1.0,2.0,0.102,1.5707963267948966,platform);
  assert(std::fabs(platform[0]-1.0)<0.001);
  assert(std::fabs(platform[1]-1.91)<0.001);
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
