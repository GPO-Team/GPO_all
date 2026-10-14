#ifndef CONTROLLER_OBJECT_TRANSFER_TYPES_H
#define CONTROLLER_OBJECT_TRANSFER_TYPES_H

typedef enum {
  CONTROLLER_TRANSFER_STAGE_NONE = 0,
  CONTROLLER_TRANSFER_APPROACHING_OBJECT,
  CONTROLLER_TRANSFER_ALIGNING,
  CONTROLLER_TRANSFER_LOWERING_ARM,
  CONTROLLER_TRANSFER_GRASPING,
  CONTROLLER_TRANSFER_LIFTING,
  CONTROLLER_TRANSFER_PLACING_ON_PLATFORM,
  CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM,
  CONTROLLER_TRANSFER_RETURNING_ARM_FOR_TRANSPORT,
  CONTROLLER_TRANSFER_TRANSPORTING,
  CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM,
  CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM,
  CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM,
  CONTROLLER_TRANSFER_PLACING,
  CONTROLLER_TRANSFER_RELEASING,
  CONTROLLER_TRANSFER_RETURNING_ARM,
} ControllerObjectTransferStage;

typedef enum {
  CONTROLLER_TRANSFER_IDLE = 0,
  CONTROLLER_TRANSFER_ACCEPTED,
  CONTROLLER_TRANSFER_RUNNING,
  CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY,
  CONTROLLER_TRANSFER_COMPLETED,
  CONTROLLER_TRANSFER_FAILED,
  CONTROLLER_TRANSFER_CANCELLED,
} ControllerObjectTransferStatus;

typedef struct {
  char mission_id[64];
  char object_id[32];
  double destination_x;
  double destination_y;
  ControllerObjectTransferStatus status;
  ControllerObjectTransferStage stage;
  int progress;
  int attached;
  int on_platform;
  int gripper_closed;
  int alignment_retries;
  char error_code[64];
  double stage_started_at;
} ControllerObjectTransferState;

typedef struct {
  int navigation_reached;
  int base_aligned;
  int arm_reached;
  int grasp_valid;
  int attached;
  int on_platform;
  int platform_pose_reached;
  int release_safe;
  int cancel_requested;
} ControllerObjectTransferInput;

typedef struct {
  int stop_base;
  int request_navigation;
  int request_arm_pose;
  int close_gripper;
  int attach_object;
  int detach_object;
  int store_object_on_platform;
  int take_object_from_platform;
} ControllerObjectTransferOutput;

#endif
