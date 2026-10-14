#include "controller_webots_object_adapter.h"
#include <cmath>
#include <cstring>
int controller_webots_object_adapter_init(ControllerWebotsObjectAdapter *a,const char *name) {
  if(!a || !name) return 0;
  std::memset(a,0,sizeof(*a)); a->node=wb_supervisor_node_get_from_def(name);
  return a->node!=nullptr;
}
int controller_webots_object_adapter_position(const ControllerWebotsObjectAdapter *a,
    double *x,double *y,double *z) {
  if(!a || !a->node) return 0;
  const double *p=wb_supervisor_node_get_position(a->node);
  if(!p || !std::isfinite(p[0]) || !std::isfinite(p[1]) || !std::isfinite(p[2])) return 0;
  if(x) *x=p[0]; if(y) *y=p[1]; if(z) *z=p[2]; return 1;
}
// These flags track physical observations; they never constrain or reposition a body.
void controller_webots_object_adapter_attach(ControllerWebotsObjectAdapter *a) { if(a) a->attached=1; }
void controller_webots_object_adapter_detach(ControllerWebotsObjectAdapter *a) { if(a) a->attached=0; }
