#include "controller_telemetry.h"

#include "controller_io.h"

#include <stdio.h>
#include <math.h>

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

int controller_telemetry_write_snapshot(
    const char *temp_path,
    const char *state_path,
    const ControllerTelemetrySnapshot *snapshot) {
  if (!temp_path || !state_path || !snapshot) return 0;
  FILE *file = fopen(temp_path, "w");
  if (!file) return 0;

  fprintf(file, "{\n");
  fprintf(file, "  \"coordinateContractVersion\": 1,\n");
  const ControllerWebotsManipulator *manipulator = snapshot->manipulator;
  if (manipulator) {
    fprintf(file, "  \"manipulator\": {\"stage\": \"%s\", \"error\": \"%s\", \"missionId\": \"%s\", \"objectDef\": \"%s\", \"active\": %s,\n",
        controller_webots_manipulator_stage(manipulator), safe_text(manipulator->state.error),
        safe_command_id(manipulator->mission_id), safe_command_id(manipulator->object_def),
        json_bool(controller_webots_manipulator_active(manipulator)));
    fprintf(file, "    \"objectPosition\": {\"x\": %.6f, \"y\": %.6f, \"z\": %.6f}, \"fingers\": [%.6f, %.6f], \"joints\": [",
        manipulator->object_world[0], manipulator->object_world[1], manipulator->object_world[2],
        isfinite(manipulator->sample.fingers[0]) ? manipulator->sample.fingers[0] : 0,
        isfinite(manipulator->sample.fingers[1]) ? manipulator->sample.fingers[1] : 0);
    for (int i = 0; i < 5; ++i) fprintf(file, "%s%.6f", i ? ", " : "", isfinite(manipulator->sample.joints[i]) ? manipulator->sample.joints[i] : 0);
    fprintf(file, "]},\n");
  }
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
