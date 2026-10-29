#include "controller_object_transfer_runtime.h"
#include "controller_manipulator_kinematics.h"
#include "controller_navigation_state.h"
#include "controller_transfer_route.h"
#include <cmath>
#include <cstdio>
#include <cstring>
#include <chrono>
namespace {
constexpr double kHandleOffset=0.115;
constexpr double kHandleCenterOffset=kHandleOffset;
constexpr double kOpen=0.025;
constexpr double kFloorApproachOpening=0.0115;
constexpr double kPlatformOffset=-0.07;
constexpr double kPlatformSide=0.075;
constexpr double kPlatformCargoHeight=0.1235;
constexpr double kCarryPitch=-2.25;
constexpr double kPlatformClearance=0.052;
constexpr double kLiftClearance=0.205;
constexpr double kLiftStep=0.015;
constexpr double kFloorCargoHeight=0.075;
constexpr double kSupportHeightTolerance=0.006;
constexpr double kSupportContactTolerance=0.004;
constexpr double kSettledLinearSpeed=0.025;
constexpr double kSettledAngularSpeed=0.15;
constexpr double kUprightMinimum=0.97;
ControllerManipulatorTarget transport_pose() {
  auto pose=controller_manipulator_service_target(CONTROLLER_MANIPULATOR_TRANSPORT);
  pose.joints[0]=1.2;
  return pose;
}
void object_handle_center(ControllerObjectTransferRuntime *r,double x,double y,double z,double pose[3]) {
  pose[0]=x;pose[1]=y;pose[2]=z+kHandleCenterOffset;
  const double *orientation=r->object.node ? wb_supervisor_node_get_orientation(r->object.node) : nullptr;
  if(orientation) {
    pose[0]=x+orientation[2]*kHandleCenterOffset;
    pose[1]=y+orientation[5]*kHandleCenterOffset;
    pose[2]=z+orientation[8]*kHandleCenterOffset;
  }
}
void fail(ControllerObjectTransferRuntime *r,const char *error) {
  auto &s=r->service.state;
  const auto parked=transport_pose();
  bool arm_parked=r->have_joint_measurement;
  for(int i=0;i<5;++i) arm_parked=arm_parked && std::fabs(s.joint_positions[i]-parked.joints[i])<0.05;
  const bool needs_recovery=s.attached || s.on_platform || !arm_parked;
  if(needs_recovery && s.status!=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) ++s.recovery_epoch;
  s.status=needs_recovery ? CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY : CONTROLLER_TRANSFER_FAILED;
  std::snprintf(s.error_code,sizeof(s.error_code),"%s",error);
  if(r->have_joint_measurement) controller_webots_devices_set_manipulator(r->devices,s.joint_positions,
      s.attached ? 0.0 : (s.finger_positions[0]+s.finger_positions[1])*0.5);
  controller_webots_devices_reset_wheels(r->devices);
}
void waypoint(ControllerObjectTransferRuntime *r,double x,double y,int pickup) {
  auto *n=r->navigation;
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  ZoneData zones=n->limit_zones;
  // The other box remains a physical obstacle during DEMO_BOX delivery.
  // Otherwise the approach from the origin can push PICK_BOX onto its side.
  WbNodeRef small=wb_supervisor_node_get_from_def("PICK_BOX");
  if(small) {
    const double *p=wb_supervisor_node_get_position(small);
    const double *rotation=wb_supervisor_node_get_orientation(small);
    WbFieldRef bounding=wb_supervisor_node_get_field(small,"boundingObject");
    WbNodeRef shape=bounding ? wb_supervisor_field_get_sf_node(bounding) : nullptr;
    if(shape && p && rotation && std::strcmp(wb_supervisor_node_get_base_type_name(shape),"Box")==0) {
      const double *size=wb_supervisor_field_get_sf_vec3f(wb_supervisor_node_get_field(shape,"size"));
      if(size) {
        if(zones.count>=MAX_ZONES){fail(r,"navigation_unreachable");return;}
        const double hx=.5*(std::fabs(rotation[0])*size[0]+std::fabs(rotation[1])*size[1]+std::fabs(rotation[2])*size[2]);
        const double hy=.5*(std::fabs(rotation[3])*size[0]+std::fabs(rotation[4])*size[1]+std::fabs(rotation[5])*size[2]);
        auto &zone=zones.zones[zones.count++];zone.point_count=4;
        zone.points[0]={p[0]-hx,p[1]-hy};zone.points[1]={p[0]+hx,p[1]-hy};
        zone.points[2]={p[0]+hx,p[1]+hy};zone.points[3]={p[0]-hx,p[1]+hy};
      }
    }
  }
  if(!controller_transfer_route_plan_dock(&zones,base[0],base[1],x,y,
      (r->service.state.attached || r->service.state.on_platform) ? 0.50 : 0.36,pickup,&n->route)) {
    fail(r,"navigation_unreachable"); return;
  }
  const double *rotation=wb_supervisor_node_get_orientation(wb_supervisor_node_get_self());
  if(!rotation) {fail(r,"sensor_invalid");return;}
  const double heading=std::atan2(rotation[3],rotation[0]);
  r->service.state.navigation_timeout=controller_transfer_route_timeout(&n->route,base[0],base[1],heading,
      std::fmin(r->linear_speed_limit,(r->service.state.attached || r->service.state.on_platform) ? .06 : .12),
      std::fmin(r->angular_speed_limit,(r->service.state.attached || r->service.state.on_platform) ? .10 : .30));
  if(r->service.state.navigation_timeout<=0) {fail(r,"sensor_invalid");return;}
  r->progress_pose[0]=base[0];r->progress_pose[1]=base[1];r->progress_pose[2]=heading;
  std::snprintf(n->route.command_id,sizeof(n->route.command_id),"%s",r->service.state.mission_id);
  n->current_waypoint_index=0; n->route_finished=0; n->mapping_survey.route_active=0;
  n->cancelled_mission_id[0]=0;
  controller_navigation_state_reset(n,x,y);
}
int arm_target_pitch(ControllerObjectTransferRuntime *r,double wx,double wy,double wz,
    double pitch,double opening,double now,double rx,double ry,double heading) {
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  const double *orientation=wb_supervisor_node_get_orientation(wb_supervisor_node_get_self());
  if(!base || !orientation) { fail(r,"sensor_invalid"); return 0; }
  (void)rx; (void)ry; (void)heading;
  const double delta[]={wx-base[0],wy-base[1],wz-base[2]};
  double local[3]={};
  for(int i=0;i<3;++i) for(int j=0;j<3;++j) local[i]+=orientation[j*3+i]*delta[j];
  ControllerManipulatorTcp tcp={local[0],local[1],local[2],pitch,r->grip_roll};
  ControllerManipulatorTarget target={}; target.finger_opening=opening;
  if(!controller_manipulator_inverse(&tcp,r->service.state.joint_positions,target.joints)) {
    fail(r,"target_unreachable"); return 0;
  }
  const double safe_fingers[2]={
      r->service.state.finger_positions[0]<0 ? 0.0 :
          (r->service.state.finger_positions[0]>kOpen ? kOpen : r->service.state.finger_positions[0]),
      r->service.state.finger_positions[1]<0 ? 0.0 :
          (r->service.state.finger_positions[1]>kOpen ? kOpen : r->service.state.finger_positions[1])};
  if(!controller_manipulator_service_start_target(&r->manipulator,&target,
      r->service.state.joint_positions,safe_fingers,now)) {
    fail(r,"sensor_invalid"); return 0;
  }
  if(r->service.state.attached && std::fabs(target.joints[0]-r->service.state.joint_positions[0])>.3) {
    // Rotating the tilted jaws quickly scrubs the square handle out of contact.
    r->manipulator.duration_seconds*=2.0;
    r->manipulator.timeout_seconds=std::fmax(r->manipulator.timeout_seconds,r->manipulator.duration_seconds+3.0);
  }
  std::memcpy(r->service.state.joint_targets,target.joints,sizeof(target.joints)); return 1;
}
int arm_target(ControllerObjectTransferRuntime *r,double wx,double wy,double wz,
    double opening,double now,double rx,double ry,double heading) {
  return arm_target_pitch(r,wx,wy,wz,kCarryPitch,opening,now,rx,ry,heading);
}
void platform_target(ControllerObjectTransferRuntime *r,double rx,double ry,double heading,
    double height_offset,double opening,double now) {
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  double pose[3]={};
  controller_object_transfer_platform_pose(rx,ry,base[2],heading,pose);
  if(arm_target(r,pose[0],pose[1],pose[2]+kHandleOffset+height_offset,
      opening,now,rx,ry,heading)) {
    r->manipulator.duration_seconds*=2.0;
    const double timeout=r->manipulator.duration_seconds+3.0;
    if(r->manipulator.timeout_seconds<timeout) r->manipulator.timeout_seconds=timeout;
  }
}
void front_clear_target(ControllerObjectTransferRuntime *r,double rx,double ry,double heading,double opening,double now) {
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  arm_target(r,rx+std::cos(heading)*CONTROLLER_TRANSFER_DOCK_DISTANCE,ry+std::sin(heading)*CONTROLLER_TRANSFER_DOCK_DISTANCE,
      base[2]+kPlatformCargoHeight+kHandleOffset+kPlatformClearance,opening,now,rx,ry,heading);
}
void park_target(ControllerObjectTransferRuntime *r,double now) {
  auto target=transport_pose();target.finger_opening=kOpen;
  controller_manipulator_service_start_target(&r->manipulator,&target,
      r->service.state.joint_positions,r->service.state.finger_positions,now);
  std::memcpy(r->service.state.joint_targets,target.joints,sizeof(target.joints));
}
void configure(ControllerObjectTransferRuntime *r,double now,double rx,double ry,double heading) {
  auto &s=r->service.state;
  if(s.stage==r->configured_stage) return;
  if(s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM) {
    const double *velocity=r->object.node ? wb_supervisor_node_get_velocity(r->object.node) : nullptr;
    const double speed=velocity ? std::hypot(std::hypot(velocity[0],velocity[1]),velocity[2]) : 100;
    const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
    if(!base) return;
    if(speed>=0.025 || !controller_object_transfer_object_on_platform(
        rx,ry,base[2],heading,s.object_pose[0],s.object_pose[1],s.object_pose[2])) return;
  }
  r->configured_stage=s.stage; r->arm_phase=0; r->stable_since=-1;
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  if(!base) {fail(r,"sensor_invalid");return;}
  const double ox=s.object_pose[0],oy=s.object_pose[1];
  double platform_handle[3]={};
  object_handle_center(r,ox,oy,s.object_pose[2],platform_handle);
  switch(s.stage) {
    case CONTROLLER_TRANSFER_LOWERING_ARM:
      arm_target(r,ox,oy,s.object_pose[2]+kHandleOffset+0.06,kFloorApproachOpening,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_GRASPING:
      arm_target(r,ox,oy,s.object_pose[2]+kHandleOffset,0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_LIFTING:
      r->lift_origin[0]=ox;r->lift_origin[1]=oy;r->lift_origin[2]=r->initial_object_z+kHandleOffset;
      arm_target(r,ox,oy,r->lift_origin[2]+kLiftStep,0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_PLACING_ON_PLATFORM:
      platform_target(r,rx,ry,heading,kPlatformClearance,0.0,now); break;
    case CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM:
    {
      ControllerManipulatorTarget target={};target.finger_opening=kOpen;
      std::memcpy(target.joints,s.joint_positions,sizeof(target.joints));
      const double safe_fingers[2]={s.finger_positions[0]>0 ? s.finger_positions[0] : 0.0,
          s.finger_positions[1]>0 ? s.finger_positions[1] : 0.0};
      controller_manipulator_service_start_target(&r->manipulator,&target,
          s.joint_positions,safe_fingers,now);
      std::memcpy(s.joint_targets,target.joints,sizeof(target.joints));break;
    }
    case CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT:
      platform_target(r,rx,ry,heading,kPlatformClearance,kOpen,now); break;
    case CONTROLLER_TRANSFER_TRANSPORTING:
      waypoint(r,s.destination_x,s.destination_y,0); break;
    case CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM:
      front_clear_target(r,rx,ry,heading,kOpen,now); break;
    case CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM:
      arm_target(r,platform_handle[0],platform_handle[1],platform_handle[2],
          0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM:
      r->lift_origin[0]=platform_handle[0];r->lift_origin[1]=platform_handle[1];
      r->lift_origin[2]=platform_handle[2];
      arm_target(r,platform_handle[0],platform_handle[1],
          r->lift_origin[2]+kLiftStep,
          0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_PLACING:
      r->lift_origin[2]=base[2]+kPlatformCargoHeight+kHandleOffset+kPlatformClearance;
      arm_target(r,s.destination_x,s.destination_y,r->lift_origin[2],
          0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_RELEASING:
    {
      ControllerManipulatorTarget target={};target.finger_opening=kOpen;
      std::memcpy(target.joints,s.joint_positions,sizeof(target.joints));
      const double safe_fingers[2]={s.finger_positions[0]>0 ? s.finger_positions[0] : 0.0,
          s.finger_positions[1]>0 ? s.finger_positions[1] : 0.0};
      controller_manipulator_service_start_target(&r->manipulator,&target,
          s.joint_positions,safe_fingers,now);
      std::memcpy(s.joint_targets,target.joints,sizeof(target.joints));break;
    }
    case CONTROLLER_TRANSFER_RETURNING_ARM:
      if(!s.attached && !r->object.attached && (s.error_code[0] || s.cancel_pending)) {
        r->arm_phase=1;
        auto parked=transport_pose();
        parked.finger_opening=kOpen;
        controller_manipulator_service_start_target(&r->manipulator,&parked,s.joint_positions,s.finger_positions,now);
        std::memcpy(s.joint_targets,parked.joints,sizeof(parked.joints));
        break;
      }
      arm_target(r,s.destination_x,s.destination_y,r->initial_object_z+kHandleOffset+0.06,
          kOpen,now,rx,ry,heading); break;
    default: break;
  }
}
}
ControllerManipulatorTarget controller_object_transfer_runtime_sample(
    const ControllerObjectTransferRuntime *r,double now) {
  auto command=controller_manipulator_service_sample(&r->manipulator,now);
  const auto &s=r->service.state;
  // A handle blocks the measured fingers above zero. Starting another arm
  // trajectory from that measurement must not remove the clamping command.
  if(s.attached && s.stage!=CONTROLLER_TRANSFER_RELEASING &&
      s.stage!=CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM) command.finger_opening=0.0;
  return command;
}
int controller_object_transfer_release_supported(const ControllerObjectTransferState *s,int floor_contact) {
  return s && floor_contact && std::fabs(s->object_pose[2]-kFloorCargoHeight)<kSupportHeightTolerance &&
      s->object_up[2]>kUprightMinimum &&
      std::hypot(s->object_pose[0]-s->destination_x,s->object_pose[1]-s->destination_y)<.05;
}
int controller_object_transfer_release_safe(const ControllerObjectTransferState *s,
    int floor_contact,double linear_speed,double angular_speed) {
  return controller_object_transfer_release_supported(s,floor_contact) &&
      std::isfinite(linear_speed) && linear_speed>=0 && linear_speed<kSettledLinearSpeed &&
      std::isfinite(angular_speed) && angular_speed>=0 && angular_speed<kSettledAngularSpeed;
}
int controller_object_transfer_floor_supported(ControllerObjectTransferRuntime *r,
    int floor_contact,double linear_speed,double angular_speed) {
  if(!r) return 0;
  const auto &s=r->service.state;
  if(floor_contact) {
    std::memcpy(r->floor_support_pose,s.object_pose,sizeof(s.object_pose));
    r->floor_support_confirmed=1;
  }
  const double movement=std::hypot(std::hypot(s.object_pose[0]-r->floor_support_pose[0],
      s.object_pose[1]-r->floor_support_pose[1]),s.object_pose[2]-r->floor_support_pose[2]);
  // Sleeping Webots bodies omit contact points; retain only the same measured resting pose.
  if(!std::isfinite(movement) || movement>.003 || !std::isfinite(linear_speed) ||
      !std::isfinite(angular_speed) || linear_speed>=kSettledLinearSpeed ||
      angular_speed>=kSettledAngularSpeed || s.object_up[2]<kUprightMinimum)
    r->floor_support_confirmed=0;
  return r->floor_support_confirmed;
}
void controller_object_transfer_platform_pose(double robot_x,double robot_y,double robot_z,
    double heading,double pose[3]) {
  if(!pose) return;
  pose[0]=robot_x+std::cos(heading)*kPlatformOffset-std::sin(heading)*kPlatformSide;
  pose[1]=robot_y+std::sin(heading)*kPlatformOffset+std::cos(heading)*kPlatformSide;
  pose[2]=robot_z+kPlatformCargoHeight;
}
int controller_object_transfer_object_on_platform(double robot_x,double robot_y,double robot_z,
    double heading,double object_x,double object_y,double object_z) {
  double pose[3]={};
  controller_object_transfer_platform_pose(robot_x,robot_y,robot_z,heading,pose);
  return std::hypot(object_x-pose[0],object_y-pose[1])<0.04 &&
      std::fabs(object_z-pose[2])<0.025;
}
void controller_object_transfer_runtime_init(ControllerObjectTransferRuntime *r,
    ControllerRuntime *n,ControllerWebotsDevices *d) {
  if(!r) return; std::memset(r,0,sizeof(*r)); r->navigation=n; r->devices=d;
  controller_object_transfer_service_init(&r->service);
  r->linear_speed_limit=.12;r->angular_speed_limit=.30;
  controller_manipulator_service_init(&r->manipulator);
  // Reach the open approach pose before closing, especially above the platform.
  r->manipulator.joint_tolerance=.005;
  r->available=controller_webots_object_adapter_init(&r->object,"DEMO_BOX");
  r->tcp_node=wb_supervisor_node_get_from_def("TCP");
  if(!r->tcp_node) r->tcp_node=wb_supervisor_node_get_from_proto_def(wb_supervisor_node_get_self(),"TCP");
  r->platform_node=wb_supervisor_node_get_from_proto_def(wb_supervisor_node_get_self(),"PLATE");
  for(int i=0;i<2;++i) {
    WbNodeRef finger=r->devices->finger_contacts[i] ? wb_supervisor_node_get_from_device(r->devices->finger_contacts[i]) : nullptr;
    r->finger_node_ids[i]=finger ? wb_supervisor_node_get_id(finger) : -1;
  }
  r->available=r->available && r->tcp_node && r->platform_node &&
      r->finger_node_ids[0]>=0 && r->finger_node_ids[1]>=0;
  r->last_platform_seen=-1;
  const auto stamp=std::chrono::system_clock::now().time_since_epoch().count();
  std::snprintf(r->boot_id,sizeof(r->boot_id),"webots-%lld",(long long)stamp);
  std::snprintf(r->service.state.controller_boot_id,sizeof(r->boot_id),"%s",r->boot_id);
  r->stable_since=-1;
}
void controller_object_transfer_runtime_command(ControllerObjectTransferRuntime *r,
    const RuntimeCommand *c,double now) {
  if(!r || !c) return;
  if(c->has_manipulator_pose) {
    controller_object_transfer_runtime_set_pose(r,c->manipulator_pose,now); return;
  }
  if(c->has_resume_transfer || c->has_recover_transfer) {
    if(std::strcmp(c->mission_id,r->service.state.mission_id)==0 && r->service.state.sensors_valid &&
        (!r->service.state.attached || (r->object.attached && r->service.state.grip_evidence))) {
      if(!r->service.state.attached && !r->service.state.on_platform) {
        r->service.state.destination_x=r->service.state.object_pose[0];
        r->service.state.destination_y=r->service.state.object_pose[1];
      }
      if(controller_object_transfer_service_resume(&r->service,now))
        r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
    } return;
  }
  if(!c->has_transfer_object || r->manual_active) return;
  if(!controller_object_transfer_service_start(&r->service,c->mission_id,c->object_id,
      c->destination_x,c->destination_y,now)) return;
  std::snprintf(r->service.state.controller_boot_id,sizeof(r->boot_id),"%s",r->boot_id);
  if(!r->available) { fail(r,"arm_unavailable"); return; }
  if(std::strcmp(c->object_id,"demo-box")!=0) { fail(r,"unsupported_object"); return; }
  double x=0,y=0,z=0;
  if(!controller_webots_object_adapter_position(&r->object,&x,&y,&z)) { fail(r,"object_unavailable"); return; }
  r->initial_object_z=z; r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
  r->last_platform_seen=-1;
  r->cancel_recovery_attempted=0;
  waypoint(r,x,y,1);
  const double *orientation=wb_supervisor_node_get_orientation(r->object.node);
  if(r->service.state.status==CONTROLLER_TRANSFER_RUNNING && orientation && r->navigation->route.count) {
    const double dock_heading=r->navigation->route.waypoints[r->navigation->route.count-1].heading_rad;
    // The downward wrist rotates about -Z. Match the square handle before closing.
    r->grip_roll=std::remainder(dock_heading-std::atan2(orientation[3],orientation[0]),3.14159265358979323846);
  }
}
int controller_object_transfer_runtime_allows_navigation(const ControllerObjectTransferRuntime *r) {
  if(!r) return 1;
  if(r->manual_active) return 0;
  const auto &s=r->service.state;
  if(s.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) return 0;
  if(s.status==CONTROLLER_TRANSFER_FAILED)
    return std::strcmp(r->navigation->route.command_id,s.mission_id)!=0;
  if(s.status!=CONTROLLER_TRANSFER_RUNNING) return 1;
  if(s.stage==CONTROLLER_TRANSFER_APPROACHING_OBJECT) return 1;
  if(s.stage!=CONTROLLER_TRANSFER_TRANSPORTING || !s.sensors_valid || !s.on_platform ||
      s.attached || s.gripper_closed) return 0;
  const auto parked=transport_pose();
  for(int i=0;i<5;++i)
    if(!std::isfinite(s.joint_positions[i]) || std::fabs(s.joint_positions[i]-parked.joints[i])>.05) return 0;
  return std::fabs(s.finger_positions[0]-kOpen)<.003 && std::fabs(s.finger_positions[1]-kOpen)<.003;
}
void controller_object_transfer_runtime_hold(ControllerObjectTransferRuntime *r,const char *reason) {
  if(r && reason) fail(r,reason);
}
void controller_object_transfer_runtime_set_speed_limits(ControllerObjectTransferRuntime *r,double linear,double angular) {
  if(r) {r->linear_speed_limit=linear;r->angular_speed_limit=angular;}
}
int controller_object_transfer_runtime_set_pose(ControllerObjectTransferRuntime *r,const char *name,double now) {
  ControllerManipulatorPose pose;
  if(!r || !controller_manipulator_pose_parse(name,&pose) || !r->service.state.sensors_valid ||
      r->service.state.status==CONTROLLER_TRANSFER_RUNNING ||
      r->service.state.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY ||
      r->service.state.attached || r->service.state.on_platform) return 0;
  const auto target=controller_manipulator_service_target(pose);
  if(!controller_manipulator_service_start_target(&r->manipulator,&target,
      r->service.state.joint_positions,r->service.state.finger_positions,now)) return 0;
  r->manipulator.pose=pose;r->manual_active=1;
  return 1;
}
void controller_object_transfer_runtime_step(ControllerObjectTransferRuntime *r,
    double now,double rx,double ry,double heading) {
  if(!r) return; auto &s=r->service.state;
  double measured_joints[5]={},measured_fingers[2]={};
  s.sensors_valid=controller_webots_devices_read_manipulator(r->devices,measured_joints,measured_fingers);
  if(s.sensors_valid) {
    r->have_joint_measurement=1;
    std::memcpy(s.joint_positions,measured_joints,sizeof(measured_joints));
    std::memcpy(s.finger_positions,measured_fingers,sizeof(measured_fingers));
  }
  double efforts[7]={};
  const int grip_sensors=controller_webots_devices_read_grip(r->devices,r->contacts,efforts);
  for(int i=0;i<2;++i) s.finger_contacts[i]=grip_sensors ? r->contacts[i] : 0;
  if(grip_sensors) std::memcpy(s.motor_efforts,efforts,sizeof(efforts));
  double ox=0,oy=0,oz=0;
  const int object_valid=controller_webots_object_adapter_position(&r->object,&ox,&oy,&oz);
  s.object_pose[0]=ox;s.object_pose[1]=oy;s.object_pose[2]=oz;
  const double *tcp=r->tcp_node ? wb_supervisor_node_get_position(r->tcp_node) : nullptr;
  const bool tcp_valid=tcp && std::isfinite(tcp[0]) && std::isfinite(tcp[1]) && std::isfinite(tcp[2]);
  if(tcp_valid) std::memcpy(s.tcp_pose,tcp,sizeof(s.tcp_pose));
  s.sensors_valid=s.sensors_valid && grip_sensors && tcp_valid && object_valid;
  const double *velocity=r->object.node ? wb_supervisor_node_get_velocity(r->object.node) : nullptr;
  const double speed=velocity ? std::hypot(std::hypot(velocity[0],velocity[1]),velocity[2]) : 100;
  const double angular_speed=velocity ? std::hypot(std::hypot(velocity[3],velocity[4]),velocity[5]) : 100;
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  const bool platform_position=object_valid && base &&
      controller_object_transfer_object_on_platform(rx,ry,base[2],heading,ox,oy,oz);
  const double *object_orientation=r->object.node ? wb_supervisor_node_get_orientation(r->object.node) : nullptr;
  if(object_orientation) {
    s.object_up[0]=object_orientation[2];
    s.object_up[1]=object_orientation[5];
    s.object_up[2]=object_orientation[8];
  }
  int contact_count=0;
  const WbContactPoint *support=object_valid
      ? wb_supervisor_node_get_contact_points(r->object.node,false,&contact_count) : nullptr;
  bool floor_contact=false;
  for(int i=0;support && i<contact_count;++i)
    if(std::fabs(support[i].point[2])<kSupportContactTolerance) floor_contact=true;
  int robot_contact_count=0;
  const WbContactPoint *robot_contacts=object_valid
      ? wb_supervisor_node_get_contact_points(wb_supervisor_node_get_self(),true,&robot_contact_count) : nullptr;
  bool platform_contact=false;
  const bool finger_contact[2]={
      controller_webots_object_adapter_contact(support,contact_count,robot_contacts,robot_contact_count,r->finger_node_ids[0])!=0,
      controller_webots_object_adapter_contact(support,contact_count,robot_contacts,robot_contact_count,r->finger_node_ids[1])!=0};
  // node_id identifies the queried solid, so match the two sides of a contact.
  for(int i=0;support && i<contact_count;++i)
    for(int j=0;robot_contacts && j<robot_contact_count;++j)
      if(std::hypot(std::hypot(support[i].point[0]-robot_contacts[j].point[0],
              support[i].point[1]-robot_contacts[j].point[1]),
              support[i].point[2]-robot_contacts[j].point[2])<.001) {
        if(base && std::fabs(robot_contacts[j].point[2]-base[2]-.0485)<.004) platform_contact=true;
      }
  if(platform_contact) r->last_platform_seen=now;
  const bool platform_evidence=platform_position && object_orientation && s.object_up[2]>.97 &&
      r->last_platform_seen>=0 && now-r->last_platform_seen<.20;
  double handle[3]={ox,oy,oz+kHandleOffset};
  if(object_orientation) {
    handle[0]=ox+object_orientation[2]*kHandleOffset;
    handle[1]=oy+object_orientation[5]*kHandleOffset;
    handle[2]=oz+object_orientation[8]*kHandleOffset;
  }
  const double grasp_error=tcp_valid ? std::hypot(std::hypot(tcp[0]-handle[0],tcp[1]-handle[1]),tcp[2]-handle[2]) : 100;
  double platform_grip[3]={};
  object_handle_center(r,ox,oy,oz,platform_grip);
  const double platform_grasp_error=tcp_valid ? std::hypot(std::hypot(
      tcp[0]-platform_grip[0],tcp[1]-platform_grip[1]),tcp[2]-platform_grip[2]) : 100;
  const bool platform_grasp=s.stage==CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM ||
      s.stage==CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM;
  const double active_grasp_error=platform_grasp ? platform_grasp_error : grasp_error;
  const double finger_gap=(s.finger_positions[0]+s.finger_positions[1])*0.5;
  const double grip_tolerance=s.stage==CONTROLLER_TRANSFER_GRASPING ? .025 :
      s.stage==CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM ? .030 : .045;
  const bool contact_grip=grip_sensors && finger_contact[0] && finger_contact[1] && finger_gap>0.0001 && std::fabs(r->contacts[0])>0.05 &&
      std::fabs(r->contacts[1])>0.05 &&
      active_grasp_error<grip_tolerance;
  s.grip_evidence=contact_grip;
  if(s.grip_evidence) r->last_grip_seen=now;
  const bool monitoring_grip=s.stage!=CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM &&
      s.stage!=CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT &&
      s.stage!=CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM &&
      s.stage!=CONTROLLER_TRANSFER_RELEASING && s.stage!=CONTROLLER_TRANSFER_RETURNING_ARM;
  const double grip_grace=(s.stage==CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM ||
      s.stage==CONTROLLER_TRANSFER_PLACING) ? 1.5 : 0.50;
  if(r->object.attached && monitoring_grip &&
      (!object_valid || active_grasp_error>0.045 || now-r->last_grip_seen>grip_grace)) {
    if(s.status==CONTROLLER_TRANSFER_RUNNING &&
        s.stage==CONTROLLER_TRANSFER_PLACING_ON_PLATFORM && platform_evidence) {
      controller_webots_object_adapter_detach(&r->object);
      s.attached=0;s.gripper_closed=0;s.stage=CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM;
      s.stage_started_at=now;r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
    } else if(s.status==CONTROLLER_TRANSFER_RUNNING) {
      std::fprintf(stderr,"[transfer] grip_lost mission=%s tcpError=%.6f contactAge=%.6f\n",
          s.mission_id,active_grasp_error,now-r->last_grip_seen);
      // Stop with the cargo resource held; losing the physical grip elsewhere is recoverable.
      fail(r,"grip_lost");
    }
  }
  const int floor_supported=controller_object_transfer_floor_supported(r,floor_contact,speed,angular_speed);
  s.release_evidence=object_valid && controller_object_transfer_release_safe(&s,floor_supported,speed,angular_speed);
  const bool cancel=r->navigation->cancelled_mission_id[0] &&
      std::strcmp(r->navigation->cancelled_mission_id,s.mission_id)==0;
  if(s.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY && cancel &&
      (s.grip_evidence || (s.on_platform && platform_evidence)) && !r->cancel_recovery_attempted) {
    r->cancel_recovery_attempted=1;
    s.status=CONTROLLER_TRANSFER_RUNNING; s.cancel_pending=1;
    s.destination_x=rx+CONTROLLER_TRANSFER_DOCK_DISTANCE*std::cos(heading);s.destination_y=ry+CONTROLLER_TRANSFER_DOCK_DISTANCE*std::sin(heading);
    s.stage=s.attached ? CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM : CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM;
    s.stage_started_at=now;
    r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
  }
  if(s.status!=CONTROLLER_TRANSFER_RUNNING) {
    if(r->manual_active) {
      controller_webots_devices_reset_wheels(r->devices);
      const auto result=controller_manipulator_service_step(&r->manipulator,s.joint_positions,s.finger_positions,now);
      if(result==CONTROLLER_MANIPULATOR_INVALID || result==CONTROLLER_MANIPULATOR_TIMED_OUT) {
        r->manual_active=0;fail(r,result==CONTROLLER_MANIPULATOR_INVALID ? "sensor_invalid" : "arm_timeout");return;
      }
      const auto target=controller_manipulator_service_sample(&r->manipulator,now);
      controller_webots_devices_set_manipulator(r->devices,target.joints,target.finger_opening);
      if(result==CONTROLLER_MANIPULATOR_REACHED && r->manipulator.pose==CONTROLLER_MANIPULATOR_TRANSPORT)
        r->manual_active=0;
    }
    return;
  }
  if(!s.sensors_valid || !grip_sensors || !tcp) { fail(r,"sensor_invalid"); return; }
  if(cancel && (s.attached || s.on_platform) && !s.cancel_pending) {
    s.destination_x=rx+CONTROLLER_TRANSFER_DOCK_DISTANCE*std::cos(heading);s.destination_y=ry+CONTROLLER_TRANSFER_DOCK_DISTANCE*std::sin(heading);
    if(s.attached && s.grip_evidence) {
      s.cancel_pending=1;
      s.stage=CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM;s.stage_started_at=now;
      r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
    }
    r->navigation->route_finished=1;
  }
  if(cancel && !s.attached && !s.cancel_pending &&
      (s.stage==CONTROLLER_TRANSFER_LOWERING_ARM || s.stage==CONTROLLER_TRANSFER_GRASPING)) {
    s.cancel_pending=1;
    s.destination_x=ox;s.destination_y=oy;
    s.stage=CONTROLLER_TRANSFER_RETURNING_ARM;s.stage_started_at=now;
    r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
    r->navigation->route_finished=1;
  }
  configure(r,now,rx,ry,heading);
  if(s.status!=CONTROLLER_TRANSFER_RUNNING) return;
  // Stability is required before entering release and before declaring success.
  // Opening the fingers can briefly disturb a supported box; keep checking its
  // physical support throughout opening rather than faulting on that vibration.
  if((s.stage==CONTROLLER_TRANSFER_RELEASING &&
          !controller_object_transfer_release_supported(&s,floor_contact || floor_supported)) ||
      (s.stage==CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM && !platform_evidence)) {
    std::fprintf(stderr,"[transfer] unsafe_release elapsed %.3f floor%d speed%.5f angular%.5f z%.5f up%.5f\n",now-s.stage_started_at,floor_contact,speed,angular_speed,oz,s.object_up[2]);
    fail(r,"unsafe_release"); return;
  }
  auto arm=controller_manipulator_service_step(&r->manipulator,s.joint_positions,s.finger_positions,now);
  if(arm==CONTROLLER_MANIPULATOR_INVALID) { fail(r,"sensor_invalid"); return; }
  if(arm==CONTROLLER_MANIPULATOR_TIMED_OUT) { fail(r,"arm_timeout"); return; }
  const auto command=controller_object_transfer_runtime_sample(r,now);
  controller_webots_devices_set_manipulator(r->devices,command.joints,command.finger_opening);
  int arm_reached=arm==CONTROLLER_MANIPULATOR_REACHED;
  if(s.stage==CONTROLLER_TRANSFER_PLACING_ON_PLATFORM && platform_evidence) {
    double max_joint_error=0.0;
    for(int i=0;i<5;++i)
      max_joint_error=std::fmax(max_joint_error,std::fabs(s.joint_positions[i]-s.joint_targets[i]));
    if(max_joint_error<0.06) arm_reached=1;
  }
  if(s.stage==CONTROLLER_TRANSFER_PLACING && s.release_evidence) {
    arm_reached=1;
  }
  if(s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM &&
      r->configured_stage!=CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM) arm_reached=0;
  if(arm_reached && ((s.stage==CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM && !s.attached) ||
      (s.stage==CONTROLLER_TRANSFER_RELEASING && !s.attached))) {
    arm_reached=std::fabs(s.finger_positions[0]-kOpen)<0.003 &&
        std::fabs(s.finger_positions[1]-kOpen)<0.003;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_LOWERING_ARM && r->arm_phase==0) {
    r->arm_phase=1; arm_target(r,ox,oy,oz+kHandleOffset,kFloorApproachOpening,now,rx,ry,heading); arm_reached=0;
  }
  const bool lifting=s.stage==CONTROLLER_TRANSFER_LIFTING;
  const bool platform_lifting=s.stage==CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM;
  const double lift_clearance=lifting ? kLiftClearance : kPlatformClearance;
  if(arm_reached && (lifting || platform_lifting) &&
      (r->arm_phase+1)*kLiftStep<lift_clearance) {
    // A single joint-space lift bows the TCP out of the narrow handle.
    // Short measured waypoints preserve contact during the test lift.
    ++r->arm_phase;
    const double rise=std::fmin((r->arm_phase+1)*kLiftStep,lift_clearance);
    arm_target(r,r->lift_origin[0],r->lift_origin[1],r->lift_origin[2]+rise,0.0,now,rx,ry,heading);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PLACING &&
      r->lift_origin[2]-r->arm_phase*kLiftStep>kFloorCargoHeight+kHandleOffset) {
    ++r->arm_phase;
    const double height=std::fmax(kFloorCargoHeight+kHandleOffset,r->lift_origin[2]-r->arm_phase*kLiftStep);
    arm_target(r,s.destination_x,s.destination_y,height,0.0,now,rx,ry,heading);arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PLACING_ON_PLATFORM && r->arm_phase==0) {
    r->arm_phase=1;
    platform_target(r,rx,ry,heading,0.0,0.0,now);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM && r->arm_phase==0) {
    r->arm_phase=1;
    arm_target_pitch(r,platform_grip[0],platform_grip[1],platform_grip[2]+kPlatformClearance,
        kCarryPitch,kOpen,now,rx,ry,heading);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM && r->arm_phase==1) {
    r->arm_phase=2;
    arm_target_pitch(r,platform_grip[0],platform_grip[1],platform_grip[2],
        kCarryPitch,kOpen,now,rx,ry,heading);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_RETURNING_ARM && r->arm_phase==0) {
    r->arm_phase=1;
    const auto parked=transport_pose();
    controller_manipulator_service_start_target(&r->manipulator,&parked,s.joint_positions,s.finger_positions,now);
    std::memcpy(s.joint_targets,parked.joints,sizeof(parked.joints));arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT && r->arm_phase<2) {
    if(r->arm_phase++==0) front_clear_target(r,rx,ry,heading,kOpen,now);
    else park_target(r,now);
    arm_reached=0;
  }
  ControllerObjectTransferInput input={};
  input.navigation_reached=r->navigation->route_finished;
  input.navigation_progress=std::hypot(rx-r->progress_pose[0],ry-r->progress_pose[1])>.005 ||
      std::fabs(std::remainder(heading-r->progress_pose[2],2*3.14159265358979323846))>.005;
  if(input.navigation_progress) {r->progress_pose[0]=rx;r->progress_pose[1]=ry;r->progress_pose[2]=heading;}
  input.base_aligned=input.navigation_reached;
  input.arm_reached=arm_reached;
  input.grasp_valid=s.grip_evidence;
  if(s.stage==CONTROLLER_TRANSFER_LIFTING) input.grasp_valid=s.grip_evidence && oz>r->initial_object_z+0.07;
  if(s.stage==CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM && base)
    input.grasp_valid=s.grip_evidence && oz>base[2]+kPlatformCargoHeight+0.02;
  if(s.stage==CONTROLLER_TRANSFER_GRASPING || s.stage==CONTROLLER_TRANSFER_LIFTING ||
      s.stage==CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM ||
      s.stage==CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM) {
    const bool ready=input.grasp_valid && arm_reached;
    if(!ready) r->stable_since=-1;
    else if(r->stable_since<0) r->stable_since=now;
    input.grasp_valid=ready && now-r->stable_since>=0.25;
  }
  input.attached=r->object.attached;
  input.on_platform=platform_evidence;
  input.release_safe=s.release_evidence;
  if(s.stage==CONTROLLER_TRANSFER_PLACING_ON_PLATFORM || s.stage==CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM) {
    const bool settled=platform_evidence && speed<0.025;
    if(!settled) r->stable_since=-1;
    else if(r->stable_since<0) r->stable_since=now;
    input.on_platform=settled && now-r->stable_since>=0.25;
  }
  if(s.stage==CONTROLLER_TRANSFER_PLACING || s.stage==CONTROLLER_TRANSFER_RELEASING ||
      s.stage==CONTROLLER_TRANSFER_RETURNING_ARM) {
    if(!input.release_safe || !arm_reached) r->stable_since=-1;
    else if(r->stable_since<0) r->stable_since=now;
    input.release_safe=input.release_safe && r->stable_since>=0 && now-r->stable_since>=0.25;
  }
  input.can_lower=object_valid && s.grip_evidence;
  input.cancel_requested=cancel;
  ControllerObjectTransferOutput out={};
  controller_object_transfer_service_step(&r->service,&input,now,&out);
  if(s.status==CONTROLLER_TRANSFER_FAILED || s.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) {
    char reason[64];
    std::snprintf(reason,sizeof(reason),"%s",s.error_code);
    fail(r,reason);
  }
  if(out.attach_object) controller_webots_object_adapter_attach(&r->object);
  if(out.detach_object) controller_webots_object_adapter_detach(&r->object);
  if(out.stop_base) controller_webots_devices_reset_wheels(r->devices);
  if(s.status==CONTROLLER_TRANSFER_RUNNING) configure(r,now,rx,ry,heading);
}
