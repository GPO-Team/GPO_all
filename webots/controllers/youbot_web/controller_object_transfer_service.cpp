#include "controller_object_transfer_service.h"

#include <cstdio>
#include <cstring>

namespace {
constexpr double kTimeout = 30.0;
constexpr double kNavigationTimeout = 180.0;

int progress(ControllerObjectTransferStage stage) {
  static const int values[] = {
      0, 5, 10, 16, 22, 28, 34, 39, 44, 50, 65, 70, 76, 82, 90, 96};
  if (stage < CONTROLLER_TRANSFER_STAGE_NONE ||
      stage > CONTROLLER_TRANSFER_RETURNING_ARM) {
    return 0;
  }
  return values[stage];
}

void enter(
    ControllerObjectTransferState *state,
    ControllerObjectTransferStage stage,
    double now) {
  state->stage = stage;
  state->stage_started_at = now;
  state->progress = progress(stage);
}

void fail(ControllerObjectTransferState *state, const char *error) {
  state->status = CONTROLLER_TRANSFER_FAILED;
  state->stage = CONTROLLER_TRANSFER_STAGE_NONE;
  std::snprintf(state->error_code, sizeof(state->error_code), "%s", error);
}
}

void controller_object_transfer_service_init(
    ControllerObjectTransferService *service) {
  if (!service) return;
  std::memset(service, 0, sizeof(*service));
}

int controller_object_transfer_service_start(
    ControllerObjectTransferService *service,
    const char *mission_id,
    const char *object_id,
    double destination_x,
    double destination_y,
    double now) {
  if (!service || !mission_id || !object_id ||
      service->state.status == CONTROLLER_TRANSFER_RUNNING) {
    return 0;
  }

  controller_object_transfer_service_init(service);
  std::snprintf(
      service->state.mission_id,
      sizeof(service->state.mission_id),
      "%s",
      mission_id);
  std::snprintf(
      service->state.object_id,
      sizeof(service->state.object_id),
      "%s",
      object_id);
  service->state.destination_x = destination_x;
  service->state.destination_y = destination_y;
  service->state.status = CONTROLLER_TRANSFER_RUNNING;
  enter(&service->state, CONTROLLER_TRANSFER_APPROACHING_OBJECT, now);
  return 1;
}

void controller_object_transfer_service_step(
    ControllerObjectTransferService *service,
    const ControllerObjectTransferInput *input,
    double now,
    ControllerObjectTransferOutput *output) {
  if (!service || !input || !output) return;

  std::memset(output, 0, sizeof(*output));
  ControllerObjectTransferState *state = &service->state;
  if (state->status != CONTROLLER_TRANSFER_RUNNING) return;

  if (input->cancel_requested) {
    output->stop_base = 1;
    if (state->attached || input->attached) {
      if (!input->release_safe) {
        state->attached = 1;
        state->status = CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
        std::snprintf(
            state->error_code,
            sizeof(state->error_code),
            "%s",
            "unsafe_release");
        return;
      }
      output->detach_object = 1;
      state->attached = 0;
      state->on_platform = 0;
    }
    state->status = CONTROLLER_TRANSFER_CANCELLED;
    state->stage = CONTROLLER_TRANSFER_STAGE_NONE;
    return;
  }

  const double elapsed = now - state->stage_started_at;
  switch (state->stage) {
    case CONTROLLER_TRANSFER_APPROACHING_OBJECT:
      output->request_navigation = 1;
      if (input->navigation_reached) {
        enter(state, CONTROLLER_TRANSFER_ALIGNING, now);
      } else if (elapsed > kNavigationTimeout) {
        fail(state, "navigation_failed");
      }
      break;
    case CONTROLLER_TRANSFER_ALIGNING:
      if (input->base_aligned) {
        enter(state, CONTROLLER_TRANSFER_LOWERING_ARM, now);
      } else if (elapsed > kTimeout && state->alignment_retries++ == 0) {
        state->stage_started_at = now;
      } else if (elapsed > kTimeout) {
        fail(state, "alignment_failed");
      }
      break;
    case CONTROLLER_TRANSFER_LOWERING_ARM:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        enter(state, CONTROLLER_TRANSFER_GRASPING, now);
      } else if (elapsed > kTimeout) {
        fail(state, "arm_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_GRASPING:
      output->close_gripper = 1;
      if (input->arm_reached && input->grasp_valid) {
        output->attach_object = 1;
        state->attached = 1;
        state->gripper_closed = 1;
        enter(state, CONTROLLER_TRANSFER_LIFTING, now);
      } else if (elapsed > kTimeout) {
        fail(state, "grasp_failed");
      }
      break;
    case CONTROLLER_TRANSFER_LIFTING:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        enter(state, CONTROLLER_TRANSFER_PLACING_ON_PLATFORM, now);
      } else if (elapsed > kTimeout) {
        fail(state, "arm_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_PLACING_ON_PLATFORM:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        enter(state, CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM, now);
      } else if (elapsed > kTimeout) {
        fail(state, "platform_place_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM:
      if (input->arm_reached && input->platform_pose_reached) {
        output->store_object_on_platform = 1;
        state->on_platform = 1;
        state->gripper_closed = 0;
        enter(state, CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT, now);
      } else if (elapsed > kTimeout) {
        fail(state, "platform_release_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        enter(state, CONTROLLER_TRANSFER_TRANSPORTING, now);
      } else if (elapsed > kTimeout) {
        fail(state, "arm_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_TRANSPORTING:
      output->request_navigation = 1;
      if (input->navigation_reached) {
        enter(state, CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM, now);
      } else if (elapsed > kNavigationTimeout) {
        fail(state, "navigation_failed");
      }
      break;
    case CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        enter(state, CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM, now);
      } else if (elapsed > kTimeout) {
        fail(state, "platform_pick_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM:
      output->close_gripper = 1;
      if (input->arm_reached && input->attached && input->on_platform) {
        output->take_object_from_platform = 1;
        state->on_platform = 0;
        state->gripper_closed = 1;
        enter(state, CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM, now);
      } else if (elapsed > kTimeout) {
        fail(state, "platform_grasp_failed");
      }
      break;
    case CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        enter(state, CONTROLLER_TRANSFER_PLACING, now);
      } else if (elapsed > kTimeout) {
        fail(state, "arm_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_PLACING:
      output->request_arm_pose = 1;
      if (input->arm_reached && input->release_safe) {
        enter(state, CONTROLLER_TRANSFER_RELEASING, now);
      } else if (elapsed > kTimeout) {
        state->status = CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
        std::snprintf(
            state->error_code,
            sizeof(state->error_code),
            "%s",
            "unsafe_release");
      }
      break;
    case CONTROLLER_TRANSFER_RELEASING:
      if (input->arm_reached) {
        output->detach_object = 1;
        state->attached = 0;
        state->on_platform = 0;
        state->gripper_closed = 0;
        enter(state, CONTROLLER_TRANSFER_RETURNING_ARM, now);
      } else if (elapsed > kTimeout) {
        state->status = CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY;
        std::snprintf(
            state->error_code,
            sizeof(state->error_code),
            "%s",
            "release_timeout");
      }
      break;
    case CONTROLLER_TRANSFER_RETURNING_ARM:
      output->request_arm_pose = 1;
      if (input->arm_reached) {
        state->status = CONTROLLER_TRANSFER_COMPLETED;
        state->stage = CONTROLLER_TRANSFER_STAGE_NONE;
        state->progress = 100;
      } else if (elapsed > kTimeout) {
        fail(state, "arm_timeout");
      }
      break;
    default:
      break;
  }
}

int controller_object_transfer_service_resume(
    ControllerObjectTransferService *service,
    double now) {
  if (!service ||
      service->state.status != CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY) {
    return 0;
  }
  service->state.status = CONTROLLER_TRANSFER_RUNNING;
  service->state.error_code[0] = '\0';
  ControllerObjectTransferStage recovery_stage =
      service->state.on_platform
          ? CONTROLLER_TRANSFER_TRANSPORTING
          : CONTROLLER_TRANSFER_PLACING_ON_PLATFORM;
  if (!service->state.on_platform &&
      service->state.stage >= CONTROLLER_TRANSFER_PLACING) {
    recovery_stage = service->state.stage;
  }
  enter(&service->state, recovery_stage, now);
  return 1;
}
