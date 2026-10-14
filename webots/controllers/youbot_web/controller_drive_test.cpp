#include "controller_drive.h"

#include <cmath>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const ControllerDriveConfig config = {0.05, 0.386, 18.0, 150.0, 220.0, 0.016};
  const int enabled[4] = {1, 1, 1, 1};
  double speeds[4] = {0};

  controller_drive_step(&config, 0.22, 0.0, 0.0, enabled, speeds);
  for (int i = 0; i < 4; ++i) {
    if (!nearly_equal(speeds[i], 2.4)) return 1;
  }

  double turning[4] = {0};
  controller_drive_step(&config, 0.0, 0.0, 1.0, enabled, turning);
  if (!nearly_equal(turning[0], 2.4) || !nearly_equal(turning[1], -2.4)) return 2;
  if (!nearly_equal(turning[2], 2.4) || !nearly_equal(turning[3], -2.4)) return 3;

  double braking[4] = {5.0, 5.0, 5.0, 5.0};
  controller_drive_step(&config, 0.0, 0.0, 0.0, enabled, braking);
  for (int i = 0; i < 4; ++i) {
    if (!nearly_equal(braking[i], 1.48)) return 4;
  }

  const int partially_enabled[4] = {1, 0, 1, 1};
  double partial[4] = {0.0, 7.0, 0.0, 0.0};
  controller_drive_step(&config, 0.22, 0.0, 0.0, partially_enabled, partial);
  if (!nearly_equal(partial[1], 7.0)) return 5;
  return 0;
}
