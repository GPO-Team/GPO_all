#include "controller_telemetry_publisher.h"

int main(void) {
  ControllerRuntime runtime;
  ControllerPerceptionRuntime perception;
  controller_runtime_init(&runtime);
  controller_perception_runtime_init(&perception);
  const ControllerTelemetryPublisherInput input = {
      .simulation_time = 2.0,
      .runtime = &runtime,
      .perception = &perception,
      .status = "idle",
      .error = "",
      .obstacle_map_cell_size = 0.05,
      .camera_map_cell_size = 0.08,
      .trace_ttl_seconds = 6.0,
  };
  ControllerTelemetryPublisherOutput output = {0};
  controller_telemetry_publisher_build(&input, &output);
  if (output.snapshot.simulation_time != 2.0) return 1;
  if (output.snapshot.navigation.current_waypoint_index != 0) return 2;
  return 0;
}
