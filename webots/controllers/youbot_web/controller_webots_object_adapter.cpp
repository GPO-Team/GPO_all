#include "controller_webots_object_adapter.h"
#include <webots/connector.h>
#include <webots/robot.h>
#include <cmath>
#include <cstring>
int controller_webots_object_adapter_init(ControllerWebotsObjectAdapter *a,const char *name) {
  if(!a || !name) return 0;
  std::memset(a,0,sizeof(*a)); a->node=wb_supervisor_node_get_from_def(name);
  a->connector=wb_robot_get_device("cargo_connector");
  if(a->connector) wb_connector_enable_presence(a->connector,16);
  return a->node!=nullptr && a->connector;
}
int controller_webots_object_adapter_position(const ControllerWebotsObjectAdapter *a,
    double *x,double *y,double *z) {
  if(!a || !a->node) return 0;
  const double *p=wb_supervisor_node_get_position(a->node);
  if(!p || !std::isfinite(p[0]) || !std::isfinite(p[1]) || !std::isfinite(p[2])) return 0;
  if(x) *x=p[0]; if(y) *y=p[1]; if(z) *z=p[2]; return 1;
}
void controller_webots_object_adapter_attach(ControllerWebotsObjectAdapter *a) {
  if(!a) return;
  if(a->connector && wb_connector_get_presence(a->connector)) wb_connector_lock(a->connector);
  a->attached=1;
}
void controller_webots_object_adapter_detach(ControllerWebotsObjectAdapter *a) {
  if(!a) return;
  if(a->connector) wb_connector_unlock(a->connector);
  a->attached=0;
}
int controller_webots_object_adapter_locked(const ControllerWebotsObjectAdapter *a) {
  return a && a->connector && wb_connector_is_locked(a->connector);
}
