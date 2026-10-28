#include "controller_telemetry.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
  const char *temp_path = "controller_telemetry_test.tmp";
  const char *state_path = "controller_telemetry_test.json";
  Waypoint route[] = {{1.0, 2.0, 1.5707963267948966, 1}};
  ControllerTelemetryPoint trace[] = {{3.0, 4.0, 0.75}};
  ControllerTelemetrySnapshot snapshot = {0};
  snapshot.simulation_time = 12.5;
  snapshot.pose_x = 0.5;
  snapshot.pose_y = -0.25;
  snapshot.pose_z = 0.102838;
  snapshot.pose_yaw = 0.3;
  snapshot.navigation.status = "tracking_path";
  snapshot.navigation.error = "";
  snapshot.navigation.command_id = "mission-42";
  snapshot.navigation.current_waypoint_index = 0;
  snapshot.navigation.has_target = 1;
  snapshot.navigation.target = route[0];
  snapshot.lidar.enabled = 1;
  snapshot.camera.mode = "webots_camera";
  snapshot.camera.frame_file = "camera_frame.bmp";
  snapshot.camera.mime_type = "image/bmp";
  snapshot.trace_points = trace;
  snapshot.trace_point_count = 1;
  snapshot.route_waypoints = route;
  snapshot.route_waypoint_count = 1;
  snapshot.manipulator.available = 1;
  snapshot.manipulator.pose = "lift";
  snapshot.manipulator.state = "reached";
  snapshot.manipulator.joints[0] = 0.25;
  snapshot.manipulator.fingers[0] = 0.001;
  snapshot.manipulator.mission_id = "pick-42";
  snapshot.manipulator.object_def = "PICK_BOX";
  snapshot.manipulator.stage = "holding_for_recovery";
  snapshot.manipulator.error = "unsafe_release";
  snapshot.manipulator.active = snapshot.manipulator.load_held = 1;
  snapshot.manipulator.cancel_pending = 1;
  snapshot.manipulator.object_valid = 1;
  snapshot.manipulator.object_position[2] = 0.12;
  snapshot.object_position_available = 1;
  snapshot.object_x = 4.25;
  snapshot.object_y = -1.5;
  snapshot.object_z = 0.075;
  ControllerObjectTransferState transfer = {};
  transfer.stage = CONTROLLER_TRANSFER_TRANSPORTING;
  transfer.on_platform = 1;
    transfer.finger_contacts[0] = 1;
  snapshot.object_transfer = &transfer;

  if (!controller_telemetry_write_snapshot(temp_path, state_path, &snapshot)) return 1;
  FILE *file = fopen(state_path, "rb");
  if (!file) return 2;
  if (fseek(file, 0, SEEK_END) != 0) return 3;
  const long size = ftell(file);
  if (size <= 0 || fseek(file, 0, SEEK_SET) != 0) return 4;
  char *json = (char *)malloc((size_t)size + 1);
  if (!json) return 5;
  if (fread(json, 1, (size_t)size, file) != (size_t)size) return 6;
  json[size] = '\0';
  fclose(file);
  remove(state_path);

  if (!strstr(json, "\"coordinateContractVersion\": 1")) return 7;
  if (!strstr(json, "\"status\": \"tracking_path\"")) return 8;
  if (!strstr(json, "\"confidence\": 0.750")) return 9;
  if (!strstr(json, "\"headingDeg\": 90.000")) return 10;
  if (!strstr(json, "\"missionId\": \"mission-42\"")) return 12;
  if (!strstr(json, "\"manipulator\"")) return 13;
  if (!strstr(json, "\"pose\": \"lift\"")) return 14;
  if (!strstr(json, "\"joints\": [0.250000")) return 15;
  if (!strstr(json, "\"position\": {\"x\": 4.250000")) return 16;
  if (!strstr(json, "\"stage\": \"transporting\"")) return 17;
  if (!strstr(json, "\"onPlatform\": true")) return 18;
    if (!strstr(json, "\"fingerContacts\": [1.000000,0.000000]")) return 25;
  if (!strstr(json, "\"missionId\": \"pick-42\"")) return 19;
  if (!strstr(json, "\"stage\": \"holding_for_recovery\"")) return 20;
  if (!strstr(json, "\"error\": \"unsafe_release\"")) return 21;
  if (!strstr(json, "\"loadHeld\": true")) return 22;
  if (!strstr(json, "\"cancelPending\": true")) return 23;
  if (!strstr(json, "\"objectPosition\": {\"x\": 0.000000, \"y\": 0.000000, \"z\": 0.120000}")) return 24;
  free(json);
  if (fopen(temp_path, "rb") != NULL) return 11;
  return 0;
}
