#include "controller_control_config.h"

#include <cmath>

static int near(double actual, double expected) {
  return fabs(actual - expected) < 1e-9;
}

int main(void) {
  const ControllerControlConfig config = controller_control_config_default();

  if (config.time_step_ms != 16) return 1;
  if (!near(config.drive.wheel_radius, 0.05)) return 2;
  if (!near(config.drive.wheel_base_longitudinal, 0.228)) return 3;
  if (!near(config.drive.wheel_base_lateral, 0.158)) return 4;
  if (!near(config.drive.max_wheel_speed_rad_s, 18.0)) return 5;
  if (!near(config.drive.acceleration_limit_rad_s2, 150.0)) return 6;
  if (!near(config.drive.deceleration_limit_rad_s2, 220.0)) return 7;

  if (!near(config.navigation.runtime.position_tolerance, 0.05)) return 8;
  if (!near(config.navigation.runtime.heading_tolerance_rad, 0.08)) return 9;
  if (!near(config.navigation.runtime.zone_clearance, 0.32)) return 10;
  if (!near(config.navigation.tracking.turn_heading_gain, 3.8)) return 11;
  if (!near(config.navigation.tracking.track_heading_gain, 3.0)) return 12;
  if (!near(config.navigation.lidar.track_caution_range, 1.45)) return 13;
  if (config.navigation.lidar.priority_hold_steps != 18) return 14;

  if (!near(config.perception.navigation.camera_range_fallback, 1.55)) return 15;
  if (!near(config.perception.navigation.camera_min_score, 0.025)) return 16;
  if (config.perception.navigation.camera_min_detection_count != 3) return 17;
  if (!near(config.perception.navigation.avoidance.avoid_trigger_range, 1.18)) return 18;

  if (!near(config.mapping.grid_cell_m, 0.25)) return 19;
  if (!near(config.mapping.obstacle_scan_radius_m, 0.88)) return 20;
  if (config.mapping.obstacle_scan_points != 10) return 21;
  if (config.mapping.obstacle_scan_cooldown_steps != 260) return 22;

  if (config.schedule.lifecycle.zone_reload_interval != 10) return 23;
  if (config.schedule.lifecycle.route_reload_interval != 20) return 24;
  if (config.schedule.lifecycle.motion_reload_interval != 20) return 25;
  if (config.schedule.lifecycle.runtime_command_reload_interval != 6) return 26;
  if (config.schedule.lifecycle.map_write_interval != 60) return 27;
  if (config.schedule.lifecycle.camera_capture_interval != 4) return 28;
  if (config.schedule.lifecycle.camera_write_interval != 12) return 29;

  if (config.avoidance.start.initial_hold_steps != 18) return 30;
  if (config.avoidance.progress.min_contour_steps != 18) return 31;
  if (config.avoidance.lifecycle.max_steps != 360) return 32;
  if (config.avoidance.command.stuck_steps_limit != 24) return 33;
  return 0;
}
