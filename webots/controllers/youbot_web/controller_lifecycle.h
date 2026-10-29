#ifndef YOUBOT_WEB_CONTROLLER_LIFECYCLE_H
#define YOUBOT_WEB_CONTROLLER_LIFECYCLE_H

typedef struct {
  int zone_reload_interval;
  int route_reload_interval;
  int motion_reload_interval;
  int runtime_command_reload_interval;
  int map_write_interval;
  int camera_capture_interval;
  int camera_write_interval;
  int state_write_interval;
} ControllerLifecycleScheduleConfig;

typedef struct {
  int reload_zones;
  int reload_route;
  int reload_motion;
  int reload_runtime_command;
  int write_maps;
  int capture_camera;
  int write_camera_frame;
  int write_state;
} ControllerLifecycleTasks;

ControllerLifecycleTasks controller_lifecycle_tasks_for_step(
    int step, const ControllerLifecycleScheduleConfig *config);

#endif
