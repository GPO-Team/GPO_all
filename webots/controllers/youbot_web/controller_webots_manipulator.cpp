#include "controller_webots_manipulator.h"
#include "controller_app_internal.h"
#include "controller_input_runtime.h"
#include "controller_navigation_runtime.h"
#include "controller_delivery.h"
#include "controller_webots_adapter.h"
#include <cmath>
#include <initializer_list>
#include <string.h>
#include <webots/motor.h>
#include <webots/position_sensor.h>
#include <webots/supervisor.h>
#include <webots/robot.h>
using std::isfinite;

// Grip 15 mm above the centre of a small box, leaving finger tips above the floor.
#define GRIP_OFFSET 0.015
static void guard_arm_motion(void);
static double cargo_floor_height(WbNodeRef cargo);

static double grip_yaw_in_base(WbNodeRef cargo, double base_yaw) {
  const double *rotation=cargo ? wb_supervisor_node_get_orientation(cargo) : NULL;
  return rotation ? std::remainder(atan2(rotation[3],rotation[0])-base_yaw,2*3.14159265358979323846) : 0;
}

static int world_to_local(const double world[3], double local[3]) {
  const double *base = wb_supervisor_node_get_position(webots_pose.self_node);
  const double *rotation = wb_supervisor_node_get_orientation(webots_pose.self_node);
  if (!base || !rotation) return 0;
  for (int i = 0; i < 3; ++i) {
    local[i] = 0;
    for (int j = 0; j < 3; ++j) local[i] += rotation[j * 3 + i] * (world[j] - base[j]);
  }
  return 1;
}

static ControllerManipulatorSample read_sample(void) {
  ControllerManipulatorSample sample = {};
  for (int i = 0; i < 5; ++i) {
    sample.joints[i] = webots_devices.arm_sensors[i] ? wb_position_sensor_get_value(webots_devices.arm_sensors[i]) : NAN;
  }
  for (int i = 0; i < 2; ++i) {
    sample.fingers[i] = webots_devices.finger_sensors[i] ? wb_position_sensor_get_value(webots_devices.finger_sensors[i]) : NAN;
  }
  sample.contacts_required = webots_devices.finger_contacts[0] && webots_devices.finger_contacts[1];
  if (sample.contacts_required) {
    double efforts[7];
    if (!controller_webots_devices_read_grip(&webots_devices, sample.contacts, efforts))
      sample.contacts[0] = sample.contacts[1] = NAN;
  }
  WbNodeRef object = wb_supervisor_node_get_from_def(controller_app.manipulator.object_def);
  const double *position = object ? wb_supervisor_node_get_position(object) : NULL;
  if (position) {
    memcpy(controller_app.manipulator.object_world, position, sizeof(controller_app.manipulator.object_world));
    double grip[3] = {position[0], position[1], position[2] + GRIP_OFFSET};
    sample.object_valid = world_to_local(grip, sample.object);
    auto *m=&controller_app.manipulator;
    if(m->state.cancel_pending && (m->state.stage==MANIPULATOR_LOWER || m->state.stage==MANIPULATOR_RELEASE)) {
      const double bottom=position[2]-cargo_floor_height(object);
      const double *velocity=wb_supervisor_node_get_velocity(object);
      int count=0,on_floor=0;
      const WbContactPoint *contacts=wb_supervisor_node_get_contact_points(object,false,&count);
      for(int i=0;contacts && i<count;++i) if(fabs(contacts[i].point[2])<.005) on_floor=1;
      const int supported=on_floor && isfinite(bottom) && fabs(bottom)<.006 && velocity &&
          hypot(hypot(velocity[0],velocity[1]),velocity[2])<.025 &&
          hypot(hypot(velocity[3],velocity[4]),velocity[5])<.15;
      const double now=wb_robot_get_time();
      if(!supported) m->support_stable_since=-1;
      else if(m->support_stable_since<0) m->support_stable_since=now;
      sample.release_safe=supported && now-m->support_stable_since>=.25;
    }
  }
  controller_app.manipulator.sample = sample;
  return sample;
}

static void apply_targets(void) {
  guard_arm_motion();
  const ControllerManipulator *arm = &controller_app.manipulator.state;
  ControllerWebotsManipulator *m = &controller_app.manipulator;
  if (arm->halt_motion) {
    for (int i = 0; i < 5; ++i) if (webots_devices.arm_joints[i]) wb_motor_set_velocity(webots_devices.arm_joints[i], 0);
    for (int i = 0; i < 2; ++i) if (webots_devices.gripper_fingers[i]) wb_motor_set_velocity(webots_devices.gripper_fingers[i], 0);
    return;
  }
  int changed = !m->trajectory_initialized;
  for (int i=0;i<5;++i) changed = changed || fabs(m->trajectory_target[i]-arm->targets[i]) > 1e-9;
  if (changed) {
    m->trajectory_started = wb_robot_get_time();
    m->trajectory_duration = 0.25;
    for (int i=0;i<5;++i) {
      m->trajectory_origin[i] = isfinite(m->sample.joints[i]) ? m->sample.joints[i] : arm->targets[i];
      m->trajectory_target[i] = arm->targets[i];
      m->trajectory_duration = fmax(m->trajectory_duration,1.5*fabs(arm->targets[i]-m->trajectory_origin[i])/0.6);
    }
    m->trajectory_initialized = 1;
  }
  const double t = fmax(0,fmin(1,(wb_robot_get_time()-m->trajectory_started)/m->trajectory_duration));
  const double blend = t*t*(3-2*t);
  for (int i = 0; i < 5; ++i) if (webots_devices.arm_joints[i] && isfinite(arm->targets[i])) {
    wb_motor_set_velocity(webots_devices.arm_joints[i], 0.6);
    const double minimum = wb_motor_get_min_position(webots_devices.arm_joints[i]);
    const double maximum = wb_motor_get_max_position(webots_devices.arm_joints[i]);
    const double target = m->trajectory_origin[i]+blend*(arm->targets[i]-m->trajectory_origin[i]);
    wb_motor_set_position(webots_devices.arm_joints[i], fmax(minimum, fmin(maximum, target)));
  }
  for (int i = 0; i < 2; ++i) if (webots_devices.gripper_fingers[i]) {
    wb_motor_set_velocity(webots_devices.gripper_fingers[i], 0.015);
    // The 40 g box needs little force; 20 N per finger excites the contact solver.
    wb_motor_set_available_force(webots_devices.gripper_fingers[i], 2.0);
    const double minimum = wb_motor_get_min_position(webots_devices.gripper_fingers[i]);
    const double maximum = wb_motor_get_max_position(webots_devices.gripper_fingers[i]);
    const double target = controller_manipulator_finger_target(arm, i);
    wb_motor_set_position(webots_devices.gripper_fingers[i], fmax(minimum, fmin(maximum, target)));
  }
}

typedef struct { double x,y,hx,hy; WbNodeRef node; double min_z,max_z; } DeliveryObstacle;
static DeliveryObstacle delivery_obstacles[256];
static int delivery_obstacle_count;
// Conservative sphere bounds also cover nested Group/Pose collision shapes.
static double geometry_radius(WbNodeRef node,int depth) {
  if(!node || depth>8)return NAN;
  const char *type=wb_supervisor_node_get_base_type_name(node);
  if(!type)return NAN;
  if(strcmp(type,"Box")==0) {
    const double *size=wb_supervisor_field_get_sf_vec3f(wb_supervisor_node_get_field(node,"size"));
    return size ? 0.5*hypot(hypot(size[0],size[1]),size[2]) : NAN;
  }
  if(strcmp(type,"Sphere")==0)return wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(node,"radius"));
  if(strcmp(type,"Cylinder")==0)return hypot(wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(node,"radius")),0.5*wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(node,"height")));
  if(strcmp(type,"Group")!=0 && strcmp(type,"Pose")!=0 && strcmp(type,"Transform")!=0)return NAN;
  WbFieldRef children=wb_supervisor_node_get_field(node,"children");
  double radius=0;
  for(int i=0;children && i<wb_supervisor_field_get_count(children);++i) {
    const double child=geometry_radius(wb_supervisor_field_get_mf_node(children,i),depth+1);
    if(!isfinite(child))return NAN;
    radius=fmax(radius,child);
  }
  WbFieldRef scaling=wb_supervisor_node_get_field(node,"scale");
  if(scaling) {const double *v=wb_supervisor_field_get_sf_vec3f(scaling);radius*=fmax(fabs(v[0]),fmax(fabs(v[1]),fabs(v[2])));}
  WbFieldRef translation=wb_supervisor_node_get_field(node,"translation");
  if(translation) {const double *v=wb_supervisor_field_get_sf_vec3f(translation);radius+=hypot(hypot(v[0],v[1]),v[2]);}
  return radius;
}
static double cargo_floor_height(WbNodeRef cargo) {
  if(!cargo) return NAN;
  WbFieldRef bounding=wb_supervisor_node_is_proto(cargo) ?
      wb_supervisor_node_get_base_node_field(cargo,"boundingObject") : wb_supervisor_node_get_field(cargo,"boundingObject");
  WbNodeRef geometry=bounding ? wb_supervisor_field_get_sf_node(bounding) : NULL;
  const double *rotation=wb_supervisor_node_get_orientation(cargo);
  const char *shape=geometry ? wb_supervisor_node_get_base_type_name(geometry) : NULL;
  if(!shape || !rotation) return NAN;
  // This world's support floor is z=0. Never reuse an elevated pickup height as a floor height.
  if(strcmp(shape,"Box")==0) {
    const double *size=wb_supervisor_field_get_sf_vec3f(wb_supervisor_node_get_field(geometry,"size"));
    return size ? .5*(fabs(rotation[6])*size[0]+fabs(rotation[7])*size[1]+fabs(rotation[8])*size[2]) : NAN;
  }
  if(strcmp(shape,"Sphere")==0) return wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(geometry,"radius"));
  if(strcmp(shape,"Cylinder")==0) {
    const double radius=wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(geometry,"radius"));
    const double height=wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(geometry,"height"));
    return radius*hypot(rotation[6],rotation[7])+.5*height*fabs(rotation[8]);
  }
  return NAN; // Unknown supports require recovery instead of an automatic release in mid-air.
}
static int refresh_obstacles(void) {
  delivery_obstacle_count=0;
  WbNodeRef root=wb_supervisor_node_get_root();
  WbFieldRef children=wb_supervisor_node_get_field(root,"children");
  WbNodeRef cargo=wb_supervisor_node_get_from_def(controller_app.manipulator.object_def);
  for(int i=0;i<wb_supervisor_field_get_count(children);++i) {
    WbNodeRef node=wb_supervisor_field_get_mf_node(children,i);
    const char *type=wb_supervisor_node_get_base_type_name(node);
    if(node==webots_pose.self_node || node==cargo || !type ||
        (strcmp(type,"Solid")!=0 && strcmp(type,"Robot")!=0) ||
        strcmp(wb_supervisor_node_get_type_name(node),"Floor")==0)continue;
    WbFieldRef bounding=wb_supervisor_node_is_proto(node) ?
        wb_supervisor_node_get_base_node_field(node,"boundingObject") : wb_supervisor_node_get_field(node,"boundingObject");
    WbNodeRef geometry=bounding ? wb_supervisor_field_get_sf_node(bounding) : NULL;
    if(!geometry)continue;
    const double *position=wb_supervisor_node_get_position(node);
    const double *rotation=wb_supervisor_node_get_orientation(node);
    double hx=0.5,hy=0.5,height=1.0;
    const char *shape=wb_supervisor_node_get_base_type_name(geometry);
    if(strcmp(shape,"Box")==0) {
      const double *size=wb_supervisor_field_get_sf_vec3f(wb_supervisor_node_get_field(geometry,"size"));
      hx=0.5*(fabs(rotation[0])*size[0]+fabs(rotation[1])*size[1]+fabs(rotation[2])*size[2]);
      hy=0.5*(fabs(rotation[3])*size[0]+fabs(rotation[4])*size[1]+fabs(rotation[5])*size[2]);
      height=fabs(rotation[6])*size[0]+fabs(rotation[7])*size[1]+fabs(rotation[8])*size[2];
    } else if(strcmp(shape,"Cylinder")==0 || strcmp(shape,"Sphere")==0) {
      hx=hy=wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(geometry,"radius"));
      height=strcmp(shape,"Sphere")==0 ? 2*hx : wb_supervisor_field_get_sf_float(wb_supervisor_node_get_field(geometry,"height"));
      if(strcmp(shape,"Cylinder")==0) {
        double radius=hx,half_height=height*0.5;
        hx=radius*hypot(rotation[0],rotation[1])+half_height*fabs(rotation[2]);
        hy=radius*hypot(rotation[3],rotation[4])+half_height*fabs(rotation[5]);
        height=2*(radius*hypot(rotation[6],rotation[7])+half_height*fabs(rotation[8]));
      }
    } else {
      hx=hy=geometry_radius(geometry,0);height=2*hx;
      if(!isfinite(hx) || hx<=0)return 0;
    }
    if(position[2]+height*0.5<=0.02)continue;
    if(delivery_obstacle_count>=256)return 0;
    delivery_obstacles[delivery_obstacle_count++]=DeliveryObstacle{position[0],position[1],hx,hy,node,
        position[2]-height*.5,position[2]+height*.5};
  }
  return 1;
}
static int delivery_safe(void *context,double x,double y) {
  const ControllerWebotsManipulator *m = static_cast<const ControllerWebotsManipulator *>(context);
  const double clearance=m->delivery_clearance;
  if(fabs(x)>21.4-clearance || fabs(y)>16.4-clearance)return 0;
  for(int i=0;i<controller_runtime.limit_zones.count;++i) {
    const LimitZone *zone=&controller_runtime.limit_zones.zones[i];
    if(i==m->room_zone_index) {
      if(!controller_zone_geometry_point_in(x,y,zone) || controller_zone_geometry_point_near_boundary(x,y,zone,clearance))return 0;
    } else if(controller_zone_geometry_point_near(x,y,zone,clearance))return 0;
  }
  for(int i=0;i<delivery_obstacle_count;++i) {
    const DeliveryObstacle *o=&delivery_obstacles[i];
    double dx=fmax(0,fabs(x-o->x)-o->hx),dy=fmax(0,fabs(y-o->y)-o->hy);
    const double separation=hypot(dx,dy);
    if(separation<clearance) {
      // Retreat only from the box just placed, never move closer or ignore it
      // for the rest of the mission. All other obstacles keep their margins.
      if(!m->departing || o->node!=m->departure_node ||
          separation+0.002<m->departure_min_separation)return 0;
    }
  }
  return 1;
}
static int placement_clear(const double world[3]) {
  auto *m=&controller_app.manipulator;
  const double clearance=m->delivery_clearance;const int departing=m->departing;
  m->delivery_clearance=m->cargo_radius+.01;m->departing=0;
  const int safe=refresh_obstacles() && delivery_safe(m,world[0],world[1]);
  m->delivery_clearance=clearance;m->departing=departing;return safe;
}
typedef struct {double base[3],rotation[9];} ArmSafetyPose;
static int read_safety_pose(ArmSafetyPose *pose) {
  const double *base=wb_supervisor_node_get_position(webots_pose.self_node);
  const double *rotation=wb_supervisor_node_get_orientation(webots_pose.self_node);
  if(!base || !rotation) return 0;
  memcpy(pose->base,base,sizeof(pose->base));memcpy(pose->rotation,rotation,sizeof(pose->rotation));return 1;
}
static int arm_point_clear(void *context,const double local[3],double radius) {
  const auto *m=&controller_app.manipulator;
  const auto *pose=static_cast<const ArmSafetyPose *>(context);
  const double *base=pose->base,*rotation=pose->rotation;
  double world[3];for(int i=0;i<3;++i) {
    world[i]=base[i];for(int j=0;j<3;++j) world[i]+=rotation[i*3+j]*local[j];
    if(!isfinite(world[i])) return 0;
  }
  if(fabs(world[0])>21.4-radius || fabs(world[1])>16.4-radius) return 0;
  for(int i=0;i<controller_runtime.limit_zones.count;++i) {
    const auto *zone=&controller_runtime.limit_zones.zones[i];
    if(i==m->room_zone_index) {
      if(!controller_zone_geometry_point_in(world[0],world[1],zone) ||
          controller_zone_geometry_point_near_boundary(world[0],world[1],zone,radius)) return 0;
    } else if(controller_zone_geometry_point_near(world[0],world[1],zone,radius)) return 0;
  }
  for(int i=0;i<delivery_obstacle_count;++i) {
    const auto &o=delivery_obstacles[i];
    const double dx=fmax(0,fabs(world[0]-o.x)-o.hx),dy=fmax(0,fabs(world[1]-o.y)-o.hy);
    const double dz=fmax(0,fmax(o.min_z-world[2],world[2]-o.max_z));
    if(hypot(hypot(dx,dy),dz)<radius) return 0;
  }
  return 1;
}
static int arm_plan_clear(const ControllerManipulator *arm,const ControllerManipulatorSample *sample,int recovery) {
  ArmSafetyPose pose;
  if(!refresh_obstacles() || !read_safety_pose(&pose)) return 0;
  const double parked[]={0,1.57,-2.635,1.78,0};
  const double *full[]={sample->joints,arm->poses[1],arm->poses[0],arm->poses[1],
      arm->poses[3],arm->poses[2],arm->poses[3],parked};
  const double *unload[]={sample->joints,arm->poses[3],arm->poses[2],arm->poses[3],parked};
  const double **path=recovery ? unload : full;
  const int count=recovery ? 5 : 8;
  for(int i=1;i<count;++i)
    if(!controller_manipulator_motion_clear(path[i-1],path[i],controller_app.manipulator.cargo_radius+GRIP_OFFSET,
        arm_point_clear,&pose)) return 0;
  return 1;
}
static int prepare_departure(double x,double y,double yaw,const ControllerManipulatorSample *sample) {
  ControllerWebotsManipulator *m=&controller_app.manipulator;
  m->delivery_clearance=.36;m->departing=0;m->departure_node=NULL;
  if(!refresh_obstacles())return 0;
  if(delivery_safe(m,x,y))return 1;
  const auto &previous=object_transfer_runtime.service.state;
  const double parked[]={0,1.57,-2.635,1.78,0};
  if((previous.status!=CONTROLLER_TRANSFER_COMPLETED && previous.status!=CONTROLLER_TRANSFER_CANCELLED) ||
      previous.attached || !previous.release_evidence)return 0;
  for(int i=0;i<5;++i)if(fabs(sample->joints[i]-parked[i])>.05)return 0;
  for(int i=0;i<delivery_obstacle_count;++i) {
    const auto &o=delivery_obstacles[i];
    if(o.node!=object_transfer_runtime.object.node)continue;
    m->departure_node=o.node;
    m->departure_min_separation=hypot(fmax(0,fabs(x-o.x)-o.hx),fmax(0,fabs(y-o.y)-o.hy));
    m->departure_yaw=yaw;m->departing=1;
    for(double retreat=.10;retreat<=.60;retreat+=.05) {
      const double tx=x-cos(yaw)*retreat,ty=y-sin(yaw)*retreat;
      m->departing=0;const int safe_end=delivery_safe(m,tx,ty);m->departing=1;
      if(safe_end && controller_delivery_segment_clear(x,y,tx,ty,delivery_safe,m)) {
        m->departure_target[0]=tx;m->departure_target[1]=ty;return 1;
      }
    }
    break;
  }
  m->departing=0;m->departure_node=NULL;return 0;
}
static void hold_sample(ControllerManipulator *arm,const ControllerManipulatorSample *sample) {
  arm->hold_fingers=1;arm->halt_motion=0;
  for(int i=0;i<5;++i) {
    if(isfinite(sample->joints[i]))arm->targets[i]=sample->joints[i];else arm->halt_motion=1;
  }
  for(int i=0;i<2;++i) {
    if(isfinite(sample->fingers[i]))arm->held_fingers[i]=fmax(0,fmin(0.025,sample->fingers[i]));else arm->halt_motion=1;
  }
}
static void delivery_fail(const ControllerManipulatorSample *sample,const char *error) {
  ControllerWebotsManipulator *m=&controller_app.manipulator;
  int loaded=m->state.load_held || m->delivery_phase==DELIVERY_DRIVE ||
      (m->state.stage>=MANIPULATOR_CLOSE && m->state.stage<=MANIPULATOR_RELEASE);
  hold_sample(&m->state,sample);m->state.stage=MANIPULATOR_FAILED;m->state.error=error;
  m->state.load_held=m->state.load_held || loaded;
  if(loaded && !m->state.halt_motion){m->state.hold_fingers=0;m->state.finger_target=0;}
  m->delivery_phase=DELIVERY_TERMINAL;
  controller_webots_devices_reset_wheels(&webots_devices);
}
static void guard_arm_motion(void) {
  auto *m=&controller_app.manipulator;
  ArmSafetyPose pose;
  if(m->delivery_phase!=DELIVERY_FETCH && m->delivery_phase!=DELIVERY_DRIVE &&
      m->state.stage>=MANIPULATOR_OPEN && m->state.stage<=MANIPULATOR_STOW &&
      (!refresh_obstacles() || !read_safety_pose(&pose) ||
       !controller_manipulator_motion_clear(m->sample.joints,m->state.targets,
          m->cargo_radius+GRIP_OFFSET,arm_point_clear,&pose))) delivery_fail(&m->sample,"manipulator_path_blocked");
}
static void dock_position(const double object[3],int pickup,double dock[2]) {
  double yaw=controller_app.manipulator.delivery_yaw,oy=pickup ? -0.1 : 0.1;
  dock[0]=object[0]-(cos(yaw)*0.4-sin(yaw)*oy);
  dock[1]=object[1]-(sin(yaw)*0.4+cos(yaw)*oy);
}
static int dock_reachable(const double world[3],int pickup) {
  const double *base=wb_supervisor_node_get_position(webots_pose.self_node);
  const double *rotation=wb_supervisor_node_get_orientation(webots_pose.self_node);
  double dock[2],local[3]={0},delta[3],angles[5];dock_position(world,pickup,dock);
  delta[0]=world[0]-dock[0];delta[1]=world[1]-dock[1];delta[2]=world[2]+GRIP_OFFSET-base[2];
  double x,y,current_yaw;read_pose(&x,&y,&current_yaw);
  const double turn=controller_app.manipulator.delivery_yaw-current_yaw;
  const double dx=delta[0],dy=delta[1];
  delta[0]=cos(turn)*dx+sin(turn)*dy;
  delta[1]=-sin(turn)*dx+cos(turn)*dy;
  for(int i=0;i<3;++i)for(int j=0;j<3;++j)local[i]+=rotation[j*3+i]*delta[j];
  if(!controller_manipulator_inverse(local,angles))return 0;
  local[2]+=0.08;return controller_manipulator_inverse(local,angles);
}
static int plan_drive(const double world[3],int pickup) {
  ControllerWebotsManipulator *m=&controller_app.manipulator;
  m->delivery_yaw=pickup ? m->pickup_yaw : m->placement_yaw;
  double x,y,yaw,dock[2];read_pose(&x,&y,&yaw);dock_position(world,pickup,dock);
  m->delivery_clearance=pickup ? .36 : .53;
  const int departing=pickup && m->departing;
  m->departing=0;
  const int planned=refresh_obstacles() && controller_delivery_plan(&controller_runtime.route,
      departing ? m->departure_target[0] : x,departing ? m->departure_target[1] : y,
      dock[0],dock[1],delivery_safe,m);
  m->departing=departing;
  if(!planned)return 0;
  if(departing) {
    if(controller_runtime.route.count>=MAX_WAYPOINTS)return 0;
    memmove(controller_runtime.route.waypoints+1,controller_runtime.route.waypoints,
        controller_runtime.route.count*sizeof(Waypoint));
    controller_runtime.route.waypoints[0]=Waypoint{x,y,0,0};
    ++controller_runtime.route.count;
  }
  double length=0;for(int i=1;i<controller_runtime.route.count;++i)length+=hypot(controller_runtime.route.waypoints[i].x-controller_runtime.route.waypoints[i-1].x,controller_runtime.route.waypoints[i].z-controller_runtime.route.waypoints[i-1].z);
  double turns=0,last_heading=yaw;
  for(int i=1;i<controller_runtime.route.count;++i) {
    const auto &a=controller_runtime.route.waypoints[i-1],&b=controller_runtime.route.waypoints[i];
    if(hypot(b.x-a.x,b.z-a.z)<.008)continue;
    const double bearing=atan2(b.z-a.z,b.x-a.x);
    if(!(departing && i==1)) {turns+=fabs(atan2(sin(bearing-last_heading),cos(bearing-last_heading)));last_heading=bearing;}
  }
  turns+=fabs(atan2(sin(m->delivery_yaw-last_heading),cos(m->delivery_yaw-last_heading)));
  const double angular=fmax(.01,fmin(active_angular_speed_limit,pickup ? .30 : .10));
  m->delivery_waypoint=1;m->delivery_elapsed=0;m->drive_timeout=30+length/0.03+turns/angular;
  controller_runtime.current_waypoint_index=1;
  m->delivery_phase=pickup ? DELIVERY_FETCH : DELIVERY_DRIVE;
  return 1;
}
static int destination_clear(const double world[3]) {
  ControllerWebotsManipulator *m=&controller_app.manipulator;
  double dock[2];dock_position(world,0,dock);
  const double clearance=m->delivery_clearance;const int departing=m->departing;
  m->delivery_clearance=.53;m->departing=0;
  const int safe=refresh_obstacles() && delivery_safe(m,dock[0],dock[1]);
  m->delivery_clearance=clearance;m->departing=departing;return safe;
}
static int select_placement_heading(void) {
  ControllerWebotsManipulator *m=&controller_app.manipulator;
  const double pickup_heading=m->delivery_yaw;
  double source_dock[2];dock_position(m->object_world,1,source_dock);
  const double preferred=atan2(m->destination_world[1]-source_dock[1],m->destination_world[0]-source_dock[0]);
  const double pi=3.14159265358979323846;
  int reachable=0;
  double best_cost=INFINITY,best_heading=pickup_heading;
  for(double offset : {0.0,pi/4,-pi/4,pi/2,-pi/2,pi}) {
    m->delivery_yaw=atan2(sin(preferred+offset),cos(preferred+offset));
    if(!dock_reachable(m->destination_world,0))continue;
    reachable=1;
    if(destination_clear(m->destination_world)) {
      double goal[2];dock_position(m->destination_world,0,goal);
      RouteData candidate={};
      const double clearance=m->delivery_clearance;const int departing=m->departing;
      m->delivery_clearance=.53;m->departing=0;
      const int planned=controller_delivery_plan(&candidate,source_dock[0],source_dock[1],goal[0],goal[1],delivery_safe,m);
      m->delivery_clearance=clearance;m->departing=departing;
      if(!planned)continue;
      double length=0,turns=0,last_heading=pickup_heading;
      for(int i=1;i<candidate.count;++i) {
        const auto &a=candidate.waypoints[i-1],&b=candidate.waypoints[i];
        const double leg=hypot(b.x-a.x,b.z-a.z);length+=leg;
        if(leg<.008)continue;
        const double heading=atan2(b.z-a.z,b.x-a.x);
        turns+=fabs(atan2(sin(heading-last_heading),cos(heading-last_heading)));last_heading=heading;
      }
      turns+=fabs(atan2(sin(m->delivery_yaw-last_heading),cos(m->delivery_yaw-last_heading)));
      // Prefer a short trip with few turns, including the actual final alignment.
      const double cost=length/.10+turns/.10;
      if(cost<best_cost){best_cost=cost;best_heading=m->delivery_yaw;}
    }
  }
  m->delivery_yaw=pickup_heading;
  if(isfinite(best_cost)){m->placement_yaw=best_heading;return 2;}
  return reachable;
}
void controller_webots_manipulator_start(const RuntimeCommand *command) {
  if (!command) return;
  ControllerWebotsManipulator *manipulator = &controller_app.manipulator;
  if (controller_webots_manipulator_busy() ||
      (!controller_runtime.route_finished && controller_runtime.route.count > 0)) return;
  strcpy(manipulator->mission_id, command->mission_id);
  strcpy(manipulator->object_def, command->object_def);
  strcpy(controller_runtime.route.command_id, command->mission_id);
  controller_runtime.route.count = 0;
  controller_runtime.mapping_survey.route_active = 0;
  controller_runtime.route_finished = 0;
  controller_runtime.avoidance.active = 0;
  reset_navigation_mode();
  controller_webots_devices_reset_wheels(&webots_devices);
  manipulator->delivery_phase=DELIVERY_IDLE;manipulator->mobile=0;
  manipulator->support_stable_since=-1;
  manipulator->delivery_clearance=.36;manipulator->departing=0;manipulator->departure_node=NULL;
  manipulator->destination_world[0]=command->target_x;
  manipulator->destination_world[1]=command->target_y;
  manipulator->destination_world[2]=command->target_z;
  double x,y,yaw;read_pose(&x,&y,&yaw);
  manipulator->delivery_yaw=manipulator->pickup_yaw=manipulator->placement_yaw=yaw;
  manipulator->room_zone_index=controller_zone_geometry_find_room(&controller_runtime.limit_zones,x,y);
  ControllerManipulatorSample sample = read_sample();
  WbNodeRef cargo=wb_supervisor_node_get_from_def(manipulator->object_def);
  manipulator->state.grip_yaw=grip_yaw_in_base(cargo,yaw);
  manipulator->support_z=cargo_floor_height(cargo);
  WbFieldRef bounding=cargo ? (wb_supervisor_node_is_proto(cargo) ? wb_supervisor_node_get_base_node_field(cargo,"boundingObject") : wb_supervisor_node_get_field(cargo,"boundingObject")) : NULL;
  manipulator->cargo_radius=geometry_radius(bounding ? wb_supervisor_field_get_sf_node(bounding) : NULL,0);
  const double target[3] = {command->target_x, command->target_y, command->target_z + GRIP_OFFSET};
  double destination[3];
  int valid = sample.object_valid && world_to_local(target, destination);
  for (int i = 0; i < 5; ++i) valid = valid && webots_devices.arm_joints[i] && isfinite(sample.joints[i]);
  for (int i = 0; i < 2; ++i) valid = valid && webots_devices.gripper_fingers[i] && isfinite(sample.fingers[i]);
  for (int i = 0; i < 5; ++i) if (isfinite(sample.joints[i])) manipulator->state.targets[i] = sample.joints[i];
  if(!valid)delivery_fail(&sample,!sample.object_valid ? "object_missing" : "devices_unavailable");
  else if(!isfinite(manipulator->cargo_radius) || manipulator->cargo_radius<=0) delivery_fail(&sample,"unsupported_object_geometry");
  else if(!placement_clear(manipulator->destination_world)) delivery_fail(&sample,"delivery_path_blocked");
  else if(controller_manipulator_start(&manipulator->state,sample.object,destination)) {
    if(!arm_plan_clear(&manipulator->state,&sample,0)) delivery_fail(&sample,"manipulator_path_blocked");
    else manipulator->delivery_phase=DELIVERY_PICK;
  }
  else {
    manipulator->mobile=1;
    if(!prepare_departure(x,y,yaw,&sample))delivery_fail(&sample,"delivery_path_blocked");
    else {
      const double preferred=atan2(manipulator->object_world[1]-y,manipulator->object_world[0]-x);
      const double pi=3.14159265358979323846;
      int feasible=0,source_reachable=0,target_reachable=0;
      for(double offset : {0.0,pi/4,-pi/4,pi/2,-pi/2,pi}) {
        manipulator->delivery_yaw=atan2(sin(preferred+offset),cos(preferred+offset));
        if(!dock_reachable(manipulator->object_world,1))continue;
        source_reachable=1;
        const int placement=select_placement_heading();
        if(placement)target_reachable=1;
        if(placement==2){manipulator->pickup_yaw=manipulator->delivery_yaw;feasible=1;break;}
      }
      hold_sample(&manipulator->state,&sample);manipulator->state.stage=MANIPULATOR_IDLE;manipulator->state.error="";
      if(!feasible)delivery_fail(&sample,!source_reachable ? "source_unreachable" : !target_reachable ? "target_unreachable" : "delivery_path_blocked");
      else if(!manipulator->departing && controller_manipulator_start(&manipulator->state,sample.object,sample.object))manipulator->delivery_phase=DELIVERY_PICK;
      else if(!plan_drive(manipulator->object_world,1))delivery_fail(&sample,"delivery_path_blocked");
    }
  }
  set_error("");
  set_status("manipulator_running");
}

void controller_webots_manipulator_cancel(const char *mission_id) {
  ControllerWebotsManipulator *manipulator = &controller_app.manipulator;
  if (!mission_id || strcmp(mission_id, manipulator->mission_id) != 0) return;
  if(manipulator->state.cancel_pending && manipulator->state.stage>=MANIPULATOR_OPEN &&
      manipulator->state.stage<=MANIPULATOR_STOW) return;
  ControllerManipulatorSample sample = read_sample();
  if(!controller_webots_manipulator_active(manipulator))return;
  int loaded=manipulator->state.load_held || manipulator->delivery_phase==DELIVERY_DRIVE ||
      (manipulator->state.stage>=MANIPULATOR_LIFT && manipulator->state.stage<=MANIPULATOR_RELEASE);
  controller_manipulator_cancel(&manipulator->state,&sample);
  hold_sample(&manipulator->state,&sample);
  if(loaded && !manipulator->state.halt_motion){manipulator->state.hold_fingers=0;manipulator->state.finger_target=0;}
  manipulator->state.stage=MANIPULATOR_CANCELLED;
  manipulator->state.load_held=manipulator->state.load_held || loaded;
  manipulator->delivery_phase=DELIVERY_TERMINAL;
  if(manipulator->state.load_held) {
    manipulator->support_z=cargo_floor_height(wb_supervisor_node_get_from_def(manipulator->object_def));
    const double world[]={manipulator->object_world[0],manipulator->object_world[1],manipulator->support_z};
    const double grip[]={world[0],world[1],world[2]+GRIP_OFFSET};double local[3];
    ControllerManipulator recovery=manipulator->state;
    if(placement_clear(world) && world_to_local(grip,local) &&
        controller_manipulator_recover(&recovery,&sample,local,1) && arm_plan_clear(&recovery,&sample,1)) {
      manipulator->state=recovery;manipulator->mobile=0;manipulator->delivery_phase=DELIVERY_PLACE;
      manipulator->support_stable_since=-1;
      memcpy(manipulator->destination_world,world,sizeof(world));
    } else manipulator->state.error="unsafe_release";
  }
  apply_targets();
  controller_webots_devices_reset_wheels(&webots_devices);
}

int controller_webots_manipulator_busy(void) {
  return controller_webots_manipulator_active(&controller_app.manipulator);
}
int controller_webots_manipulator_active(const ControllerWebotsManipulator *m) {
  return m && (m->delivery_phase==DELIVERY_FETCH || m->delivery_phase==DELIVERY_DRIVE || controller_manipulator_active(&m->state));
}
const char *controller_webots_manipulator_stage(const ControllerWebotsManipulator *m) {
  if(m->state.load_held && (m->state.stage==MANIPULATOR_FAILED || m->state.stage==MANIPULATOR_CANCELLED))
    return "holding_for_recovery";
  if(m->delivery_phase==DELIVERY_FETCH)return "driving_to_object";
  if(m->delivery_phase==DELIVERY_DRIVE)return "carrying";
  return controller_manipulator_stage_name(m->state.stage);
}

int controller_webots_manipulator_step(double dt) {
  ControllerWebotsManipulator *manipulator = &controller_app.manipulator;
  if (!manipulator->mission_id[0]) return 0;
  if (strcmp(manipulator->mission_id, controller_runtime.route.command_id) != 0) {
    if (!controller_webots_manipulator_active(manipulator)) return 0;
    // Active manipulation owns all robot motion, even if another input replaced runtime state.
    strcpy(controller_runtime.route.command_id, manipulator->mission_id);
    controller_runtime.route.count = 0;
    controller_runtime.mapping_survey.route_active = 0;
    controller_runtime.avoidance.active = 0;
  }
  ControllerManipulatorSample sample = read_sample();
  if(manipulator->delivery_phase==DELIVERY_FETCH || manipulator->delivery_phase==DELIVERY_DRIVE) {
    int carrying=manipulator->delivery_phase==DELIVERY_DRIVE;
    double x,y,yaw;read_pose(&x,&y,&yaw);
    if(!sample.object_valid)delivery_fail(&sample,"object_missing");
    if(!isfinite(x) || !isfinite(y) || !isfinite(yaw))delivery_fail(&sample,"invalid_sensor");
    for(int i=0;i<3;++i)if(!isfinite(sample.object[i]))delivery_fail(&sample,"invalid_sensor");
    for(int i=0;i<5;++i)if(!isfinite(sample.joints[i]))delivery_fail(&sample,"invalid_sensor");
    for(int i=0;i<2;++i)if(!isfinite(sample.fingers[i]))delivery_fail(&sample,"invalid_sensor");
    if(carrying) {
      double tool[3];controller_manipulator_forward(sample.joints,tool);
      if(hypot(hypot(tool[0]-sample.object[0],tool[1]-sample.object[1]),tool[2]-sample.object[2])>0.055)delivery_fail(&sample,"object_lost");
    }
    manipulator->delivery_elapsed+=dt;
    if(manipulator->delivery_elapsed>manipulator->drive_timeout)delivery_fail(&sample,"delivery_timeout");
    if(controller_webots_manipulator_active(manipulator)) {
      Waypoint target=controller_runtime.route.waypoints[manipulator->delivery_waypoint];
      double distance=hypot(target.x-x,target.z-y);
      const double desired_yaw=manipulator->departing ? manipulator->departure_yaw : manipulator->delivery_yaw;
      const int final_waypoint=manipulator->delivery_waypoint+1>=controller_runtime.route.count;
      controller_runtime.distance_to_target=distance;
      if(distance<0.008 && ((!final_waypoint && !manipulator->departing) ||
          fabs(atan2(sin(yaw-desired_yaw),cos(yaw-desired_yaw)))<0.012)) {
        controller_webots_devices_reset_wheels(&webots_devices);
        if(manipulator->departing) {manipulator->departing=0;manipulator->departure_node=NULL;}
        if(++manipulator->delivery_waypoint>=controller_runtime.route.count) {
          controller_runtime.route.count=0;
          controller_runtime.current_waypoint_index=0;
          if(!carrying) {
            // The chassis has turned since mission submission; align the jaws
            // in the current base frame before solving the pickup poses.
            manipulator->state.grip_yaw=grip_yaw_in_base(
                wb_supervisor_node_get_from_def(manipulator->object_def),yaw);
            manipulator->state.hold_fingers=0;
            if(!controller_manipulator_start(&manipulator->state,sample.object,sample.object))delivery_fail(&sample,"source_unreachable");
            else manipulator->delivery_phase=DELIVERY_PICK;
          } else {
            double grip[3]={manipulator->destination_world[0],manipulator->destination_world[1],manipulator->destination_world[2]+GRIP_OFFSET};
            double local[3];world_to_local(grip,local);
            memcpy(manipulator->state.destination,local,sizeof(local));
            if(!controller_manipulator_inverse(local,manipulator->state.poses[2],manipulator->state.grip_yaw))delivery_fail(&sample,"target_unreachable");
            else {
              local[2]+=0.08;
              if(!controller_manipulator_inverse(local,manipulator->state.poses[3],manipulator->state.grip_yaw))delivery_fail(&sample,"target_approach_unreachable");
              else {
                manipulator->state.hold_fingers=0;manipulator->state.elapsed=manipulator->state.settled=0;
                memcpy(manipulator->state.targets,manipulator->state.poses[3],sizeof(manipulator->state.targets));
                manipulator->delivery_phase=DELIVERY_PLACE;
              }
            }
          }
        } else controller_runtime.current_waypoint_index=manipulator->delivery_waypoint;
      } else {
        double lookahead=fmin(distance,0.12),scale=distance>0 ? lookahead/distance : 0;
        if(!refresh_obstacles() || !controller_delivery_segment_clear(x,y,x+(target.x-x)*scale,y+(target.z-y)*scale,delivery_safe,manipulator))delivery_fail(&sample,"delivery_path_blocked");
        else {
          const double speed_limit=manipulator->departing ? .08 : carrying ? .10 : .16;
          double velocity[3];controller_delivery_velocity(x,y,yaw,target.x,target.z,desired_yaw,
              fmin(active_linear_speed_limit,speed_limit),velocity,final_waypoint,manipulator->departing,
              fmin(active_angular_speed_limit,carrying ? .10 : .30));
          webots_adapter.drive_config.acceleration_limit_rad_s2=carrying ? 4.0 : 8.0;
          webots_adapter.drive_config.deceleration_limit_rad_s2=8.0;
          controller_webots_adapter_apply_velocity(&webots_adapter,velocity[0],velocity[1],velocity[2]);
        }
      }
    }
  } else {
    controller_webots_devices_reset_wheels(&webots_devices);
    controller_manipulator_step(&manipulator->state,&sample,dt);
    if(manipulator->mobile && manipulator->delivery_phase==DELIVERY_PICK && manipulator->state.stage==MANIPULATOR_TRANSFER) {
      // Maintain closing force during transport; position-only freezing unloads
      // the contacts and lets the box slip when the chassis accelerates.
      manipulator->state.hold_fingers=0;
      manipulator->state.finger_target=0;
      if(!plan_drive(manipulator->destination_world,0))delivery_fail(&sample,"delivery_path_blocked");
    }
  }
  apply_targets();
  const ControllerManipulatorStage stage = manipulator->state.stage;
  controller_runtime.route_finished = !controller_webots_manipulator_active(manipulator);
  if (manipulator->state.load_held && (stage==MANIPULATOR_FAILED || stage==MANIPULATOR_CANCELLED)) {
    set_status("manipulator_holding");set_error(manipulator->state.error);
  }
  else if (stage == MANIPULATOR_FAILED) { set_status("route_failed"); set_error(manipulator->state.error); }
  else if (stage == MANIPULATOR_CANCELLED) set_status("mission_cancelled");
  else if (stage == MANIPULATOR_COMPLETED) set_status("route_completed");
  else set_status("manipulator_running");
  return 1;
}
