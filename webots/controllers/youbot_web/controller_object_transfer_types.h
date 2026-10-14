#ifndef CONTROLLER_OBJECT_TRANSFER_TYPES_H
#define CONTROLLER_OBJECT_TRANSFER_TYPES_H
typedef enum {CONTROLLER_TRANSFER_STAGE_NONE=0,CONTROLLER_TRANSFER_APPROACHING_OBJECT,CONTROLLER_TRANSFER_ALIGNING,CONTROLLER_TRANSFER_LOWERING_ARM,CONTROLLER_TRANSFER_GRASPING,CONTROLLER_TRANSFER_LIFTING,CONTROLLER_TRANSFER_TRANSPORTING,CONTROLLER_TRANSFER_PLACING,CONTROLLER_TRANSFER_RELEASING,CONTROLLER_TRANSFER_RETURNING_ARM} ControllerObjectTransferStage;
typedef enum {CONTROLLER_TRANSFER_IDLE=0,CONTROLLER_TRANSFER_ACCEPTED,CONTROLLER_TRANSFER_RUNNING,CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY,CONTROLLER_TRANSFER_COMPLETED,CONTROLLER_TRANSFER_FAILED,CONTROLLER_TRANSFER_CANCELLED} ControllerObjectTransferStatus;
typedef struct {char mission_id[64];char object_id[32];double destination_x;double destination_y;ControllerObjectTransferStatus status;ControllerObjectTransferStage stage;int progress;int attached;int gripper_closed;int alignment_retries;char error_code[64];double stage_started_at;
  double joint_positions[5]; double joint_targets[5]; double finger_positions[2];
  double motor_efforts[7]; double tcp_pose[3]; double object_pose[3];
  int sensors_valid; int grip_evidence; int release_evidence; int cancel_pending;
  char controller_boot_id[64];
  unsigned int recovery_epoch;
} ControllerObjectTransferState;
typedef struct {int navigation_reached;int base_aligned;int arm_reached;int grasp_valid;int attached;int release_safe;int cancel_requested;int can_lower;} ControllerObjectTransferInput;
typedef struct {int stop_base;int request_navigation;int request_arm_pose;int close_gripper;int attach_object;int detach_object;} ControllerObjectTransferOutput;
#endif
