#include "controller_telemetry.h"

#include "controller_io.h"

#include <stdio.h>
#include <cmath>

#define CONTROLLER_TELEMETRY_PI 3.14159265358979323846

static const char *safe_text(const char *value) {
  return value ? value : "";
}

static const char *safe_command_id(const char *value) {
  if (!value) return "";
  for (const char *cursor = value; *cursor; ++cursor) {
    if (!((*cursor >= 'a' && *cursor <= 'z') || (*cursor >= 'A' && *cursor <= 'Z') ||
          (*cursor >= '0' && *cursor <= '9') || *cursor == '-' || *cursor == '_')) return "";
  }
  return value;
}

static const char *json_bool(int value) {
  return value ? "true" : "false";
}

static const char *transfer_status(ControllerObjectTransferStatus status) {
  switch (status) {
    case CONTROLLER_TRANSFER_RUNNING: return "running";
    case CONTROLLER_TRANSFER_HOLDING_FOR_RECOVERY: return "holding_for_recovery";
    case CONTROLLER_TRANSFER_COMPLETED: return "completed";
    case CONTROLLER_TRANSFER_FAILED: return "failed";
    case CONTROLLER_TRANSFER_CANCELLED: return "cancelled";
    case CONTROLLER_TRANSFER_ACCEPTED: return "accepted";
    default: return "idle";
  }
}

static const char *transfer_stage(ControllerObjectTransferStage stage) {
  static const char *names[] = {"none", "approaching_object", "aligning", "lowering_arm",
      "grasping", "lifting", "placing_on_platform", "releasing_on_platform",
      "returning_arm_for_transport", "transporting", "picking_from_platform",
      "grasping_from_platform", "lifting_from_platform", "placing", "releasing",
      "returning_arm"};
  return stage >= CONTROLLER_TRANSFER_STAGE_NONE && stage <= CONTROLLER_TRANSFER_RETURNING_ARM
      ? names[stage] : "none";
}

int controller_telemetry_write_snapshot(
    const char *temp_path,
    const char *state_path,
    const ControllerTelemetrySnapshot *snapshot) {
  if (!temp_path || !state_path || !snapshot) return 0;
  FILE *file = fopen(temp_path, "w");
  if (!file) return 0;

  fprintf(file, "{\n");
  fprintf(file, "  \"coordinateContractVersion\": 1,\n");
  fprintf(file, "  \"simulationTime\": %.6f,\n", snapshot->simulation_time);
  fprintf(file, "  \"pose\": {\n    \"x\": %.6f,\n    \"y\": %.6f,\n    \"z\": %.6f,\n    \"yaw\": %.6f\n  },\n",
          snapshot->pose_x, snapshot->pose_y, snapshot->pose_z, snapshot->pose_yaw);
  fprintf(file, "  \"robot\": {\n    \"x\": %.6f,\n    \"y\": %.6f,\n    \"z\": %.6f,\n    \"heading\": %.6f\n  },\n",
          snapshot->pose_x, snapshot->pose_y, snapshot->pose_z, snapshot->pose_yaw);

  const ControllerTelemetryNavigation *navigation = &snapshot->navigation;
  fprintf(file, "  \"navigation\": {\n");
  fprintf(file, "    \"missionId\": \"%s\",\n", safe_command_id(navigation->command_id));
  fprintf(file, "    \"status\": \"%s\",\n", safe_text(navigation->status));
  fprintf(file, "    \"error\": \"%s\",\n", safe_text(navigation->error));
  fprintf(file, "    \"currentWaypointIndex\": %d,\n", navigation->current_waypoint_index);
  fprintf(file, "    \"finished\": %s,\n", json_bool(navigation->finished));
  fprintf(file, "    \"distanceToTarget\": %.6f,\n", navigation->distance_to_target);
  fprintf(file, "    \"avoidanceActive\": %s,\n", json_bool(navigation->avoidance_active));
  fprintf(file, "    \"offRouteActive\": %s,\n", json_bool(navigation->off_route_active));
  fprintf(file, "    \"avoidanceTimeSec\": %.6f,\n", navigation->avoidance_time_sec);
  fprintf(file, "    \"avoidanceSteps\": %d,\n", navigation->avoidance_steps);
  if (navigation->has_target) {
    fprintf(file, "    \"target\": {\"x\": %.6f, \"y\": %.6f, \"headingDeg\": %.3f}\n",
            navigation->target.x, navigation->target.z,
            navigation->target.heading_rad * 180.0 / CONTROLLER_TELEMETRY_PI);
  } else {
    fprintf(file, "    \"target\": null\n");
  }
  fprintf(file, "  },\n");

  const ControllerTelemetryMotionProfile *motion = &snapshot->motion_profile;
  fprintf(file, "  \"motionProfile\": {\n");
  fprintf(file, "    \"cruiseSpeedMps\": %.6f,\n", motion->cruise_speed_mps);
  fprintf(file, "    \"payloadKg\": %.6f,\n", motion->payload_kg);
  fprintf(file, "    \"batteryRange\": %.6f,\n", motion->battery_range);
  fprintf(file, "    \"batterySpeedFactor\": %.6f,\n", motion->battery_speed_factor);
  fprintf(file, "    \"runtimeLinearLimitMps\": %.6f,\n", motion->runtime_linear_limit_mps);
  fprintf(file, "    \"runtimeAngularLimitRad\": %.6f\n  },\n", motion->runtime_angular_limit_rad);
  fprintf(file, "  \"dynamicZones\": {\n    \"count\": %d,\n    \"wallCount\": %d\n  },\n",
          snapshot->dynamic_zone_count, snapshot->dynamic_zone_wall_count);

  const ControllerTelemetryLidar *lidar = &snapshot->lidar;
  fprintf(file, "  \"perception\": {\n    \"lidar\": {\n");
  fprintf(file, "      \"enabled\": %s,\n", json_bool(lidar->enabled));
  fprintf(file, "      \"horizontalResolution\": %d,\n", lidar->horizontal_resolution);
  fprintf(file, "      \"maxRange\": %.3f,\n", lidar->max_range);
  fprintf(file, "      \"lastHitCount\": %d,\n", lidar->last_hit_count);
  fprintf(file, "      \"frontHitCount\": %d,\n", lidar->front_hit_count);
  fprintf(file, "      \"frontMinRange\": %.3f,\n", lidar->front_min_range);
  fprintf(file, "      \"centerMinRange\": %.3f,\n", lidar->center_min_range);
  fprintf(file, "      \"leftFrontCornerMinRange\": %.3f,\n", lidar->left_front_corner_min_range);
  fprintf(file, "      \"rightFrontCornerMinRange\": %.3f,\n", lidar->right_front_corner_min_range);
  fprintf(file, "      \"leftMinRange\": %.3f,\n", lidar->left_min_range);
  fprintf(file, "      \"rightMinRange\": %.3f\n    },\n", lidar->right_min_range);

  const ControllerTelemetryCamera *camera = &snapshot->camera;
  fprintf(file, "    \"camera\": {\n");
  fprintf(file, "      \"enabled\": %s,\n", json_bool(camera->enabled));
  fprintf(file, "      \"width\": %d,\n      \"height\": %d,\n", camera->width, camera->height);
  fprintf(file, "      \"fov\": %.6f,\n", camera->fov);
  fprintf(file, "      \"mode\": \"%s\",\n", safe_text(camera->mode));
  fprintf(file, "      \"frameFile\": \"%s\",\n", safe_text(camera->frame_file));
  fprintf(file, "      \"mimeType\": \"%s\",\n", safe_text(camera->mime_type));
  fprintf(file, "      \"frameSequence\": %d,\n", camera->frame_sequence);
  fprintf(file, "      \"capturedAt\": %.6f,\n", camera->captured_at);
  fprintf(file, "      \"obstacleVisible\": %s,\n", json_bool(camera->obstacle_visible));
  fprintf(file, "      \"obstacleScore\": %.6f,\n", camera->obstacle_score);
  fprintf(file, "      \"obstacleOffset\": %.6f,\n", camera->obstacle_offset);
  fprintf(file, "      \"obstacleAngle\": %.6f,\n", camera->obstacle_angle);
  fprintf(file, "      \"obstacleRange\": %.6f,\n", camera->obstacle_range);
  fprintf(file, "      \"detectionCount\": %d\n    },\n", camera->detection_count);
  fprintf(file, "    \"obstacleTrace\": [\n");
  for (int i = 0; i < snapshot->trace_point_count; ++i) {
    const ControllerTelemetryPoint *point = &snapshot->trace_points[i];
    fprintf(file, "      {\"x\": %.6f, \"y\": %.6f, \"confidence\": %.3f}%s\n",
            point->x, point->y, point->confidence,
            i + 1 < snapshot->trace_point_count ? "," : "");
  }
  fprintf(file, "    ]\n  },\n");
  fprintf(file, "  \"obstacleMap\": {\n    \"cellCount\": %d,\n    \"cellSize\": %.4f,\n    \"mapFile\": \"obstacle_map.json\",\n    \"jsonFile\": \"obstacle_map.json\",\n    \"excelCsvFile\": \"obstacle_map.csv\"\n  },\n",
          snapshot->obstacle_map_cell_count, snapshot->obstacle_map_cell_size);
  fprintf(file, "  \"cameraMap\": {\n    \"cellCount\": %d,\n    \"obstacleCellCount\": %d,\n    \"freeCellCount\": %d,\n    \"cellSize\": %.4f,\n    \"mapFile\": \"camera_map.json\",\n    \"jsonFile\": \"camera_map.json\",\n    \"excelCsvFile\": \"camera_map.csv\"\n  },\n",
          snapshot->camera_map_cell_count, snapshot->camera_map_obstacle_cell_count,
          snapshot->camera_map_free_cell_count, snapshot->camera_map_cell_size);
  const ControllerObjectTransferState *transfer = snapshot->object_transfer;
  fprintf(file, "  \"objectTransfer\": {\n");
  fprintf(file, "    \"missionId\": \"%s\",\n", safe_command_id(transfer ? transfer->mission_id : ""));
  fprintf(file, "    \"objectId\": \"%s\",\n", transfer ? transfer->object_id : "");
  fprintf(file, "    \"status\": \"%s\",\n", transfer_status(transfer ? transfer->status : CONTROLLER_TRANSFER_IDLE));
  fprintf(file, "    \"stage\": \"%s\",\n", transfer_stage(transfer ? transfer->stage : CONTROLLER_TRANSFER_STAGE_NONE));
  fprintf(file, "    \"progress\": %d,\n", transfer ? transfer->progress : 0);
  fprintf(file, "    \"attached\": %s,\n", json_bool(transfer && transfer->attached));
  fprintf(file, "    \"onPlatform\": %s,\n", json_bool(transfer && transfer->on_platform));
  fprintf(file, "    \"destination\": {\"x\": %.6f, \"y\": %.6f},\n",
      transfer ? transfer->destination_x : 0.0, transfer ? transfer->destination_y : 0.0);
  if (snapshot->object_position_available) {
    fprintf(file, "    \"position\": {\"x\": %.6f, \"y\": %.6f, \"z\": %.6f},\n",
        snapshot->object_x, snapshot->object_y, snapshot->object_z);
  } else {
    fprintf(file, "    \"position\": null,\n");
  }
  fprintf(file, "    \"errorCode\": \"%s\",\n", transfer ? transfer->error_code : "");
  fprintf(file, "    \"controllerBootId\": \"%s\",\n", transfer ? safe_command_id(transfer->controller_boot_id) : "");
  fprintf(file, "    \"recoveryEpoch\": %u,\n", transfer ? transfer->recovery_epoch : 0);
  fprintf(file, "    \"objectPose\": {\"x\": %.6f, \"y\": %.6f, \"z\": %.6f},\n",
      transfer ? transfer->object_pose[0] : 0, transfer ? transfer->object_pose[1] : 0, transfer ? transfer->object_pose[2] : 0);
  fprintf(file, "    \"objectUp\": {\"x\": %.6f, \"y\": %.6f, \"z\": %.6f},\n",
      transfer ? transfer->object_up[0] : 0, transfer ? transfer->object_up[1] : 0, transfer ? transfer->object_up[2] : 0);
  fprintf(file, "    \"manipulator\": {\"mode\": \"physical_contacts\", \"jointPositions\": [");
  for(int i=0;i<5;++i) fprintf(file,"%s%.6f",i ? "," : "",transfer ? transfer->joint_positions[i] : 0);
  fprintf(file, "], \"jointTargets\": [");
  for(int i=0;i<5;++i) fprintf(file,"%s%.6f",i ? "," : "",transfer ? transfer->joint_targets[i] : 0);
  fprintf(file, "], \"fingerPositions\": [%.6f,%.6f], \"motorEfforts\": [",
      transfer ? transfer->finger_positions[0] : 0, transfer ? transfer->finger_positions[1] : 0);
  for(int i=0;i<7;++i) fprintf(file,"%s%.6f",i ? "," : "",transfer ? transfer->motor_efforts[i] : 0);
  fprintf(file, "], \"fingerContacts\": [%.6f,%.6f], \"tcpPose\": {\"x\": %.6f,\"y\": %.6f,\"z\": %.6f}, \"sensorValidity\": %s, \"gripEvidence\": %s, \"releaseEvidence\": %s, \"attachmentEvidence\": %s}\n  },\n",
      transfer ? transfer->finger_contacts[0] : 0, transfer ? transfer->finger_contacts[1] : 0,
      transfer ? transfer->tcp_pose[0] : 0, transfer ? transfer->tcp_pose[1] : 0, transfer ? transfer->tcp_pose[2] : 0,
      json_bool(transfer && transfer->sensors_valid),json_bool(transfer && transfer->grip_evidence),
      json_bool(transfer && transfer->release_evidence),json_bool(transfer && transfer->attached && transfer->grip_evidence));
  const ControllerTelemetryManipulator *manipulator = &snapshot->manipulator;
  fprintf(file, "  \"manipulator\": {\n");
  fprintf(file, "    \"available\": %s,\n", json_bool(manipulator->available));
  fprintf(file, "    \"missionId\": \"%s\", \"objectDef\": \"%s\",\n",
      safe_command_id(manipulator->mission_id), safe_command_id(manipulator->object_def));
  fprintf(file, "    \"stage\": \"%s\", \"error\": \"%s\",\n",
      manipulator->stage ? manipulator->stage : "idle", safe_text(manipulator->error));
  fprintf(file, "    \"active\": %s, \"loadHeld\": %s, \"cancelPending\": %s,\n",
      json_bool(manipulator->active), json_bool(manipulator->load_held), json_bool(manipulator->cancel_pending));
  if(std::isfinite(manipulator->contacts[0]) && std::isfinite(manipulator->contacts[1]))
    fprintf(file, "    \"contacts\": [%.6f, %.6f],\n", manipulator->contacts[0], manipulator->contacts[1]);
  else fprintf(file, "    \"contacts\": null,\n");
  if(manipulator->object_valid)
    fprintf(file, "    \"objectPosition\": {\"x\": %.6f, \"y\": %.6f, \"z\": %.6f},\n",
        manipulator->object_position[0], manipulator->object_position[1], manipulator->object_position[2]);
  else fprintf(file, "    \"objectPosition\": null,\n");
  fprintf(file, "    \"pose\": \"%s\",\n", safe_text(manipulator->pose));
  fprintf(file, "    \"state\": \"%s\",\n", safe_text(manipulator->state));
  fprintf(file, "    \"joints\": [%.6f, %.6f, %.6f, %.6f, %.6f],\n",
      manipulator->joints[0], manipulator->joints[1], manipulator->joints[2],
      manipulator->joints[3], manipulator->joints[4]);
  fprintf(file, "    \"fingers\": [%.6f, %.6f],\n",
      manipulator->fingers[0], manipulator->fingers[1]);
  fprintf(file, "    \"targetJoints\": [%.6f, %.6f, %.6f, %.6f, %.6f],\n",
      manipulator->target_joints[0], manipulator->target_joints[1],
      manipulator->target_joints[2], manipulator->target_joints[3],
      manipulator->target_joints[4]);
  fprintf(file, "    \"targetFingerOpening\": %.6f\n  },\n",
      manipulator->target_finger_opening);
  fprintf(file, "  \"route\": {\n    \"source\": \"route.csv\",\n    \"waypoints\": [\n");
  for (int i = 0; i < snapshot->route_waypoint_count; ++i) {
    const Waypoint *waypoint = &snapshot->route_waypoints[i];
    fprintf(file, "      {\"x\": %.6f, \"y\": %.6f, \"headingDeg\": %.3f, \"hasHeading\": %s}%s\n",
            waypoint->x, waypoint->z,
            waypoint->heading_rad * 180.0 / CONTROLLER_TELEMETRY_PI,
            json_bool(waypoint->has_heading),
            i + 1 < snapshot->route_waypoint_count ? "," : "");
  }
  fprintf(file, "    ]\n  }\n}\n");
  if (fclose(file) != 0) return 0;
  return replace_file(temp_path, state_path) == 0;
}
