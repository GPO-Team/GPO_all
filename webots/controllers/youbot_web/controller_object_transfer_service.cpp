#include "controller_object_transfer_service.h"
#include <cstdio>
#include <cstring>
#include <cmath>
namespace {
constexpr double kTimeout = 30.0;
void enter(ControllerObjectTransferState *s, ControllerObjectTransferStage stage, double now) {
  static const int progress[] = {0,5,15,25,35,45,60,78,88,95};
  s->stage = stage; s->stage_started_at = now; s->progress = progress[stage];
}
void fault(ControllerObjectTransferState *s, const char *code) {
  if(s->attached && s->status!=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) ++s->recovery_epoch;
  s->status = s->attached ? CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY : CONTROLLER_TRANSFER_FAILED;
  std::snprintf(s->error_code, sizeof(s->error_code), "%s", code);
}
}
void controller_object_transfer_service_init(ControllerObjectTransferService *s) {
  if (s) std::memset(s, 0, sizeof(*s));
}
int controller_object_transfer_service_start(ControllerObjectTransferService *service,
    const char *id, const char *object, double x, double y, double now) {
  if (!service || !id || !object || !std::isfinite(x) || !std::isfinite(y) ||
      service->state.status == CONTROLLER_TRANSFER_RUNNING ||
      service->state.status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY || service->state.attached) return 0;
  controller_object_transfer_service_init(service);
  auto *s = &service->state;
  std::snprintf(s->mission_id,sizeof(s->mission_id),"%s",id);
  std::snprintf(s->object_id,sizeof(s->object_id),"%s",object);
  s->destination_x=x; s->destination_y=y; s->status=CONTROLLER_TRANSFER_RUNNING;
  enter(s,CONTROLLER_TRANSFER_APPROACHING_OBJECT,now); return 1;
}
void controller_object_transfer_service_step(ControllerObjectTransferService *service,
    const ControllerObjectTransferInput *in, double now, ControllerObjectTransferOutput *out) {
  if (!service || !in || !out) return;
  std::memset(out,0,sizeof(*out)); auto *s=&service->state;
  if(s->status == CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY && in->cancel_requested && in->can_lower) {
    s->status=CONTROLLER_TRANSFER_RUNNING; s->cancel_pending=0; s->error_code[0]=0;
  }
  if (s->status != CONTROLLER_TRANSFER_RUNNING) return;
  if (in->cancel_requested && !s->cancel_pending) {
    out->stop_base=1;
    if (s->attached || in->attached) {
      s->attached=1;
      if (!in->release_safe && !in->can_lower) { fault(s,"unsafe_release"); return; }
      s->cancel_pending=1; enter(s,CONTROLLER_TRANSFER_PLACING,now);
    } else { s->status=CONTROLLER_TRANSFER_CANCELLED; s->stage=CONTROLLER_TRANSFER_STAGE_NONE; return; }
  }
  const double elapsed=now-s->stage_started_at;
  switch(s->stage) {
    case CONTROLLER_TRANSFER_APPROACHING_OBJECT:
      out->request_navigation=1;
      if(in->navigation_reached) enter(s,CONTROLLER_TRANSFER_ALIGNING,now);
      else if(elapsed>180.0) fault(s,"navigation_failed"); break;
    case CONTROLLER_TRANSFER_ALIGNING:
      if(in->base_aligned) enter(s,CONTROLLER_TRANSFER_LOWERING_ARM,now);
      else if(elapsed>kTimeout && s->alignment_retries++==0) s->stage_started_at=now;
      else if(elapsed>kTimeout) fault(s,"alignment_failed"); break;
    case CONTROLLER_TRANSFER_LOWERING_ARM:
      out->request_arm_pose=1;
      if(in->arm_reached) enter(s,CONTROLLER_TRANSFER_GRASPING,now);
      else if(elapsed>kTimeout) fault(s,"arm_timeout"); break;
    case CONTROLLER_TRANSFER_GRASPING:
      out->close_gripper=1;
      if(in->arm_reached && in->grasp_valid) {
        out->attach_object=1; s->attached=1; s->gripper_closed=1; enter(s,CONTROLLER_TRANSFER_LIFTING,now);
      } else if(elapsed>kTimeout) fault(s,"grasp_failed"); break;
    case CONTROLLER_TRANSFER_LIFTING:
      out->request_arm_pose=1;
      if(in->arm_reached && in->attached && in->grasp_valid) enter(s,CONTROLLER_TRANSFER_TRANSPORTING,now);
      else if(elapsed>kTimeout) fault(s,"lift_failed"); break;
    case CONTROLLER_TRANSFER_TRANSPORTING:
      out->request_navigation=1;
      if(!in->attached) fault(s,"grip_lost");
      else if(in->navigation_reached) enter(s,CONTROLLER_TRANSFER_PLACING,now);
      else if(elapsed>180.0) fault(s,"navigation_failed"); break;
    case CONTROLLER_TRANSFER_PLACING:
      out->request_arm_pose=1;
      if(in->arm_reached && in->release_safe) enter(s,CONTROLLER_TRANSFER_RELEASING,now);
      else if(elapsed>kTimeout) fault(s,"unsafe_release"); break;
    case CONTROLLER_TRANSFER_RELEASING:
      if(in->arm_reached && in->release_safe) {
        out->detach_object=1; s->attached=0; s->gripper_closed=0; enter(s,CONTROLLER_TRANSFER_RETURNING_ARM,now);
      } else if(elapsed>kTimeout) fault(s,"release_failed"); break;
    case CONTROLLER_TRANSFER_RETURNING_ARM:
      out->request_arm_pose=1;
      if(in->arm_reached && in->release_safe) {
        s->status=s->cancel_pending ? CONTROLLER_TRANSFER_CANCELLED : CONTROLLER_TRANSFER_COMPLETED;
        s->stage=CONTROLLER_TRANSFER_STAGE_NONE; s->progress=100;
      } else if(elapsed>kTimeout) fault(s,"placement_failed"); break;
    default: break;
  }
  if(s->status!=CONTROLLER_TRANSFER_RUNNING) out->stop_base=1;
}
int controller_object_transfer_service_resume(ControllerObjectTransferService *service,double now) {
  if(!service || service->state.status!=CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) return 0;
  service->state.status=CONTROLLER_TRANSFER_RUNNING;
  if(service->state.attached) {
    service->state.error_code[0]=0;
    enter(&service->state,CONTROLLER_TRANSFER_LIFTING,now);
  } else {
    service->state.cancel_pending=1;
    enter(&service->state,CONTROLLER_TRANSFER_RETURNING_ARM,now);
  }
  return 1;
}
