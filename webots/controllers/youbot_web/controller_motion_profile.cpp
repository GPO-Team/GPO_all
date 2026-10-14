#include "controller_motion_profile.h"

#include "controller_math.h"

#include <stdio.h>
#include <string.h>

#define PROFILE_MIN_CRUISE_SPEED_MPS 0.05
#define PROFILE_MAX_CRUISE_SPEED_MPS 0.8
#define PROFILE_MAX_PAYLOAD_KG 500.0
#define PROFILE_DEFAULT_BATTERY_RANGE_UNITS 100.0
#define PROFILE_MIN_BATTERY_RANGE_UNITS 1.0
#define PROFILE_MAX_BATTERY_RANGE_UNITS 100000.0
#define PROFILE_MIN_LINEAR_SPEED_MPS 0.045
#define PROFILE_MAX_LINEAR_SPEED_MPS 0.80
#define PROFILE_MAX_ANGULAR_SPEED_RAD_S 1.6

int controller_motion_profile_load_file(
    const char *path,
    ControllerMotionProfile *profile) {
  if (!path || !profile) return 0;

  FILE *file = fopen(path, "r");
  if (!file) return 0;

  char key[64];
  double value = 0.0;
  while (fscanf(file, "%63s %lf", key, &value) == 2) {
    if (strcmp(key, "cruise_speed_mps") == 0) {
      profile->cruise_speed_mps = value;
    } else if (strcmp(key, "payload_kg") == 0) {
      profile->payload_kg = value;
    } else if (strcmp(key, "battery_range") == 0) {
      profile->battery_range_units = value;
    }
  }

  fclose(file);
  return 1;
}

void controller_motion_profile_apply(
    ControllerMotionProfile *profile,
    ControllerMotionLimits *limits) {
  if (!profile || !limits) return;

  profile->cruise_speed_mps = clamp_value(
      profile->cruise_speed_mps,
      PROFILE_MIN_CRUISE_SPEED_MPS,
      PROFILE_MAX_CRUISE_SPEED_MPS);
  profile->payload_kg = clamp_value(
      profile->payload_kg,
      0.0,
      PROFILE_MAX_PAYLOAD_KG);
  profile->battery_range_units = clamp_value(
      profile->battery_range_units,
      PROFILE_MIN_BATTERY_RANGE_UNITS,
      PROFILE_MAX_BATTERY_RANGE_UNITS);

  const double payload_factor =
      clamp_value(1.0 - profile->payload_kg * 0.0011, 0.55, 1.0);
  const double battery_ratio =
      profile->battery_range_units / PROFILE_DEFAULT_BATTERY_RANGE_UNITS;

  limits->battery_speed_factor = clamp_value(battery_ratio, 0.6, 1.0);
  limits->linear_speed_mps = clamp_value(
      profile->cruise_speed_mps,
      PROFILE_MIN_LINEAR_SPEED_MPS,
      PROFILE_MAX_LINEAR_SPEED_MPS);
  limits->angular_speed_rad_s = clamp_value(
      PROFILE_MAX_ANGULAR_SPEED_RAD_S * (0.88 + 0.12 * payload_factor),
      0.75,
      PROFILE_MAX_ANGULAR_SPEED_RAD_S);
}
