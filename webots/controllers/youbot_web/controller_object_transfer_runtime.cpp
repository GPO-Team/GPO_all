#include "controller_object_transfer_runtime.h"

#include <cmath>
#include <cstdio>
#include <cstring>

namespace {
constexpr double kGraspForwardMinimum = 0.20;
constexpr double kGraspForwardMaximum = 0.62;
constexpr double kGraspLateralMaximum = 0.14;
constexpr double kSafeReleaseRadius = 0.30;
constexpr double kGripperForwardOffset = 0.35;
constexpr double kGripperCarryHeight = 0.43;
constexpr double kPlatformOffset = -0.15;
constexpr double kPlatformCargoHeight = 0.225;
constexpr double kPlatformLiftHeight = 0.34;
constexpr double kPlatformPoseTolerance = 0.015;

int object_in_grasp_zone(
    double robot_x,
    double robot_y,
    double heading,
    double object_x,
    double object_y) {
  const double dx = object_x - robot_x;
  const double dy = object_y - robot_y;
  const double forward = std::cos(heading) * dx + std::sin(heading) * dy;
  const double lateral = -std::sin(heading) * dx + std::cos(heading) * dy;
  return forward >= kGraspForwardMinimum && forward <= kGraspForwardMaximum &&
         std::fabs(lateral) <= kGraspLateralMaximum;
}

int object_at_platform_pose(
    double robot_x,
    double robot_y,
    double heading,
    double object_x,
    double object_y,
    double object_z) {
  const double target_x = robot_x + std::cos(heading) * kPlatformOffset;
  const double target_y = robot_y + std::sin(heading) * kPlatformOffset;
  return std::hypot(object_x - target_x, object_y - target_y) <=
             kPlatformPoseTolerance &&
         std::fabs(object_z - kPlatformCargoHeight) <=
             kPlatformPoseTolerance;
}

void set_single_waypoint(
    ControllerObjectTransferRuntime *runtime,
    double x,
    double y,
    const char *mission_id) {
  ControllerRuntime *navigation = runtime->navigation;
  navigation->route.count = 1;
  navigation->route.waypoints[0] = Waypoint{x, y, 0.0, 1};
  std::snprintf(navigation->route.command_id,
                sizeof(navigation->route.command_id), "%s", mission_id);
  navigation->current_waypoint_index = 0;
  navigation->route_finished = 0;
  navigation->avoidance.active = 0;
}

void configure_stage(
    ControllerObjectTransferRuntime *runtime,
    ControllerObjectTransferStage stage,
    double now) {
  if (stage == runtime->configured_stage) return;
  runtime->configured_stage = stage;
  ControllerManipulatorPose pose = CONTROLLER_MANIPULATOR_TRANSPORT;
  int commands_arm = 1;
  switch (stage) {
    case CONTROLLER_TRANSFER_LOWERING_ARM: pose = CONTROLLER_MANIPULATOR_PRE_GRASP; break;
    case CONTROLLER_TRANSFER_GRASPING: pose = CONTROLLER_MANIPULATOR_GRASP; break;
    case CONTROLLER_TRANSFER_LIFTING: pose = CONTROLLER_MANIPULATOR_LIFT; break;
    case CONTROLLER_TRANSFER_PLACING_ON_PLATFORM:
      pose = CONTROLLER_MANIPULATOR_PLATFORM_GRASP;
      break;
    case CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM:
      pose = CONTROLLER_MANIPULATOR_PLATFORM_PRE_GRASP;
      break;
    case CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT:
      pose = CONTROLLER_MANIPULATOR_TRANSPORT;
      break;
    case CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM:
      pose = CONTROLLER_MANIPULATOR_PLATFORM_PRE_GRASP;
      break;
    case CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM:
      pose = CONTROLLER_MANIPULATOR_PLATFORM_GRASP;
      break;
    case CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM:
      pose = CONTROLLER_MANIPULATOR_PLATFORM_LIFT;
      break;
    case CONTROLLER_TRANSFER_PLACING: pose = CONTROLLER_MANIPULATOR_PLACE; break;
    case CONTROLLER_TRANSFER_RELEASING: pose = CONTROLLER_MANIPULATOR_PRE_GRASP; break;
    case CONTROLLER_TRANSFER_RETURNING_ARM: pose = CONTROLLER_MANIPULATOR_TRANSPORT; break;
    default: commands_arm = 0; break;
  }
  if (!commands_arm) return;
  controller_manipulator_service_start(&runtime->manipulator, pose, now);
  const ControllerManipulatorTarget target = runtime->manipulator.target;
  controller_webots_devices_set_manipulator(runtime->devices, target.joints,
                                             target.finger_opening);
}
}

void controller_object_transfer_carry_pose(
    ControllerObjectTransferStage stage,
    double *offset,
    double *height) {
  if (!offset || !height) return;
  switch (stage) {
    case CONTROLLER_TRANSFER_PLACING_ON_PLATFORM:
    case CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM:
    case CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM:
    case CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM:
      *offset = kPlatformOffset;
      *height = kPlatformCargoHeight;
      return;
    case CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM:
      *offset = kPlatformOffset;
      *height = kPlatformLiftHeight;
      return;
    default:
      *offset = kGripperForwardOffset;
      *height = kGripperCarryHeight;
      return;
  }
}

void controller_object_transfer_runtime_init(
    ControllerObjectTransferRuntime *runtime,
    ControllerRuntime *navigation,
    ControllerWebotsDevices *devices) {
  if (!runtime) return;
  std::memset(runtime, 0, sizeof(*runtime));
  runtime->navigation = navigation;
  runtime->devices = devices;
  controller_object_transfer_service_init(&runtime->service);
  controller_manipulator_service_init(&runtime->manipulator);
  runtime->available = controller_webots_object_adapter_init(&runtime->object, "DEMO_BOX");
}

void controller_object_transfer_runtime_command(
    ControllerObjectTransferRuntime *runtime,
    const RuntimeCommand *command,
    double now) {
  if (!runtime || !command) return;
  if (command->has_manipulator_pose) {
    controller_object_transfer_runtime_set_pose(
        runtime, command->manipulator_pose, now);
    return;
  }
  if (command->has_resume_transfer || command->has_recover_transfer) {
    if (controller_object_transfer_service_resume(&runtime->service, now)) {
      if (std::strcmp(runtime->navigation->cancelled_mission_id,
                      runtime->service.state.mission_id) == 0) {
        runtime->navigation->cancelled_mission_id[0] = '\0';
      }
      set_single_waypoint(
          runtime,
          runtime->service.state.destination_x - 0.35,
          runtime->service.state.destination_y,
          runtime->service.state.mission_id);
    }
    return;
  }
  if (!command->has_transfer_object || !runtime->available) return;
  if (!controller_object_transfer_service_start(
          &runtime->service, command->mission_id, command->object_id,
          command->destination_x, command->destination_y, now)) return;
  double object_x = 0.0, object_y = 0.0;
  controller_webots_object_adapter_position(
      &runtime->object, &object_x, &object_y, nullptr);
  set_single_waypoint(runtime, object_x - 0.42, object_y, command->mission_id);
}

int controller_object_transfer_runtime_set_pose(
    ControllerObjectTransferRuntime *runtime,
    const char *pose_name,
    double now) {
  if (!runtime || !runtime->available ||
      runtime->service.state.status == CONTROLLER_TRANSFER_RUNNING) return 0;
  ControllerManipulatorPose pose = CONTROLLER_MANIPULATOR_TRANSPORT;
  if (!controller_manipulator_pose_parse(pose_name, &pose)) return 0;
  controller_manipulator_service_start(&runtime->manipulator, pose, now);
  const ControllerManipulatorTarget target = runtime->manipulator.target;
  controller_webots_devices_set_manipulator(
      runtime->devices, target.joints, target.finger_opening);
  return 1;
}

void controller_object_transfer_runtime_step(
    ControllerObjectTransferRuntime *runtime,
    double now,
    double robot_x,
    double robot_y,
    double heading) {
  if (!runtime || runtime->service.state.status != CONTROLLER_TRANSFER_RUNNING) {
    if (runtime) {
      double joints[5] = {}, fingers[2] = {};
      if (controller_webots_devices_read_manipulator(runtime->devices, joints, fingers))
        controller_manipulator_service_step(
            &runtime->manipulator, joints, fingers, now);
    }
    if (runtime && runtime->object.attached)
      controller_webots_object_adapter_update(
          &runtime->object, robot_x, robot_y, heading,
          kGripperForwardOffset, kGripperCarryHeight,
          kPlatformOffset, kPlatformCargoHeight);
    return;
  }

  configure_stage(runtime, runtime->service.state.stage, now);
  double joints[5] = {}, fingers[2] = {};
  const int sensors_ready = controller_webots_devices_read_manipulator(
      runtime->devices, joints, fingers);
  const ControllerManipulatorStep arm_state = sensors_ready
      ? controller_manipulator_service_step(&runtime->manipulator, joints, fingers, now)
      : CONTROLLER_MANIPULATOR_MOVING;

  double object_x = 0.0, object_y = 0.0, object_z = 0.0;
  controller_webots_object_adapter_position(
      &runtime->object, &object_x, &object_y, &object_z);
  ControllerObjectTransferInput input = {};
  input.navigation_reached = runtime->navigation->route_finished;
  input.base_aligned = input.navigation_reached;
  input.arm_reached = arm_state == CONTROLLER_MANIPULATOR_REACHED;
  input.grasp_valid = object_in_grasp_zone(
      robot_x, robot_y, heading, object_x, object_y);
  input.attached = runtime->object.attached;
  input.on_platform = runtime->object.on_platform;
  input.platform_pose_reached = object_at_platform_pose(
      robot_x, robot_y, heading, object_x, object_y, object_z);
  input.release_safe = runtime->object.attached &&
      std::hypot(object_x - runtime->service.state.destination_x,
                 object_y - runtime->service.state.destination_y) <=
          kSafeReleaseRadius;
  input.cancel_requested =
      runtime->navigation->cancelled_mission_id[0] &&
      std::strcmp(runtime->navigation->cancelled_mission_id,
                  runtime->service.state.mission_id) == 0;

  const ControllerObjectTransferStage before = runtime->service.state.stage;
  ControllerObjectTransferOutput output = {};
  controller_object_transfer_service_step(&runtime->service, &input, now, &output);
  if (output.stop_base ||
      (before != CONTROLLER_TRANSFER_APPROACHING_OBJECT &&
       before != CONTROLLER_TRANSFER_TRANSPORTING)) {
    controller_webots_devices_reset_wheels(runtime->devices);
  }
  if (output.attach_object) controller_webots_object_adapter_attach(&runtime->object);
  if (output.store_object_on_platform)
    controller_webots_object_adapter_store_on_platform(&runtime->object);
  if (output.take_object_from_platform)
    controller_webots_object_adapter_take_from_platform(&runtime->object);
  if (output.detach_object) controller_webots_object_adapter_detach(&runtime->object);

  if (before != runtime->service.state.stage) {
    configure_stage(runtime, runtime->service.state.stage, now);
    if (runtime->service.state.stage == CONTROLLER_TRANSFER_TRANSPORTING) {
      set_single_waypoint(runtime,
          runtime->service.state.destination_x - 0.35,
          runtime->service.state.destination_y,
          runtime->service.state.mission_id);
    }
  }
  if (runtime->object.attached) {
    double carry_offset = kGripperForwardOffset;
    double carry_height = kGripperCarryHeight;
    controller_object_transfer_carry_pose(
        runtime->service.state.stage, &carry_offset, &carry_height);
    controller_webots_object_adapter_update(
        &runtime->object, robot_x, robot_y, heading,
        carry_offset, carry_height, kPlatformOffset, kPlatformCargoHeight);
  }
  if ((runtime->service.state.status == CONTROLLER_TRANSFER_FAILED ||
       runtime->service.state.status == CONTROLLER_TRANSFER_CANCELLED) &&
      !runtime->object.attached &&
      runtime->manipulator.pose != CONTROLLER_MANIPULATOR_TRANSPORT) {
    controller_object_transfer_runtime_set_pose(runtime, "transport", now);
  }
}
