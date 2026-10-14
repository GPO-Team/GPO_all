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
  free(json);
  if (fopen(temp_path, "rb") != NULL) return 11;
  return 0;
}
