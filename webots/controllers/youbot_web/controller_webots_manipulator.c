#include "controller_webots_manipulator.h"
#include "controller_app_internal.h"
#include "controller_input_runtime.h"
#include "controller_navigation_runtime.h"
#include "controller_delivery.h"
#include <math.h>
#include <string.h>
#include <webots/motor.h>
#include <webots/position_sensor.h>
#include <webots/supervisor.h>
#include <webots/robot.h>

// Grip 15 mm above the centre of a small box, leaving finger tips above the floor.
#define GRIP_OFFSET 0.015

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
  ControllerManipulatorSample sample = {0};
  for (int i = 0; i < 5; ++i) {
    sample.joints[i] = webots_devices.arm_sensors[i] ? wb_position_sensor_get_value(webots_devices.arm_sensors[i]) : NAN;
  }
  for (int i = 0; i < 2; ++i) {
    sample.fingers[i] = webots_devices.finger_sensors[i] ? wb_position_sensor_get_value(webots_devices.finger_sensors[i]) : NAN;
  }
  WbNodeRef object = wb_supervisor_node_get_from_def(controller_app.manipulator.object_def);
  const double *position = object ? wb_supervisor_node_get_position(object) : NULL;
  if (position) {
    memcpy(controller_app.manipulator.object_world, position, sizeof(controller_app.manipulator.object_world));
    double grip[3] = {position[0], position[1], position[2] + GRIP_OFFSET};
    sample.object_valid = world_to_local(grip, sample.object);
  }
  controller_app.manipulator.sample = sample;
  return sample;
}

static void apply_targets(void) {
  const ControllerManipulator *arm = &controller_app.manipulator.state;
  if (arm->halt_motion) {
    for (int i = 0; i < 5; ++i) if (webots_devices.arm_joints[i]) wb_motor_set_velocity(webots_devices.arm_joints[i], 0);
    for (int i = 0; i < 2; ++i) if (webots_devices.gripper_fingers[i]) wb_motor_set_velocity(webots_devices.gripper_fingers[i], 0);
    return;
  }
  for (int i = 0; i < 5; ++i) if (webots_devices.arm_joints[i] && isfinite(arm->targets[i])) {
    wb_motor_set_velocity(webots_devices.arm_joints[i], 0.6);
    const double minimum = wb_motor_get_min_position(webots_devices.arm_joints[i]);
    const double maximum = wb_motor_get_max_position(webots_devices.arm_joints[i]);
    wb_motor_set_position(webots_devices.arm_joints[i], fmax(minimum, fmin(maximum, arm->targets[i])));
  }
  for (int i = 0; i < 2; ++i) if (webots_devices.gripper_fingers[i]) {
    wb_motor_set_velocity(webots_devices.gripper_fingers[i], 0.015);
    wb_motor_set_available_force(webots_devices.gripper_fingers[i], 20);
    const double minimum = wb_motor_get_min_position(webots_devices.gripper_fingers[i]);
    const double maximum = wb_motor_get_max_position(webots_devices.gripper_fingers[i]);
    const double target = controller_manipulator_finger_target(arm, i);
    wb_motor_set_position(webots_devices.gripper_fingers[i], fmax(minimum, fmin(maximum, target)));
  }
}

typedef struct { double x,y,hx,hy; } DeliveryObstacle;
static DeliveryObstacle delivery_obstacles[256];
static int delivery_obstacle_count;
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
    } else return 0; // Refuse unsupported collision geometry rather than guess its footprint.
    if(position[2]+height*0.5<=0.02)continue;
    if(delivery_obstacle_count>=256)return 0;
    delivery_obstacles[delivery_obstacle_count++]=(DeliveryObstacle){position[0],position[1],hx,hy};
  }
  return 1;
}
static int delivery_safe(void *context,double x,double y) {
  const ControllerWebotsManipulator *m=context;
  const double clearance=0.53; // Enclose the base and the raised forward gripper/load.
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
    if(hypot(dx,dy)<clearance)return 0;
  }
  return 1;
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
  int loaded=m->delivery_phase==DELIVERY_DRIVE || (m->state.stage>=MANIPULATOR_LIFT && m->state.stage<=MANIPULATOR_LOWER);
  hold_sample(&m->state,sample);m->state.stage=MANIPULATOR_FAILED;m->state.error=error;
  if(loaded && !m->state.halt_motion){m->state.hold_fingers=0;m->state.finger_target=0;}
  m->delivery_phase=DELIVERY_TERMINAL;
  controller_webots_devices_reset_wheels(&webots_devices);
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
  for(int i=0;i<3;++i)for(int j=0;j<3;++j)local[i]+=rotation[j*3+i]*delta[j];
  if(!controller_manipulator_inverse(local,angles))return 0;
  local[2]+=0.08;return controller_manipulator_inverse(local,angles);
}
static int plan_drive(const double world[3],int pickup) {
  ControllerWebotsManipulator *m=&controller_app.manipulator;
  double x,y,yaw,dock[2];read_pose(&x,&y,&yaw);dock_position(world,pickup,dock);
  if(!refresh_obstacles() || !controller_delivery_plan(&controller_runtime.route,x,y,dock[0],dock[1],delivery_safe,m))return 0;
  double length=0;for(int i=1;i<controller_runtime.route.count;++i)length+=hypot(controller_runtime.route.waypoints[i].x-controller_runtime.route.waypoints[i-1].x,controller_runtime.route.waypoints[i].z-controller_runtime.route.waypoints[i-1].z);
  m->delivery_waypoint=1;m->delivery_elapsed=0;m->drive_timeout=30+length/0.03;
  controller_runtime.current_waypoint_index=1;
  m->delivery_phase=pickup ? DELIVERY_FETCH : DELIVERY_DRIVE;
  return 1;
}
static int destination_clear(const double world[3]) {
  double dock[2];dock_position(world,0,dock);
  return refresh_obstacles() && delivery_safe(&controller_app.manipulator,dock[0],dock[1]);
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
  manipulator->destination_world[0]=command->target_x;
  manipulator->destination_world[1]=command->target_y;
  manipulator->destination_world[2]=command->target_z;
  double x,y,yaw;read_pose(&x,&y,&yaw);manipulator->delivery_yaw=yaw;
  manipulator->room_zone_index=controller_zone_geometry_find_room(&controller_runtime.limit_zones,x,y);
  ControllerManipulatorSample sample = read_sample();
  const double target[3] = {command->target_x, command->target_y, command->target_z + GRIP_OFFSET};
  double destination[3];
  int valid = sample.object_valid && world_to_local(target, destination);
  for (int i = 0; i < 5; ++i) valid = valid && webots_devices.arm_joints[i] && isfinite(sample.joints[i]);
  for (int i = 0; i < 2; ++i) valid = valid && webots_devices.gripper_fingers[i] && isfinite(sample.fingers[i]);
  for (int i = 0; i < 5; ++i) if (isfinite(sample.joints[i])) manipulator->state.targets[i] = sample.joints[i];
  if(!valid)delivery_fail(&sample,!sample.object_valid ? "object_missing" : "devices_unavailable");
  else if(controller_manipulator_start(&manipulator->state,sample.object,destination))manipulator->delivery_phase=DELIVERY_PICK;
  else {
    manipulator->mobile=1;
    if(!dock_reachable(manipulator->object_world,1))delivery_fail(&sample,"source_unreachable");
    else if(!dock_reachable(manipulator->destination_world,0))delivery_fail(&sample,"target_unreachable");
    else if(!destination_clear(manipulator->destination_world))delivery_fail(&sample,"delivery_path_blocked");
    else if(controller_manipulator_start(&manipulator->state,sample.object,sample.object))manipulator->delivery_phase=DELIVERY_PICK;
    else {
      hold_sample(&manipulator->state,&sample);manipulator->state.stage=MANIPULATOR_IDLE;manipulator->state.error="";
      if(!plan_drive(manipulator->object_world,1))delivery_fail(&sample,"delivery_path_blocked");
    }
  }
  set_error("");
  set_status("manipulator_running");
}

void controller_webots_manipulator_cancel(const char *mission_id) {
  ControllerWebotsManipulator *manipulator = &controller_app.manipulator;
  if (!mission_id || strcmp(mission_id, manipulator->mission_id) != 0) return;
  ControllerManipulatorSample sample = read_sample();
  if(!controller_webots_manipulator_active(manipulator))return;
  int loaded=manipulator->delivery_phase==DELIVERY_DRIVE || (manipulator->state.stage>=MANIPULATOR_LIFT && manipulator->state.stage<=MANIPULATOR_LOWER);
  hold_sample(&manipulator->state,&sample);
  if(loaded && !manipulator->state.halt_motion){manipulator->state.hold_fingers=0;manipulator->state.finger_target=0;}
  manipulator->state.stage=MANIPULATOR_CANCELLED;
  manipulator->delivery_phase=DELIVERY_TERMINAL;
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
      controller_runtime.distance_to_target=distance;
      if(distance<0.008 && fabs(atan2(sin(yaw-manipulator->delivery_yaw),cos(yaw-manipulator->delivery_yaw)))<0.012) {
        controller_webots_devices_reset_wheels(&webots_devices);
        if(++manipulator->delivery_waypoint>=controller_runtime.route.count) {
          controller_runtime.route.count=0;
          controller_runtime.current_waypoint_index=0;
          if(!carrying) {
            manipulator->state.hold_fingers=0;
            if(!controller_manipulator_start(&manipulator->state,sample.object,sample.object))delivery_fail(&sample,"source_unreachable");
            else manipulator->delivery_phase=DELIVERY_PICK;
          } else {
            double grip[3]={manipulator->destination_world[0],manipulator->destination_world[1],manipulator->destination_world[2]+GRIP_OFFSET};
            double local[3];world_to_local(grip,local);
            memcpy(manipulator->state.destination,local,sizeof(local));
            if(!controller_manipulator_inverse(local,manipulator->state.poses[2]))delivery_fail(&sample,"target_unreachable");
            else {
              local[2]+=0.08;
              if(!controller_manipulator_inverse(local,manipulator->state.poses[3]))delivery_fail(&sample,"target_approach_unreachable");
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
          double velocity[3];controller_delivery_velocity(x,y,yaw,target.x,target.z,manipulator->delivery_yaw,fmin(active_linear_speed_limit,carrying ? 0.10 : 0.16),velocity);
          set_base_velocity(velocity[0],velocity[1],velocity[2]);
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
  if (stage == MANIPULATOR_FAILED) { set_status("route_failed"); set_error(manipulator->state.error); }
  else if (stage == MANIPULATOR_CANCELLED) set_status("mission_cancelled");
  else if (stage == MANIPULATOR_COMPLETED) set_status("route_completed");
  else set_status("manipulator_running");
  return 1;
}
