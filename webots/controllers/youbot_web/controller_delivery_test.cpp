#include "controller_delivery.h"
#include "controller_webots_manipulator.h"
#include <assert.h>
#include <cmath>
#include <stdio.h>
#include <string.h>
static int open_space(void *context, double x, double y) { (void)context; return fabs(x)<21.5 && fabs(y)<16.5; }
static int wall(void *context, double x, double y) { return open_space(context,x,y) && !(x>0.3 && x<0.7 && fabs(y)<0.5); }
static int closed(void *context, double x, double y) { (void)context;(void)x;(void)y;return 0; }
static int round_obstacle(void *context,double x,double y) {return open_space(context,x,y) && hypot(x,y)>=.53;}
int main(void) {
  ControllerWebotsManipulator mission={};
  mission.delivery_phase=DELIVERY_FETCH;
  assert(controller_webots_manipulator_active(&mission));
  assert(strcmp(controller_webots_manipulator_stage(&mission),"driving_to_object")==0);
  mission.delivery_phase=DELIVERY_DRIVE;
  assert(strcmp(controller_webots_manipulator_stage(&mission),"carrying")==0);
  mission.delivery_phase=DELIVERY_TERMINAL;mission.state.stage=MANIPULATOR_CANCELLED;
  assert(!controller_webots_manipulator_active(&mission));
  mission.state.stage=MANIPULATOR_FAILED;
  assert(!controller_webots_manipulator_active(&mission));
  RouteData route={};
  assert(controller_delivery_plan(&route,0,0,1,1,open_space,NULL));
  assert(route.count==2 && route.waypoints[1].x==1 && route.waypoints[1].z==1);
  assert(controller_delivery_plan(&route,0,0,1,0,wall,NULL));
  assert(route.count>2);
  assert(route.count<=5); // Grid stair steps must not cause a turn every 20 cm.
  for(int i=1;i<route.count;++i)assert(controller_delivery_segment_clear(route.waypoints[i-1].x,route.waypoints[i-1].z,route.waypoints[i].x,route.waypoints[i].z,wall,NULL));
  // The real dock is free even when the nearest grid cell falls in its margin.
  assert(controller_delivery_plan(&route,-1,0,.236,.492,round_obstacle,NULL));
  for(int i=1;i<route.count;++i)assert(controller_delivery_segment_clear(route.waypoints[i-1].x,route.waypoints[i-1].z,route.waypoints[i].x,route.waypoints[i].z,round_obstacle,NULL));
  assert(!controller_delivery_plan(&route,0,0,1,0,closed,NULL));
  assert(!controller_delivery_plan(&route,NAN,0,1,0,open_space,NULL));
  assert(!controller_delivery_plan(&route,0,0,25,0,open_space,NULL));
  double velocity[3];
  controller_delivery_velocity(0,0,0,1,1,0,0.12,velocity);
  assert(velocity[0]==0 && velocity[1]==0 && velocity[2]>0);
  controller_delivery_velocity(0,0,1.5707963267948966,1,0,1.5707963267948966,0.12,velocity);
  assert(velocity[0]==0 && velocity[1]==0 && velocity[2]<0);
  controller_delivery_velocity(0,0,.7853981633974483,1,1,0,0.12,velocity);
  assert(velocity[0]>0 && velocity[1]==0 && fabs(velocity[2])<1e-9);
  controller_delivery_velocity(0,0,0,.02,.01,0,.12,velocity,1);
  assert(velocity[0]>0 && velocity[1]>0 && fabs(velocity[2])<1e-9);
  controller_delivery_velocity(0,0,0,0,.04,0,.12,velocity,0);
  assert(velocity[0]==0 && velocity[1]==0 && velocity[2]>0);
  controller_delivery_velocity(0,0,0,-.15,0,0,.08,velocity,0,1);
  assert(velocity[0]<0 && velocity[1]==0 && fabs(velocity[2])<1e-9);
  controller_delivery_velocity(0,0,0,0,0,0,0.12,velocity);
  assert(velocity[0]==0 && velocity[1]==0 && velocity[2]==0);
  puts("delivery path and velocity tests passed");
  return 0;
}
