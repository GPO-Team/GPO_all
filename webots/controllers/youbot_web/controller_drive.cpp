#include "controller_drive.h"

#include "controller_math.h"

#include <cmath>

void controller_drive_step(
    const ControllerDriveConfig *config,
    double vx,
    double vy,
    double omega,
    const int enabled[4],
    double applied_wheel_speeds[4]) {
  if (!config || !enabled || !applied_wheel_speeds || config->wheel_radius <= 0.0) return;

  double target[4];
  target[0] = (vx + vy + config->wheel_coupling * omega) / config->wheel_radius;
  target[1] = (vx - vy - config->wheel_coupling * omega) / config->wheel_radius;
  target[2] = (vx - vy + config->wheel_coupling * omega) / config->wheel_radius;
  target[3] = (vx + vy - config->wheel_coupling * omega) / config->wheel_radius;

  for (int i = 0; i < 4; ++i) {
    if (!enabled[i]) continue;
    target[i] = clamp_value(
        target[i],
        -config->max_wheel_speed_rad_s,
        config->max_wheel_speed_rad_s);
    const double speed_diff = target[i] - applied_wheel_speeds[i];
    const int accelerating =
        fabs(target[i]) >= fabs(applied_wheel_speeds[i]) &&
        applied_wheel_speeds[i] * target[i] >= 0.0;
    const double max_delta =
        (accelerating ? config->acceleration_limit_rad_s2
                      : config->deceleration_limit_rad_s2) *
        config->time_step_seconds;
    applied_wheel_speeds[i] += clamp_value(speed_diff, -max_delta, max_delta);
  }
}
