#ifndef CONTROLLER_DELIVERY_H
#define CONTROLLER_DELIVERY_H
#include "controller_types.h"
typedef int (*ControllerDeliverySafe)(void *context,double x,double y);
int controller_delivery_segment_clear(double ax,double ay,double bx,double by,ControllerDeliverySafe safe,void *context);
int controller_delivery_plan(RouteData *route,double x,double y,double tx,double ty,ControllerDeliverySafe safe,void *context);
void controller_delivery_velocity(double x,double y,double yaw,double tx,double ty,double desired_yaw,double speed,double velocity[3]);
#endif
