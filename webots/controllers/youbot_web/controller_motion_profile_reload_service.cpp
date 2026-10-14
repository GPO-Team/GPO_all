#include "controller_motion_profile_reload_service.h"

#include "controller_io.h"

#include <cmath>

void controller_motion_profile_reload_service_init(
    ControllerMotionProfileReloadService *service,
    ControllerWebotsMotionState *motion_state,
    const char *path) {
  if (!service) return;
  service->motion_state = motion_state;
  service->path = path;
  service->last_modified = -1;
}

ControllerMotionProfileReloadResult controller_motion_profile_reload_service_run(
    ControllerMotionProfileReloadService *service,
    int step_counter,
    int reload_interval) {
  if (!service || !service->motion_state || !service->path || reload_interval <= 0 ||
      (step_counter % reload_interval) != 0) {
    return CONTROLLER_MOTION_PROFILE_RELOAD_NOT_DUE;
  }

  const long long mtime = get_file_mtime(service->path);
  if (mtime < 0) return CONTROLLER_MOTION_PROFILE_RELOAD_MISSING;

  ControllerWebotsMotionState *motion_state = service->motion_state;
  const double previous_cruise_speed = motion_state->profile.cruise_speed_mps;
  const double previous_payload_kg = motion_state->profile.payload_kg;
  const double previous_battery_range = motion_state->profile.battery_range_units;
  const double previous_linear_limit = motion_state->limits.linear_speed_mps;
  const double previous_angular_limit = motion_state->limits.angular_speed_rad_s;
  if (!controller_webots_motion_state_load(motion_state, service->path)) {
    return CONTROLLER_MOTION_PROFILE_RELOAD_UNCHANGED;
  }

  const int changed =
      mtime != service->last_modified ||
      fabs(motion_state->profile.cruise_speed_mps - previous_cruise_speed) > 1e-6 ||
      fabs(motion_state->profile.payload_kg - previous_payload_kg) > 1e-6 ||
      fabs(motion_state->profile.battery_range_units - previous_battery_range) > 1e-6 ||
      fabs(motion_state->limits.linear_speed_mps - previous_linear_limit) > 1e-6 ||
      fabs(motion_state->limits.angular_speed_rad_s - previous_angular_limit) > 1e-6;
  service->last_modified = mtime;
  return changed ? CONTROLLER_MOTION_PROFILE_RELOAD_CHANGED
                 : CONTROLLER_MOTION_PROFILE_RELOAD_UNCHANGED;
}
