#include "controller_motion_profile.h"

#include <cmath>
#include <stdio.h>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const char *profile_path = "controller_motion_profile_test.tmp";
  FILE *file = fopen(profile_path, "w");
  if (!file) return 1;
  fprintf(file, "cruise_speed_mps 0.35\n");
  fprintf(file, "payload_kg 125.0\n");
  fprintf(file, "unknown_key 999.0\n");
  fclose(file);

  ControllerMotionProfile profile = {0.22, 0.0, 75.0};
  if (!controller_motion_profile_load_file(profile_path, &profile)) return 2;
  remove(profile_path);

  if (!nearly_equal(profile.cruise_speed_mps, 0.35)) return 3;
  if (!nearly_equal(profile.payload_kg, 125.0)) return 4;
  if (!nearly_equal(profile.battery_range_units, 75.0)) return 5;

  ControllerMotionLimits limits = {0};
  controller_motion_profile_apply(&profile, &limits);
  if (!nearly_equal(limits.linear_speed_mps, 0.35)) return 6;
  if (!nearly_equal(limits.battery_speed_factor, 0.75)) return 7;
  if (limits.angular_speed_rad_s < 0.75 || limits.angular_speed_rad_s > 1.6) return 8;

  ControllerMotionProfile invalid = {5.0, -4.0, 0.0};
  controller_motion_profile_apply(&invalid, &limits);
  if (!nearly_equal(invalid.cruise_speed_mps, 0.8)) return 9;
  if (!nearly_equal(invalid.payload_kg, 0.0)) return 10;
  if (!nearly_equal(invalid.battery_range_units, 1.0)) return 11;
  if (!nearly_equal(limits.linear_speed_mps, 0.8)) return 12;
  if (!nearly_equal(limits.battery_speed_factor, 0.6)) return 13;

  return 0;
}
