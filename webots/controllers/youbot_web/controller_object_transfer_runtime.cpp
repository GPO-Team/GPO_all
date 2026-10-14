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
constexpr double kHandleCenterOffset=0.10;
constexpr double kGripDistance=0.40;
constexpr double kDestinationGripDistance=0.40;
constexpr double kOpen=0.0115;
constexpr double kPlatformOffset=-0.09;
constexpr double kPlatformCargoHeight=0.1235;
constexpr double kPlatformPlacePitch=2.4;
constexpr double kPlatformGripPitch=2.4;
constexpr double kPlatformTcpForward=0.111;
constexpr double kPlatformTcpHeight=0.055;
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
  const auto parked=controller_manipulator_service_target(CONTROLLER_MANIPULATOR_TRANSPORT);
  bool arm_parked=r->have_joint_measurement;
  for(int i=0;i<5;++i) arm_parked=arm_parked && std::fabs(s.joint_positions[i]-parked.joints[i])<0.05;
  const bool needs_recovery=s.attached || !arm_parked;
  if(needs_recovery && s.status!=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) ++s.recovery_epoch;
  s.status=needs_recovery ? CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY : CONTROLLER_TRANSFER_FAILED;
  std::snprintf(s.error_code,sizeof(s.error_code),"%s",error);
  if(r->have_joint_measurement) controller_webots_devices_set_manipulator(r->devices,s.joint_positions,
      s.attached ? 0.0 : (s.finger_positions[0]+s.finger_positions[1])*0.5);
  controller_webots_devices_reset_wheels(r->devices);
}
void waypoint(ControllerObjectTransferRuntime *r,double x,double y) {
  auto *n=r->navigation;
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  if(!controller_transfer_route_plan(&n->limit_zones,base[0],base[1],x,y,
      (r->service.state.attached || r->service.state.on_platform) ? 0.50 : 0.36,&n->route)) {
    fail(r,"navigation_unreachable"); return;
  }
  std::snprintf(n->route.command_id,sizeof(n->route.command_id),"%s",r->service.state.mission_id);
  n->current_waypoint_index=0; n->route_finished=0; n->mapping_survey.route_active=0;
  n->cancelled_mission_id[0]=0;
  controller_navigation_state_reset(n,x,y);
}
int arm_target_pitch(ControllerObjectTransferRuntime *r,double wx,double wy,double wz,
    double pitch,double opening,double now,double rx,double ry,double heading) {
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  const double dx=wx-rx,dy=wy-ry;
  ControllerManipulatorTcp tcp={std::cos(heading)*dx+std::sin(heading)*dy,
      -std::sin(heading)*dx+std::cos(heading)*dy,wz-base[2],pitch,0.0};
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
  std::memcpy(r->service.state.joint_targets,target.joints,sizeof(target.joints)); return 1;
}
int arm_target(ControllerObjectTransferRuntime *r,double wx,double wy,double wz,
    double opening,double now,double rx,double ry,double heading) {
  return arm_target_pitch(r,wx,wy,wz,-2.8,opening,now,rx,ry,heading);
}
void platform_target(ControllerObjectTransferRuntime *r,double rx,double ry,double heading,
    double height_offset,double opening,double now) {
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  double pose[3]={};
  controller_object_transfer_platform_pose(rx,ry,base[2],heading,pose);
  pose[0]+=std::cos(heading)*kPlatformTcpForward;
  pose[1]+=std::sin(heading)*kPlatformTcpForward;
  if(arm_target_pitch(r,pose[0],pose[1],pose[2]+kPlatformTcpHeight+height_offset,
      kPlatformPlacePitch,opening,now,rx,ry,heading)) {
    r->manipulator.duration_seconds*=2.0;
    const double timeout=r->manipulator.duration_seconds+3.0;
    if(r->manipulator.timeout_seconds<timeout) r->manipulator.timeout_seconds=timeout;
  }
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
  const double ox=s.object_pose[0],oy=s.object_pose[1];
  double platform_handle[3]={};
  object_handle_center(r,ox,oy,s.object_pose[2],platform_handle);
  switch(s.stage) {
    case CONTROLLER_TRANSFER_LOWERING_ARM:
      arm_target(r,ox,oy,s.object_pose[2]+kHandleOffset+0.06,kOpen,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_GRASPING:
      arm_target(r,ox,oy,s.object_pose[2]+kHandleOffset,0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_LIFTING:
      arm_target(r,ox,oy,r->initial_object_z+kHandleOffset+0.08,0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_PLACING_ON_PLATFORM:
      platform_target(r,rx,ry,heading,0.06,0.0,now); break;
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
      platform_target(r,rx,ry,heading,0.06,kOpen,now); break;
    case CONTROLLER_TRANSFER_TRANSPORTING:
      waypoint(r,s.destination_x-kDestinationGripDistance,s.destination_y); break;
    case CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM:
      arm_target_pitch(r,platform_handle[0],platform_handle[1],platform_handle[2]+0.06,
          kPlatformGripPitch,kOpen,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM:
      arm_target_pitch(r,platform_handle[0],platform_handle[1],platform_handle[2],
          kPlatformGripPitch,0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM:
      arm_target_pitch(r,platform_handle[0],platform_handle[1],platform_handle[2]+0.10,
          kPlatformGripPitch,0.0,now,rx,ry,heading); break;
    case CONTROLLER_TRANSFER_PLACING:
      arm_target(r,s.destination_x,s.destination_y,r->initial_object_z+kHandleOffset+0.06,
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
      if(!s.attached && !r->object.attached && s.error_code[0]) {
        r->arm_phase=1;
        auto parked=controller_manipulator_service_target(CONTROLLER_MANIPULATOR_TRANSPORT);
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
void controller_object_transfer_platform_pose(double robot_x,double robot_y,double robot_z,
    double heading,double pose[3]) {
  if(!pose) return;
  pose[0]=robot_x+std::cos(heading)*kPlatformOffset;
  pose[1]=robot_y+std::sin(heading)*kPlatformOffset;
  pose[2]=robot_z+kPlatformCargoHeight;
}
int controller_object_transfer_object_on_platform(double robot_x,double robot_y,double robot_z,
    double heading,double object_x,double object_y,double object_z) {
  double pose[3]={};
  controller_object_transfer_platform_pose(robot_x,robot_y,robot_z,heading,pose);
  return std::hypot(object_x-pose[0],object_y-pose[1])<0.075 &&
      std::fabs(object_z-pose[2])<0.04;
}
void controller_object_transfer_runtime_init(ControllerObjectTransferRuntime *r,
    ControllerRuntime *n,ControllerWebotsDevices *d) {
  if(!r) return; std::memset(r,0,sizeof(*r)); r->navigation=n; r->devices=d;
  controller_object_transfer_service_init(&r->service);
  controller_manipulator_service_init(&r->manipulator);
  r->available=controller_webots_object_adapter_init(&r->object,"DEMO_BOX");
  r->tcp_node=wb_supervisor_node_get_from_def("TCP");
  if(!r->tcp_node) r->tcp_node=wb_supervisor_node_get_from_proto_def(wb_supervisor_node_get_self(),"TCP");
  r->available=r->available && r->tcp_node;
  const auto stamp=std::chrono::system_clock::now().time_since_epoch().count();
  std::snprintf(r->boot_id,sizeof(r->boot_id),"webots-%lld",(long long)stamp);
  std::snprintf(r->service.state.controller_boot_id,sizeof(r->boot_id),"%s",r->boot_id);
  r->stable_since=-1;
}
void controller_object_transfer_runtime_command(ControllerObjectTransferRuntime *r,
    const RuntimeCommand *c,double now) {
  if(!r || !c) return;
  if(c->has_resume_transfer || c->has_recover_transfer) {
    if(std::strcmp(c->mission_id,r->service.state.mission_id)==0 && r->service.state.sensors_valid &&
        (!r->service.state.attached || (r->object.attached && r->service.state.grip_evidence))) {
      if(!r->service.state.attached) {
        r->service.state.destination_x=r->service.state.object_pose[0];
        r->service.state.destination_y=r->service.state.object_pose[1];
      }
      if(controller_object_transfer_service_resume(&r->service,now))
        r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
    } return;
  }
  if(!c->has_transfer_object) return;
  if(!controller_object_transfer_service_start(&r->service,c->mission_id,c->object_id,
      c->destination_x,c->destination_y,now)) return;
  std::snprintf(r->service.state.controller_boot_id,sizeof(r->boot_id),"%s",r->boot_id);
  if(!r->available) { fail(r,"arm_unavailable"); return; }
  if(std::strcmp(c->object_id,"demo-box")!=0) { fail(r,"unsupported_object"); return; }
  double x=0,y=0,z=0;
  if(!controller_webots_object_adapter_position(&r->object,&x,&y,&z)) { fail(r,"object_unavailable"); return; }
  r->initial_object_z=z; r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
  r->cancel_recovery_attempted=0;
  waypoint(r,x-kGripDistance,y);
}
int controller_object_transfer_runtime_allows_navigation(const ControllerObjectTransferRuntime *r) {
  if(!r) return 1;
  const auto &s=r->service.state;
  if(s.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) return 0;
  if(s.status==CONTROLLER_TRANSFER_FAILED)
    return std::strcmp(r->navigation->route.command_id,s.mission_id)!=0;
  if(s.status!=CONTROLLER_TRANSFER_RUNNING) return 1;
  return s.stage==CONTROLLER_TRANSFER_APPROACHING_OBJECT || s.stage==CONTROLLER_TRANSFER_TRANSPORTING;
}
void controller_object_transfer_runtime_hold(ControllerObjectTransferRuntime *r,const char *reason) {
  if(r && reason) fail(r,reason);
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
  const double *base=wb_supervisor_node_get_position(wb_supervisor_node_get_self());
  const bool platform_evidence=object_valid && base &&
      controller_object_transfer_object_on_platform(rx,ry,base[2],heading,ox,oy,oz);
  const double *object_orientation=r->object.node ? wb_supervisor_node_get_orientation(r->object.node) : nullptr;
  if(object_orientation) {
    s.object_up[0]=object_orientation[2];
    s.object_up[1]=object_orientation[5];
    s.object_up[2]=object_orientation[8];
  }
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
  const bool contact_grip=grip_sensors && finger_gap>0.0001 && std::fabs(r->contacts[0])>0.05 &&
      std::fabs(r->contacts[1])>0.05 && (platform_grasp ? platform_grasp_error<0.03 : grasp_error<0.025);
  s.grip_evidence=contact_grip || (r->object.attached &&
      controller_webots_object_adapter_locked(&r->object));
  if(s.grip_evidence) r->last_grip_seen=now;
  const bool monitoring_grip=s.stage!=CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM &&
      s.stage!=CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT &&
      s.stage!=CONTROLLER_TRANSFER_TRANSPORTING && s.stage!=CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM &&
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
      // Stop with the cargo resource held; losing the physical grip elsewhere is recoverable.
      fail(r,"grip_lost");
    }
  }
  s.release_evidence=object_valid && std::fabs(oz-r->initial_object_z)<0.07 && speed<0.025 &&
      std::hypot(ox-s.destination_x,oy-s.destination_y)<0.05;
  const bool cancel=r->navigation->cancelled_mission_id[0] &&
      std::strcmp(r->navigation->cancelled_mission_id,s.mission_id)==0;
  if(s.status==CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY && cancel && s.grip_evidence && !r->cancel_recovery_attempted) {
    r->cancel_recovery_attempted=1;
    s.status=CONTROLLER_TRANSFER_RUNNING; s.cancel_pending=1;
    s.destination_x=ox;s.destination_y=oy;
    s.stage=CONTROLLER_TRANSFER_PLACING;s.stage_started_at=now;
    r->configured_stage=CONTROLLER_TRANSFER_STAGE_NONE;
  }
  if(s.status!=CONTROLLER_TRANSFER_RUNNING) return;
  if(!s.sensors_valid || !grip_sensors || !tcp) { fail(r,"sensor_invalid"); return; }
  if(cancel && s.attached && !s.cancel_pending) {
    s.destination_x=ox;s.destination_y=oy;
    // Safe cancellation lowers at the current horizontal position on the floor.
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
  auto arm=controller_manipulator_service_step(&r->manipulator,s.joint_positions,s.finger_positions,now);
  if(arm==CONTROLLER_MANIPULATOR_INVALID) { fail(r,"sensor_invalid"); return; }
  if(arm==CONTROLLER_MANIPULATOR_TIMED_OUT) { fail(r,"arm_timeout"); return; }
  const auto command=controller_manipulator_service_sample(&r->manipulator,now);
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
  if(s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM && r->arm_phase>0 && tcp_valid) {
    const double target_x=platform_grip[0];
    const double target_y=platform_grip[1];
    const double target_z=platform_grip[2]+(r->arm_phase==1 ? 0.01 : 0.0);
    if(std::hypot(std::hypot(tcp[0]-target_x,tcp[1]-target_y),tcp[2]-target_z)<0.03)
      arm_reached=1;
  }
  if(s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM &&
      r->configured_stage!=CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM) arm_reached=0;
  if(arm_reached && (s.stage==CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM ||
      s.stage==CONTROLLER_TRANSFER_RELEASING)) {
    arm_reached=std::fabs(s.finger_positions[0]-kOpen)<0.003 &&
        std::fabs(s.finger_positions[1]-kOpen)<0.003;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_LOWERING_ARM && r->arm_phase==0) {
    r->arm_phase=1; arm_target(r,ox,oy,oz+kHandleOffset,kOpen,now,rx,ry,heading); arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PLACING && r->arm_phase==0) {
    r->arm_phase=1; arm_target(r,s.destination_x,s.destination_y,r->initial_object_z+kHandleOffset,
        0.0,now,rx,ry,heading);arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PLACING_ON_PLATFORM && r->arm_phase==0) {
    r->arm_phase=1;
    platform_target(r,rx,ry,heading,0.0,0.0,now);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM && r->arm_phase==0) {
    r->arm_phase=1;
    arm_target_pitch(r,platform_grip[0],platform_grip[1],platform_grip[2]+0.01,
        kPlatformGripPitch,kOpen,now,rx,ry,heading);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM && r->arm_phase==1) {
    r->arm_phase=2;
    arm_target_pitch(r,platform_grip[0],platform_grip[1],platform_grip[2],
        kPlatformGripPitch,kOpen,now,rx,ry,heading);
    arm_reached=0;
  }
  if(arm_reached && s.stage==CONTROLLER_TRANSFER_RETURNING_ARM && r->arm_phase==0) {
    r->arm_phase=1;
    const auto parked=controller_manipulator_service_target(CONTROLLER_MANIPULATOR_TRANSPORT);
    controller_manipulator_service_start_target(&r->manipulator,&parked,s.joint_positions,s.finger_positions,now);
    std::memcpy(s.joint_targets,parked.joints,sizeof(parked.joints));arm_reached=0;
  }
  ControllerObjectTransferInput input={};
  input.navigation_reached=r->navigation->route_finished;
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
  if(s.stage==CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM) {
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
