#include "controller_webots_adapter.h"

#include <assert.h>

typedef struct {
  int calls;
  double vx;
  double vy;
  double omega;
} DriveProbe;

static void record_drive(
    void *context,
    const ControllerDriveConfig *config,
    double vx,
    double vy,
    double omega) {
  DriveProbe *probe = (DriveProbe *)context;
  assert(config->wheel_radius == 0.05);
  probe->calls += 1;
  probe->vx = vx;
  probe->vy = vy;
  probe->omega = omega;
}

int main(void) {
  const ControllerDriveConfig config = controller_webots_adapter_drive_config(
      0.05, 0.228, 0.158, 18.0, 150.0, 220.0, 0.016);

  assert(config.wheel_radius == 0.05);
  assert(config.wheel_coupling == 0.386);
  assert(config.max_wheel_speed_rad_s == 18.0);
  assert(config.acceleration_limit_rad_s2 == 150.0);
  assert(config.deceleration_limit_rad_s2 == 220.0);
  assert(config.time_step_seconds == 0.016);

  DriveProbe probe = {0};
  ControllerWebotsAdapter adapter;
  controller_webots_adapter_init(&adapter, &config, record_drive, &probe);
  controller_webots_adapter_apply_velocity(&adapter, 0.2, -0.1, 0.3);
  assert(probe.calls == 1);
  assert(probe.vx == 0.2 && probe.vy == -0.1 && probe.omega == 0.3);
  controller_webots_adapter_stop(&adapter);
  assert(probe.calls == 2);
  assert(probe.vx == 0.0 && probe.vy == 0.0 && probe.omega == 0.0);
  return 0;
}
