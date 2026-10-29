#include "controller_manipulator.h"
#include <cassert>
#include <cmath>

struct Obstacle {double x,y,z,r;int samples;};
static int clear(void *context,const double point[3],double radius) {
  auto *o=static_cast<Obstacle *>(context);++o->samples;
  return std::hypot(std::hypot(point[0]-o->x,point[1]-o->y),point[2]-o->z)>o->r+radius;
}
int main() {
  ControllerManipulator arm={};
  const double source[]={.4,-.1,-.047},destination[]={.4,.1,-.047};
  assert(controller_manipulator_start(&arm,source,destination));
  for(const auto &pose:arm.poses) assert(fabs(pose[0]-pose[4])<1e-9);
  ControllerManipulator rotated={};rotated.grip_yaw=.3;
  assert(controller_manipulator_start(&rotated,source,destination));
  for(const auto &pose:rotated.poses) assert(fabs(pose[0]-pose[4]-.3)<1e-9);
  // A mobile pickup may face the object from the opposite side. Parallel jaws
  // are equivalent after a half turn; do not exceed the wrist limits.
  ControllerManipulator opposite={};opposite.grip_yaw=2.7186;
  assert(controller_manipulator_start(&opposite,source,destination));
  for(const auto &pose:opposite.poses)
    assert(fabs(std::remainder(pose[0]-pose[4]-opposite.grip_yaw,3.14159265358979323846))<1e-9);
  Obstacle obstacle={5,5,5,.02,0};
  assert(controller_manipulator_motion_clear(arm.poses[1],arm.poses[3],.05,clear,&obstacle));
  assert(obstacle.samples>10);
  // Both endpoints are free, but a carried load crosses an obstacle mid-swing.
  double middle[5];for(int i=0;i<5;++i) middle[i]=(arm.poses[1][i]+arm.poses[3][i])*.5;
  double tool[3];controller_manipulator_forward(middle,tool);
  obstacle={tool[0],tool[1],tool[2],.005,0};
  assert(!controller_manipulator_motion_clear(arm.poses[1],arm.poses[3],.05,clear,&obstacle));
  obstacle={destination[0],destination[1],destination[2],.02,0};
  assert(!controller_manipulator_motion_clear(arm.poses[3],arm.poses[2],.05,clear,&obstacle));
}
