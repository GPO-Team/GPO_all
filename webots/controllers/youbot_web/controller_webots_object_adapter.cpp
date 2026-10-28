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
void controller_webots_object_adapter_attach(ControllerWebotsObjectAdapter *a) {
  if(!a) return;
  // Ownership records a measured grasp; only finger contact physics holds the box.
  a->attached=1;
}
void controller_webots_object_adapter_detach(ControllerWebotsObjectAdapter *a) {
  if(!a) return;
  a->attached=0;
}
int controller_webots_object_adapter_contact(const WbContactPoint *object_points,int object_count,
    const WbContactPoint *robot_points,int robot_count,int finger_node_id) {
  if(!object_points || !robot_points || finger_node_id<0) return 0;
  for(int i=0;i<robot_count;++i) if(robot_points[i].node_id==finger_node_id)
    for(int j=0;j<object_count;++j)
      if(std::hypot(std::hypot(robot_points[i].point[0]-object_points[j].point[0],
          robot_points[i].point[1]-object_points[j].point[1]),
          robot_points[i].point[2]-object_points[j].point[2])<.001) return 1;
  return 0;
}
