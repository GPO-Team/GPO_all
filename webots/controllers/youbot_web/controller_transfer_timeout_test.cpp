#include "controller_transfer_route.h"
#include "controller_object_transfer_service.h"
#include <cassert>
#include <cmath>

int main() {
  RouteData route={};route.count=1;route.waypoints[0]={15,0,0,1};
  const double budget=controller_transfer_route_timeout(&route,0,0,0,.06,.10);
  assert(std::isfinite(budget) && budget>15/.06);
  assert(controller_transfer_route_timeout(&route,0,0,0,.03,.10)>budget);
  assert(controller_transfer_route_timeout(&route,0,0,3.14,.06,.10)>budget);
  ControllerObjectTransferService service={};
  assert(controller_object_transfer_service_start(&service,"long-route","demo-box",15,0,0));
  service.state.stage=CONTROLLER_TRANSFER_TRANSPORTING;
  service.state.attached=1;service.state.navigation_timeout=budget;
  ControllerObjectTransferInput input={};input.attached=1;input.navigation_progress=1;
  ControllerObjectTransferOutput output={};
  controller_object_transfer_service_step(&service,&input,181,&output);
  assert(service.state.status==CONTROLLER_TRANSFER_RUNNING);
  controller_object_transfer_service_step(&service,&input,budget+1,&output);
  assert(service.state.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY);
  // A larger budget must not turn a stationary robot into an endless mission.
  controller_object_transfer_service_init(&service);
  assert(controller_object_transfer_service_start(&service,"stalled","demo-box",15,0,0));
  service.state.navigation_timeout=1000;
  input={};
  controller_object_transfer_service_step(&service,&input,61,&output);
  assert(service.state.status==CONTROLLER_TRANSFER_FAILED);
}
