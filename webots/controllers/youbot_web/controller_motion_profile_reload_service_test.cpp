#include "controller_motion_profile_reload_service.h"

#include <assert.h>
#include <stdio.h>

int main(void) {
  const char *path = "controller_motion_profile_reload_service_test.txt";
  ControllerWebotsMotionState motion_state = {
      {0.22, 0.0, 100.0},
      {0.22, 1.6, 1.0},
  };
  ControllerMotionProfileReloadService service;
  controller_motion_profile_reload_service_init(&service, &motion_state, path);

  assert(controller_motion_profile_reload_service_run(&service, 1, 20) ==
         CONTROLLER_MOTION_PROFILE_RELOAD_NOT_DUE);

  FILE *file = fopen(path, "w");
  assert(file);
  fputs("cruise_speed_mps 0.46\npayload_kg 10\nbattery_range 50\n", file);
  fclose(file);

  assert(controller_motion_profile_reload_service_run(&service, 20, 20) ==
         CONTROLLER_MOTION_PROFILE_RELOAD_CHANGED);
  assert(motion_state.profile.cruise_speed_mps == 0.46);
  assert(motion_state.profile.payload_kg == 10.0);
  assert(motion_state.profile.battery_range_units == 50.0);
  assert(controller_motion_profile_reload_service_run(&service, 40, 20) ==
         CONTROLLER_MOTION_PROFILE_RELOAD_UNCHANGED);

  remove(path);
  assert(controller_motion_profile_reload_service_run(&service, 60, 20) ==
         CONTROLLER_MOTION_PROFILE_RELOAD_MISSING);
  return 0;
}
