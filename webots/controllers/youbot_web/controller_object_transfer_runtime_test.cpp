#include "controller_object_transfer_runtime.h"
#include "controller_manipulator_kinematics.h"
#include <cassert>
#include <cmath>
#include <cstring>

int main() {
  // Each waypoint starts from measured fingers blocked by the handle. Reusing
  // that opening as a command unloads the grip at the start of every segment.
  ControllerObjectTransferRuntime carrying={};
  controller_manipulator_service_init(&carrying.manipulator);
  carrying.service.state.attached=1;
  const double joints[5]={0,.5,-2,-.75,0};
  const double blocked_fingers[2]={.012,.012};
  const ControllerManipulatorTarget next={ {1,.2,-1,-1.45,0},0 };
  const ControllerObjectTransferStage loaded_stages[]={CONTROLLER_TRANSFER_LIFTING,
      CONTROLLER_TRANSFER_PLACING_ON_PLATFORM,CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM,
      CONTROLLER_TRANSFER_PLACING};
  for(const auto stage:loaded_stages) {
    carrying.service.state.stage=stage;
    assert(controller_manipulator_service_start_target(&carrying.manipulator,&next,joints,blocked_fingers,10));
    for(int i=0;i<=20;++i) {
      const auto command=controller_object_transfer_runtime_sample(&carrying,10+i*carrying.manipulator.duration_seconds/20);
      assert(command.finger_opening==0);
      assert(controller_manipulator_joints_valid(command.joints));
    }
  }
  auto release=next;release.finger_opening=.025;
  assert(controller_manipulator_service_start_target(&carrying.manipulator,&release,joints,blocked_fingers,20));
  const ControllerObjectTransferStage release_stages[]={CONTROLLER_TRANSFER_RELEASING,CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM};
  for(const auto stage:release_stages) {
    carrying.service.state.stage=stage;
    const auto command=controller_object_transfer_runtime_sample(&carrying,20+carrying.manipulator.duration_seconds);
    assert(command.finger_opening==.025);
  }
  carrying.service.state.attached=0;
  carrying.service.state.stage=CONTROLLER_TRANSFER_GRASPING;
  assert(controller_manipulator_service_start_target(&carrying.manipulator,&next,joints,blocked_fingers,30));
  assert(controller_object_transfer_runtime_sample(&carrying,30).finger_opening==.012);
  ControllerObjectTransferState placed={};
  placed.destination_x=2;placed.destination_y=-.6;
  placed.object_pose[0]=2;placed.object_pose[1]=-.6;placed.object_pose[2]=.075;
  placed.object_up[2]=1;
  assert(controller_object_transfer_release_safe(&placed,1,0,0));
  assert(controller_object_transfer_release_supported(&placed,1));
  assert(!controller_object_transfer_release_supported(&placed,0));
  // Measured release vibration must still prevent completion, while support
  // allows the fingers to continue opening after the settled entry check.
  assert(controller_object_transfer_release_supported(&placed,1));
  assert(!controller_object_transfer_release_safe(&placed,1,.02667,.15208));
  assert(!controller_object_transfer_release_safe(&placed,0,0,0));
  placed.object_pose[2]=.12;
  assert(!controller_object_transfer_release_supported(&placed,1));
  assert(!controller_object_transfer_release_safe(&placed,1,0,0));
  placed.object_pose[2]=.075;
  placed.object_up[2]=.9;
  assert(!controller_object_transfer_release_safe(&placed,1,0,0));
  placed.object_up[2]=1;
  assert(!controller_object_transfer_release_safe(&placed,1,0,.3));
  assert(!controller_object_transfer_release_safe(&placed,1,.1,0));
  assert(!controller_object_transfer_release_safe(&placed,1,NAN,0));
  double platform[3]={};
  controller_object_transfer_platform_pose(1.0,2.0,0.102,0.0,platform);
  assert(std::fabs(platform[0]-0.93)<0.001);
  assert(std::fabs(platform[1]-2.075)<0.001);
  assert(std::fabs(platform[2]-0.2255)<0.001);
  assert(controller_object_transfer_object_on_platform(1.0,2.0,0.102,0.0,0.93,2.075,0.2255));
  assert(!controller_object_transfer_object_on_platform(1.0,2.0,0.102,0.0,1.1,2.0,0.2255));
  controller_object_transfer_platform_pose(1.0,2.0,0.102,1.5707963267948966,platform);
  assert(std::fabs(platform[0]-0.925)<0.001);
  assert(std::fabs(platform[1]-1.93)<0.001);
  ControllerObjectTransferRuntime transfer={};
  ControllerRuntime navigation={};
  transfer.navigation=&navigation;
  transfer.service.state=placed;
  assert(!controller_object_transfer_floor_supported(&transfer,0,0,0));
  assert(controller_object_transfer_floor_supported(&transfer,1,0,0));
  // Webots may stop reporting contacts when a stationary body goes to sleep.
  assert(controller_object_transfer_floor_supported(&transfer,0,0,0));
  transfer.service.state.object_pose[2]+=.004;
  assert(!controller_object_transfer_floor_supported(&transfer,0,0,0));
  transfer.service.state=placed;
  assert(controller_object_transfer_floor_supported(&transfer,1,0,0));
  assert(!controller_object_transfer_floor_supported(&transfer,0,.1,0));
  transfer.service.state={};
  assert(!controller_object_transfer_runtime_set_pose(&transfer,"pre_grasp",0));
  transfer.service.state.sensors_valid=1;
  const double parked[]={0,1.57,-2.635,1.78,0};
  std::memcpy(transfer.service.state.joint_positions,parked,sizeof(parked));
  assert(controller_object_transfer_runtime_set_pose(&transfer,"pre_grasp",0));
  assert(transfer.manipulator.pose==CONTROLLER_MANIPULATOR_PRE_GRASP);
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  assert(!controller_object_transfer_runtime_set_pose(&transfer,"invalid",0));
  transfer.manual_active=0;
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.status=CONTROLLER_TRANSFER_RUNNING;
  transfer.service.state.stage=CONTROLLER_TRANSFER_APPROACHING_OBJECT;
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.stage=CONTROLLER_TRANSFER_GRASPING;
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.stage=CONTROLLER_TRANSFER_TRANSPORTING;
  transfer.service.state.sensors_valid=0;
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.sensors_valid=1;
  transfer.service.state.on_platform=1;
  transfer.service.state.joint_positions[0]=1.2;
  transfer.service.state.finger_positions[0]=transfer.service.state.finger_positions[1]=.025;
  assert(controller_object_transfer_runtime_allows_navigation(&transfer));
  transfer.service.state.joint_positions[1]=.5;
  assert(!controller_object_transfer_runtime_allows_navigation(&transfer));
  assert(!controller_object_transfer_runtime_set_pose(&transfer,"pre_grasp",1));
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
