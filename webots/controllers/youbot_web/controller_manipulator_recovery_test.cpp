#include "controller_manipulator.h"
#include <cassert>
#include <cstring>

static ControllerManipulator held_arm() {
  ControllerManipulator arm={};
  const double source[]={.4,-.1,-.047},destination[]={.4,.1,-.047};
  assert(controller_manipulator_start(&arm,source,destination));
  arm.stage=MANIPULATOR_TRANSFER;
  std::memcpy(arm.targets,arm.poses[3],sizeof(arm.targets));
  return arm;
}
static ControllerManipulatorSample measured(const ControllerManipulator &arm) {
  ControllerManipulatorSample sample={};sample.object_valid=1;
  std::memcpy(sample.joints,arm.targets,sizeof(sample.joints));
  controller_manipulator_forward(sample.joints,sample.object);
  sample.fingers[0]=sample.fingers[1]=.0045;
  return sample;
}
int main() {
  auto arm=held_arm();auto sample=measured(arm);
  controller_manipulator_cancel(&arm,&sample);
  assert(controller_manipulator_active(&arm));
  assert(!controller_manipulator_start(&arm,arm.source,arm.destination));
  const double opening=controller_manipulator_finger_target(&arm,0);
  controller_manipulator_step(&arm,&sample,30);
  assert(controller_manipulator_finger_target(&arm,0)==opening);
  arm=held_arm();sample=measured(arm);
  controller_manipulator_step(&arm,&sample,13);
  assert(arm.stage==MANIPULATOR_FAILED && controller_manipulator_active(&arm));
  assert(!controller_manipulator_start(&arm,arm.source,arm.destination));
  sample=measured(arm);
  assert(controller_manipulator_recover(&arm,&sample,arm.destination,1));
  controller_manipulator_cancel(&arm,&sample);
  assert(arm.stage==MANIPULATOR_TRANSFER); // Durable cancel retries must not restart unloading.
  for(int i=0;i<200 && controller_manipulator_active(&arm);++i) {
    sample=measured(arm);
    if(arm.stage>=MANIPULATOR_RELEASE) sample.fingers[0]=sample.fingers[1]=.025;
    sample.release_safe=1;
    if(arm.stage==MANIPULATOR_RETRACT || arm.stage==MANIPULATOR_STOW)
      std::memcpy(sample.object,arm.destination,sizeof(sample.object));
    controller_manipulator_step(&arm,&sample,.2);
  }
  assert(arm.stage==MANIPULATOR_CANCELLED && !controller_manipulator_active(&arm));
  assert(controller_manipulator_start(&arm,arm.source,arm.destination));
  arm=held_arm();sample=measured(arm);controller_manipulator_cancel(&arm,&sample);
  assert(controller_manipulator_recover(&arm,&sample,arm.destination,1));
  arm.stage=MANIPULATOR_LOWER;
  std::memcpy(arm.targets,arm.poses[2],sizeof(arm.targets));
  sample=measured(arm);sample.joints[1]+=.04;
  std::memcpy(sample.object,arm.destination,sizeof(sample.object));
  controller_manipulator_step(&arm,&sample,.2);
  assert(arm.stage==MANIPULATOR_LOWER); // No confirmed support, no release.
  sample.release_safe=1;
  controller_manipulator_step(&arm,&sample,.2);
  assert(arm.stage==MANIPULATOR_RELEASE);
  assert(controller_manipulator_finger_target(&arm,0)==.025);
  double before[3],after[3];
  controller_manipulator_forward(sample.joints,before);controller_manipulator_forward(arm.targets,after);
  assert(after[2]-before[2]>.0049 && after[2]-before[2]<.0051);
}
