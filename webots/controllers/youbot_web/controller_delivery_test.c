#include "controller_delivery.h"
#include "controller_webots_manipulator.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
static int open_space(void *context, double x, double y) { (void)context; return fabs(x)<21.5 && fabs(y)<16.5; }
static int wall(void *context, double x, double y) { return open_space(context,x,y) && !(x>0.3 && x<0.7 && fabs(y)<0.5); }
static int closed(void *context, double x, double y) { (void)context;(void)x;(void)y;return 0; }
int main(void) {
  ControllerWebotsManipulator mission={0};
  mission.delivery_phase=DELIVERY_FETCH;
  assert(controller_webots_manipulator_active(&mission));
  assert(strcmp(controller_webots_manipulator_stage(&mission),"driving_to_object")==0);
  mission.delivery_phase=DELIVERY_DRIVE;
  assert(strcmp(controller_webots_manipulator_stage(&mission),"carrying")==0);
  mission.delivery_phase=DELIVERY_TERMINAL;mission.state.stage=MANIPULATOR_CANCELLED;
  assert(!controller_webots_manipulator_active(&mission));
  mission.state.stage=MANIPULATOR_FAILED;
  assert(!controller_webots_manipulator_active(&mission));
  RouteData route={0};
  assert(controller_delivery_plan(&route,0,0,1,1,open_space,NULL));
  assert(route.count==2 && route.waypoints[1].x==1 && route.waypoints[1].z==1);
  assert(controller_delivery_plan(&route,0,0,1,0,wall,NULL));
  assert(route.count>2);
  for(int i=1;i<route.count;++i)assert(controller_delivery_segment_clear(route.waypoints[i-1].x,route.waypoints[i-1].z,route.waypoints[i].x,route.waypoints[i].z,wall,NULL));
  assert(!controller_delivery_plan(&route,0,0,1,0,closed,NULL));
  assert(!controller_delivery_plan(&route,NAN,0,1,0,open_space,NULL));
  assert(!controller_delivery_plan(&route,0,0,25,0,open_space,NULL));
  double velocity[3];
  controller_delivery_velocity(0,0,0,1,1,0,0.12,velocity);
  assert(fabs(hypot(velocity[0],velocity[1])-0.12)<1e-9);
  controller_delivery_velocity(0,0,1.5707963267948966,1,0,1.5707963267948966,0.12,velocity);
  assert(fabs(velocity[0])<1e-9 && velocity[1]<0);
  controller_delivery_velocity(0,0,0,0,0,0,0.12,velocity);
  assert(velocity[0]==0 && velocity[1]==0 && velocity[2]==0);
  puts("delivery path and velocity tests passed");
  return 0;
}
