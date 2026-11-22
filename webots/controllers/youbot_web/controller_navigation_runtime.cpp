#include "controller_navigation_runtime.h"

#include "controller_app_config.h"
#include "controller_app_internal.h"
#include "controller_application_state.h"
#include "controller_avoidance_lifecycle.h"
#include "controller_avoidance_recovery.h"
#include "controller_avoidance_service.h"
#include "controller_avoidance_start.h"
#include "controller_input_runtime.h"
#include "controller_lidar_runtime.h"
#include "controller_mapping_obstacles.h"
#include "controller_mapping_runtime.h"
#include "controller_math.h"
#include "controller_navigation_adapter.h"
#include "controller_navigation_context.h"
#include "controller_navigation_metrics.h"
#include "controller_navigation_perception.h"
#include "controller_navigation_presentation.h"
#include "controller_navigation_route.h"
#include "controller_navigation_service.h"
#include "controller_navigation_state.h"
#include "controller_survey_runtime.h"
#include "controller_survey_state.h"
#include "controller_webots_adapter.h"
#include "controller_webots_devices.h"

#include <cmath>
#include <stdio.h>
#include <string.h>
#include <webots/robot.h>

namespace {
constexpr double kCloseApproachStopLidarRange = 0.13;
constexpr double kCloseApproachStopTargetDist = 0.12;
constexpr int kCloseApproachStallLimit = 28;
constexpr const char *kUnreachableTargetMessage =
    "Точка недостижима: целевая координата находится внутри объекта";
constexpr const char *kSkippedWaypointMessage =
    "Невозможно посетить точку: она находится внутри объекта";

int s_terminal_unreachable = 0;
char s_unreachable_mission_id[128] = "";
double s_unreachable_distance = 0.0;

int s_blocked_approach_stall_steps = 0;
double s_blocked_approach_prev_x = 0.0;
double s_blocked_approach_prev_z = 0.0;
int s_blocked_approach_has_prev = 0;

void clear_terminal_unreachable_state(void) {
  s_terminal_unreachable = 0;
  s_unreachable_mission_id[0] = '\0';
  s_unreachable_distance = 0.0;
  s_blocked_approach_stall_steps = 0;
  s_blocked_approach_has_prev = 0;
}

void set_terminal_unreachable_target(double distance_to_target) {
  controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
  controller_runtime.route_finished = 1;
  controller_runtime.avoidance.active = 0;
  controller_runtime.distance_to_target = distance_to_target;

  s_terminal_unreachable = 1;
  s_unreachable_distance = distance_to_target;
  snprintf(
      s_unreachable_mission_id,
      sizeof(s_unreachable_mission_id),
      "%s",
      controller_runtime.route.command_id);

  set_status("target_unreachable");
  set_error(kUnreachableTargetMessage);
  stop_robot();
}
}

static double s_prev_lidar_heading_bias = 0.0;
static int s_skip_notice_hold_steps = 0;
static int s_post_avoidance_smooth_steps = 0;

static void skip_blocked_waypoint_with_notice(double x, double z) {
  controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
  s_blocked_approach_stall_steps = 0;
  s_blocked_approach_has_prev = 0;
  ++controller_runtime.current_waypoint_index;
  begin_navigation_for_waypoint(controller_runtime.current_waypoint_index, x, z);
  set_status("skipped_blocked_waypoint");
  set_error(kSkippedWaypointMessage);
  s_skip_notice_hold_steps = 220;
  s_post_avoidance_smooth_steps = 24;
}

double scaled_linear_floor(double factor) {
  const double floor_cap = fmin(TRACK_MIN_LINEAR_SPEED, active_linear_speed_limit);
  return clamp_value(active_linear_speed_limit * factor, 0.01, floor_cap);
}

double scaled_linear_cap(double factor) {
  const double floor = scaled_linear_floor(0.24);
  return clamp_value(active_linear_speed_limit * factor, floor, active_linear_speed_limit);
}

void drive_webots_base(
    void *context,
    const ControllerDriveConfig *config,
    double vx,
    double vy,
    double omega) {
  controller_webots_devices_drive((ControllerWebotsDevices *)context, config, vx, vy, omega);
}

void set_base_velocity(double vx, double vy, double omega) {
  controller_webots_adapter_apply_velocity(&webots_adapter, vx, vy, omega);
}

void stop_robot(void) {
  controller_webots_adapter_stop(&webots_adapter);
}

void init_pose_tracking() {
  controller_webots_adapter_init_pose(&webots_pose);
}

void reset_robot_pose() {
  if (!controller_webots_adapter_reset_pose(
          &webots_pose, START_X, START_Z, START_HEIGHT, 0.0)) return;
  controller_webots_devices_reset_wheels(&webots_devices);
  controller_runtime.avoidance.hold_steps = 0;
  controller_runtime.avoidance.turn_sign = 1.0;
  s_prev_lidar_heading_bias = 0.0;
  s_skip_notice_hold_steps = 0;
  s_post_avoidance_smooth_steps = 0;
  clear_terminal_unreachable_state();
  controller_runtime.navigation_pose_history = ControllerNavigationPoseHistory{
      START_X,
      START_Z,
      0.0,
      1,
  };
  reset_navigation_mode();
  stop_robot();
}

void read_pose(double *x, double *z, double *heading) {
  controller_webots_adapter_read_pose(&webots_pose, x, z, heading);
}

void apply_kinematic_step(
    double x,
    double z,
    double heading,
    double linear_speed,
    double angular_speed) {
  (void)x;
  (void)z;
  (void)heading;

  const double limited_linear = clamp_value(
      linear_speed,
      -active_linear_speed_limit,
      active_linear_speed_limit);
  const double limited_angular = clamp_value(
      angular_speed,
      -active_angular_speed_limit,
      active_angular_speed_limit);
  set_base_velocity(limited_linear, 0.0, limited_angular);
}

double sign_or_one(double value) {
  return value < 0.0 ? -1.0 : 1.0;
}

void reset_navigation_mode(void) {
  s_prev_lidar_heading_bias = 0.0;
  s_skip_notice_hold_steps = 0;
  s_post_avoidance_smooth_steps = 0;
  s_blocked_approach_stall_steps = 0;
  s_blocked_approach_has_prev = 0;
  controller_mapping_runtime_clear(&mapping_runtime);
  perception_runtime.trace_count = 0;
  controller_navigation_state_reset(&controller_runtime, START_X, START_Z);
}

void begin_navigation_for_waypoint(int waypoint_index, double current_x, double current_z) {
  s_blocked_approach_stall_steps = 0;
  s_blocked_approach_has_prev = 0;
  controller_navigation_state_begin(&controller_runtime, waypoint_index, current_x, current_z);
}

void ensure_navigation_waypoint_initialized(double current_x, double current_z) {
  controller_navigation_state_ensure(&controller_runtime, current_x, current_z);
}

void clear_local_navigation_state(void) {
  s_prev_lidar_heading_bias = 0.0;
  controller_navigation_state_clear_local(&controller_runtime, START_X, START_Z);
}

void reset_route_avoidance_metrics(void) {
  controller_application_state_reset_route_avoidance(&application_state);
}

int route_off_route_active_now() {
  return controller_navigation_metrics_off_route(
      controller_runtime.route_finished,
      controller_runtime.route.count,
      controller_runtime.avoidance.active,
      navigation_status);
}

void update_route_avoidance_metrics(void) {
  if (route_off_route_active_now()) {
    controller_application_state_tick_route_avoidance(
        &application_state, 1, (double)TIME_STEP / 1000.0);
  }
}

void run_navigation_step(void) {
  if (s_terminal_unreachable &&
      (controller_runtime.route.count <= 0 ||
       strcmp(s_unreachable_mission_id, controller_runtime.route.command_id) != 0)) {
    clear_terminal_unreachable_state();
  }

  if (controller_runtime.cancelled_mission_id[0] &&
      strcmp(controller_runtime.cancelled_mission_id, controller_runtime.route.command_id) == 0) {
    clear_terminal_unreachable_state();
    controller_runtime.route_finished = 1;
    controller_runtime.mapping_survey.route_active = 0;
    controller_runtime.avoidance.active = 0;
    s_prev_lidar_heading_bias = 0.0;
    s_skip_notice_hold_steps = 0;
    s_post_avoidance_smooth_steps = 0;
    stop_robot();
    set_status("mission_cancelled");
    return;
  }
  if (controller_runtime.failed_mission_id[0] &&
      strcmp(controller_runtime.failed_mission_id, controller_runtime.route.command_id) == 0) {
    clear_terminal_unreachable_state();
    controller_runtime.route_finished = 1;
    controller_runtime.mapping_survey.route_active = 0;
    controller_runtime.avoidance.active = 0;
    s_prev_lidar_heading_bias = 0.0;
    s_skip_notice_hold_steps = 0;
    s_post_avoidance_smooth_steps = 0;
    stop_robot();
    set_status("route_failed");
    return;
  }
  if (s_terminal_unreachable &&
      strcmp(s_unreachable_mission_id, controller_runtime.route.command_id) == 0 &&
      controller_runtime.route.count > 0) {
    controller_runtime.route_finished = 1;
    controller_runtime.avoidance.active = 0;
    controller_runtime.distance_to_target = s_unreachable_distance;
    set_status("target_unreachable");
    set_error(kUnreachableTargetMessage);
    stop_robot();
    return;
  }

  double x = 0.0;
  double z = 0.0;
  double heading = 0.0;

  read_pose(&x, &z, &heading);

  const ControllerMappingObstacles live_obstacles = {
      .map = persistent_map,
      .map_count = persistent_map_count,
      .camera_map = mapping_camera_map,
      .camera_count = camera_map_count,
      .trace = perception_runtime.trace,
      .trace_count = perception_runtime.trace_count,
      .now_time = wb_robot_get_time(),
      .trace_ttl_seconds = LIDAR_TRACE_TTL_SECONDS,
      .min_trace_confidence = LIDAR_TRACE_MIN_CONFIDENCE,
  };
  const ControllerRuntimeSensorFrame sensor_frame = {x, z, heading, 0, &live_obstacles};
  const ControllerRuntimeNavigationResult navigation_result =
      controller_runtime_process_navigation_frame(
          &controller_runtime, &sensor_frame, &control_config.navigation.runtime);

  ControllerNavigationAdapterEffect terminal_effect;
  if (controller_navigation_adapter_terminal_effect(&navigation_result, &terminal_effect) &&
      !terminal_effect.relocalize && navigation_result.action != CONTROLLER_RUNTIME_ACTION_ROUTE_COMPLETED) {
    if (terminal_effect.clear_route_finished) controller_runtime.route_finished = 0;
    if (terminal_effect.clear_avoidance_hold) controller_runtime.avoidance.hold_steps = 0;
    if (terminal_effect.reset_navigation) reset_navigation_mode();
    controller_runtime.distance_to_target = terminal_effect.distance_to_target;
    set_status(terminal_effect.status);
    stop_robot();
    return;
  }

  controller_mapping_survey_state_tick(&controller_runtime.mapping_survey);

  if (terminal_effect.relocalize) {
    clear_local_navigation_state();
    controller_runtime.navigation_waypoint_index = controller_runtime.current_waypoint_index;
    controller_runtime.navigation_segment_start_x = terminal_effect.segment_start_x;
    controller_runtime.navigation_segment_start_z = terminal_effect.segment_start_z;
    controller_runtime.navigation_mode = NAV_MODE_TRACK;
    controller_runtime.distance_to_target = terminal_effect.distance_to_target;
    clear_error();
    set_status(terminal_effect.status);
    stop_robot();
    return;
  }

  ensure_navigation_waypoint_initialized(x, z);

  if (navigation_result.action == CONTROLLER_RUNTIME_ACTION_ROUTE_COMPLETED) {
    if (!controller_runtime.mapping_survey.route_active &&
        controller_navigation_route_last_target_unreachable()) {
      set_terminal_unreachable_target(terminal_effect.distance_to_target);
      return;
    }
    s_skip_notice_hold_steps = 0;
    s_post_avoidance_smooth_steps = 0;
    clear_error();
    reset_navigation_mode();
    controller_runtime.distance_to_target = terminal_effect.distance_to_target;
    set_status(terminal_effect.status);
    stop_robot();
    return;
  }
  if (navigation_result.navigation.route_decision == CONTROLLER_NAVIGATION_ROUTE_ADVANCED) {
    controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
    begin_navigation_for_waypoint(controller_runtime.current_waypoint_index, x, z);
    s_post_avoidance_smooth_steps = 18;
    if (!controller_runtime.mapping_survey.route_active &&
        controller_navigation_route_last_target_unreachable()) {
      set_status("skipped_blocked_waypoint");
      set_error(kSkippedWaypointMessage);
      s_skip_notice_hold_steps = 220;
    }
  }
  Waypoint target = navigation_result.target;
  int is_final_waypoint = navigation_result.navigation.route.route.is_final_waypoint;

  if (controller_mapping_survey_state_complete_scan(
          &controller_runtime.mapping_survey,
          controller_runtime.current_waypoint_index,
          MAPPING_SURVEY_OBSTACLE_SCAN_COOLDOWN_STEPS)) {
    clear_local_navigation_state();
    begin_navigation_for_waypoint(controller_runtime.current_waypoint_index, x, z);
    set_status("mapping_survey_resumed_route");
  }

  if (s_skip_notice_hold_steps > 0) {
    --s_skip_notice_hold_steps;
  }
  if (s_post_avoidance_smooth_steps > 0) {
    --s_post_avoidance_smooth_steps;
  }

  if (controller_navigation_route_is_holding_center()) {
    controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
    controller_runtime.avoidance.active = 0;
    s_prev_lidar_heading_bias = 0.0;
    controller_runtime.distance_to_target = hypot2(target.x - x, target.z - z);

    if (is_final_waypoint && target.has_heading) {
      const double heading_error = wrap_angle(target.heading_rad - heading);
      if (fabs(heading_error) > control_config.navigation.tracking.heading_tolerance_rad) {
        double omega = clamp_value(
            heading_error * control_config.navigation.tracking.final_align_gain,
            -active_angular_speed_limit,
            active_angular_speed_limit);
        if (fabs(omega) < control_config.navigation.tracking.min_angular_command) {
          omega = sign_or_one(heading_error) *
                  control_config.navigation.tracking.min_angular_command;
        }
        if (s_skip_notice_hold_steps == 0) clear_error();
        set_status("aligning_final_heading");
        apply_kinematic_step(x, z, heading, 0.0, omega);
        return;
      }
    }

    if (s_skip_notice_hold_steps == 0) clear_error();
    set_status("holding_waypoint_center");
    stop_robot();
    return;
  }

  if (navigation_result.action == CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_TARGET ||
      navigation_result.action == CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_SEGMENT) {
    if (!controller_runtime.mapping_survey.route_active &&
        navigation_result.action == CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_TARGET) {
      skip_blocked_waypoint_with_notice(x, z);
      return;
    }
    controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
    ++controller_runtime.current_waypoint_index;
    begin_navigation_for_waypoint(controller_runtime.current_waypoint_index, x, z);
    clear_error();
    set_status(
        navigation_result.action == CONTROLLER_RUNTIME_ACTION_SKIP_BLOCKED_TARGET
            ? "mapping_survey_skipped_blocked_waypoint"
            : "mapping_survey_skipped_blocked_segment");
    return;
  }
  if (navigation_result.action == CONTROLLER_RUNTIME_ACTION_BLOCKED_TARGET) {
    const double dist_to_target = hypot2(target.x - x, target.z - z);
    const double heading_to_target = wrap_angle(atan2(target.z - z, target.x - x) - heading);

    LidarObstacleContext blocked_lidar_context;
    compute_lidar_obstacle_context(
        &blocked_lidar_context, -heading_to_target, controller_runtime.avoidance.turn_sign);
    const double front_clear_range =
        perception_runtime.lidar.available
            ? fmin(
                  blocked_lidar_context.unexpected_front_min_range,
                  blocked_lidar_context.expected_front_min_range)
            : dist_to_target;

    if (s_blocked_approach_has_prev) {
      const double step_move = hypot2(
          x - s_blocked_approach_prev_x,
          z - s_blocked_approach_prev_z);
      if (step_move < 0.002 && fabs(heading_to_target) < 0.25) {
        ++s_blocked_approach_stall_steps;
      } else {
        s_blocked_approach_stall_steps = 0;
      }
    }
    s_blocked_approach_prev_x = x;
    s_blocked_approach_prev_z = z;
    s_blocked_approach_has_prev = 1;

    const int reached_close_object_boundary =
        front_clear_range <= kCloseApproachStopLidarRange ||
        dist_to_target <= kCloseApproachStopTargetDist ||
        s_blocked_approach_stall_steps >= kCloseApproachStallLimit;

    if (!reached_close_object_boundary) {
      controller_runtime.distance_to_target = dist_to_target;
      const double turn_cmd = clamp_value(
          heading_to_target * control_config.navigation.tracking.track_heading_gain,
          -active_angular_speed_limit,
          active_angular_speed_limit);
      double approach_speed = 0.0;
      if (fabs(heading_to_target) <= 0.45) {
        const double clear_dist = fmax(0.0, front_clear_range - kCloseApproachStopLidarRange);
        approach_speed = clamp_value(
            clear_dist * 0.65,
            0.06,
            fmin(active_linear_speed_limit, 0.16));
      }
      set_status("approaching_blocked_target");
      apply_kinematic_step(x, z, heading, approach_speed, turn_cmd);
      return;
    }

    s_skip_notice_hold_steps = 0;
    if (!controller_runtime.mapping_survey.route_active && !is_final_waypoint) {
      skip_blocked_waypoint_with_notice(x, z);
      return;
    }
    set_terminal_unreachable_target(dist_to_target);
    return;
  }
  if (navigation_result.action == CONTROLLER_RUNTIME_ACTION_BLOCKED_SEGMENT) {
    set_status("blocked_by_dynamic_zone");
    set_error("Dynamic zone blocks the current segment");
    controller_runtime.distance_to_target = hypot2(target.x - x, target.z - z);
    stop_robot();
    return;
  }

  ControllerNavigationTargetContext target_context;
  controller_navigation_context_target(
      &target,
      controller_runtime.current_waypoint_index,
      controller_runtime.route.count,
      x,
      z,
      heading,
      &target_context);
  const double target_distance_now = target_context.distance;
  const double heading_error_to_target = target_context.heading_error;

  LidarObstacleContext lidar_context;
  compute_lidar_obstacle_context(
      &lidar_context, -heading_error_to_target, controller_runtime.avoidance.turn_sign);
  const int avoidance_was_active = controller_runtime.avoidance.active;
  const ControllerNavigationPerceptionInput perception_input = {
      .lidar_context = &lidar_context,
      .lidar_available = perception_runtime.lidar.available,
      .camera_visible = perception_runtime.camera.obstacle_visible,
      .camera_angle = perception_runtime.camera.obstacle_angle,
      .camera_fov = perception_runtime.camera.fov,
      .camera_range = perception_runtime.camera.obstacle_range,
      .camera_score = perception_runtime.camera.obstacle_score,
      .camera_detection_count = perception_runtime.camera.detection_count,
      .camera_center_offset = perception_runtime.camera.obstacle_center_offset,
  };
  ControllerNavigationPerceptionOutput perception_output;
  controller_navigation_perception_prepare(
      &perception_input, &control_config.perception.navigation, &perception_output);
  const int camera_visual_front_obstacle =
      perception_output.camera_visual_front_obstacle;
  const double camera_preferred_turn_sign =
      perception_output.camera_preferred_turn_sign;
  const ControllerAvoidanceDetection avoidance_detection =
      perception_output.avoidance;
  const double center_obstacle_range = avoidance_detection.center_obstacle_range;
  const double expected_front_range = avoidance_detection.expected_front_range;
  const double near_front_range = avoidance_detection.near_front_range;
  const double left_lidar_context = avoidance_detection.left_lidar_context;
  const double right_lidar_context = avoidance_detection.right_lidar_context;
  const int expected_zone_wall_ahead = avoidance_detection.expected_zone_wall_ahead;
  const int expected_zone_wall_close = avoidance_detection.expected_zone_wall_close;
  const int expected_zone_wall_slowdown = avoidance_detection.expected_zone_wall_slowdown;
  const int center_passage_available = avoidance_detection.center_passage_available;
  const int obstacle_context_present = avoidance_detection.obstacle_context_present;
  const int should_start_avoidance = avoidance_detection.should_start_avoidance;

  const int suppress_avoidance_near_center =
      (target_distance_now <= 0.22 && near_front_range > 0.16) ? 1 : 0;

  if (!suppress_avoidance_near_center &&
      should_start_avoidance &&
      insert_mapping_survey_obstacle_scan_route(
          x,
          z,
          heading,
          &target,
          &lidar_context,
          fabs(controller_runtime.lidar_priority_turn_sign) > 0.0
              ? controller_runtime.lidar_priority_turn_sign
              : sign_or_one(heading_error_to_target))) {
    stop_robot();
    return;
  }

  if (!suppress_avoidance_near_center) {
    const ControllerAvoidanceStartInput avoidance_start_input = {
        .lidar_context = &lidar_context,
        .detection = &avoidance_detection,
        .x = x,
        .z = z,
        .heading = heading,
        .target_distance = target_distance_now,
        .priority_turn_sign = controller_runtime.lidar_priority_turn_sign,
        .camera_turn_sign = camera_preferred_turn_sign,
        .heading_error = heading_error_to_target,
    };
    ControllerAvoidanceStartOutput avoidance_start_output;
    if (controller_avoidance_start(
            &controller_runtime.avoidance,
            &avoidance_start_input,
            &control_config.avoidance.start,
            &avoidance_start_output)) {
      controller_runtime.lidar_priority_turn_sign = avoidance_start_output.priority_turn_sign;
      controller_runtime.lidar_priority_hold_steps = avoidance_start_output.priority_hold_steps;
    }
  } else if (controller_runtime.avoidance.active) {
    controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
    controller_runtime.avoidance.active = 0;
  }

  if (controller_runtime.avoidance.active) {
    const double saved_turn_sign = controller_runtime.avoidance.turn_sign;
    const double detour_dx = controller_runtime.avoidance.detour_x - x;
    const double detour_dz = controller_runtime.avoidance.detour_z - z;
    const double detour_distance =
        controller_runtime.avoidance.detour_active ? hypot2(detour_dx, detour_dz) : 0.0;
    const double detour_heading_error =
        controller_runtime.avoidance.detour_active
            ? wrap_angle(atan2(detour_dz, detour_dx) - heading)
            : 0.0;
    const ControllerAvoidanceProgressInput progress_input = {
        .x = x,
        .z = z,
        .heading = heading,
        .target_distance = target_distance_now,
        .obstacle_context_present = obstacle_context_present,
        .detour_distance = detour_distance,
    };
    const ControllerAvoidanceLifecycleInput lifecycle_input = {
        .mapping_survey = controller_runtime.mapping_survey.route_active,
        .replan_cooldown_steps = controller_runtime.mapping_survey.replan_cooldown_steps,
        .x = x,
        .z = z,
        .target_distance = target_distance_now,
        .heading_error = heading_error_to_target,
        .near_front_range = near_front_range,
        .center_obstacle_range = center_obstacle_range,
    };
    const ControllerAvoidanceCommandInput command_input = {
        .context = &lidar_context,
        .detection = &avoidance_detection,
        .detour_heading_error = detour_heading_error,
        .heading_error_to_target = heading_error_to_target,
        .runtime_linear_speed_limit = active_linear_speed_limit,
        .runtime_angular_speed_limit = active_angular_speed_limit,
        .pass_min_speed = scaled_linear_floor(0.35),
        .pass_max_speed = scaled_linear_cap(LIDAR_PASS_MAX_SPEED_FACTOR),
        .avoid_min_speed = scaled_linear_floor(0.30),
        .avoid_max_speed = scaled_linear_cap(LIDAR_AVOID_DRIVE_MAX_SPEED_FACTOR),
        .reverse_speed = scaled_linear_cap(0.16),
    };
    const ControllerAvoidanceServiceInput avoidance_service_input = {
        .progress_config = &control_config.avoidance.progress,
        .progress_input = progress_input,
        .lifecycle_config = &control_config.avoidance.lifecycle,
        .lifecycle_input = lifecycle_input,
        .has_next_waypoint = controller_runtime.current_waypoint_index + 1 < controller_runtime.route.count,
        .command_config = &control_config.avoidance.command,
        .command_input = command_input,
        .priority_hold_steps = LIDAR_PRIORITY_HOLD_STEPS,
        .avoidance_hold_steps = LIDAR_AVOID_HOLD_STEPS,
        .has_best_gap = lidar_context.has_best_gap,
    };
    ControllerAvoidanceServiceOutput avoidance_service_output;
    controller_avoidance_service_process_active(
        &controller_runtime.avoidance, &avoidance_service_input, &avoidance_service_output);
    const ControllerAvoidanceRecoveryOutput recovery_output =
        avoidance_service_output.recovery;

    if (recovery_output.rejoin_route) {
      clear_local_navigation_state();
      controller_runtime.lidar_priority_turn_sign = saved_turn_sign;
      controller_runtime.lidar_priority_hold_steps = 24;
      s_post_avoidance_smooth_steps = 28;
      controller_runtime.navigation_waypoint_index = controller_runtime.current_waypoint_index;
      controller_runtime.navigation_segment_start_x = x;
      controller_runtime.navigation_segment_start_z = z;
      controller_runtime.navigation_mode = NAV_MODE_TRACK;
      controller_runtime.distance_to_target = target_distance_now;
      if (s_skip_notice_hold_steps == 0) {
        clear_error();
      }
      set_status(
          controller_runtime.mapping_survey.route_active
              ? "mapping_survey_rejoined_route"
              : "rejoined_route");
    }

    if (recovery_output.attempt_orbit_escape) {
      if (!controller_runtime.mapping_survey.route_active) {
        if (!is_final_waypoint) {
          skip_blocked_waypoint_with_notice(x, z);
        } else {
          s_skip_notice_hold_steps = 0;
          set_terminal_unreachable_target(target_distance_now);
        }
        return;
      }

      const ControllerAvoidanceRecoveryAfterOrbit after_orbit =
          controller_avoidance_recovery_after_orbit(
              escape_mapping_survey_orbit(x, z),
              controller_runtime.current_waypoint_index + 1 < controller_runtime.route.count);
      if (after_orbit == CONTROLLER_AVOIDANCE_RECOVERY_STOP_AFTER_ESCAPE) {
        controller_runtime.distance_to_target = 0.0;
        stop_robot();
        return;
      }

      if (after_orbit == CONTROLLER_AVOIDANCE_RECOVERY_SKIP_LOOPED_WAYPOINT) {
        ++controller_runtime.current_waypoint_index;
        clear_local_navigation_state();
        controller_runtime.avoidance.active = 0;
        controller_runtime.avoidance.hold_steps = 0;
        begin_navigation_for_waypoint(controller_runtime.current_waypoint_index, x, z);
        controller_runtime.mapping_survey.replan_cooldown_steps = MAPPING_SURVEY_REPLAN_COOLDOWN_STEPS;
        controller_runtime.distance_to_target = hypot2(
            controller_runtime.route.waypoints[controller_runtime.current_waypoint_index].x - x,
            controller_runtime.route.waypoints[controller_runtime.current_waypoint_index].z - z);
        clear_error();
        set_status("mapping_survey_skipped_looped_obstacle");
        stop_robot();
        return;
      }
    }

    if (recovery_output.reacquire_free_space) {
      clear_local_navigation_state();
      controller_runtime.lidar_priority_turn_sign = saved_turn_sign;
      controller_runtime.lidar_priority_hold_steps = 24;
      s_post_avoidance_smooth_steps = 28;
      controller_runtime.navigation_waypoint_index = controller_runtime.current_waypoint_index;
      controller_runtime.navigation_segment_start_x = x;
      controller_runtime.navigation_segment_start_z = z;
      controller_runtime.navigation_mode = NAV_MODE_TRACK;
      controller_runtime.distance_to_target = target_distance_now;
      if (s_skip_notice_hold_steps == 0) {
        clear_error();
      }
      set_status("reacquired_free_space");
    }

    if (controller_runtime.avoidance.active && avoidance_service_output.has_command) {
      if (avoidance_service_output.presentation.priority_updated) {
        controller_runtime.lidar_priority_turn_sign = avoidance_service_output.presentation.priority_turn_sign;
        controller_runtime.lidar_priority_hold_steps = avoidance_service_output.presentation.priority_hold_steps;
      }
      set_status(avoidance_service_output.presentation.status);

      controller_runtime.distance_to_target = target_distance_now;
      if (s_skip_notice_hold_steps == 0) {
        clear_error();
      }
      set_base_velocity(
          avoidance_service_output.command.linear_speed,
          0.0,
          avoidance_service_output.command.angular_speed);
      return;
    }
  }

  controller_avoidance_lifecycle_finish(&controller_runtime.avoidance, START_X, START_Z);
  if (avoidance_was_active) {
    controller_runtime.navigation_segment_start_x = x;
    controller_runtime.navigation_segment_start_z = z;
    controller_runtime.navigation_mode = NAV_MODE_TRACK;
    if (s_post_avoidance_smooth_steps < 28) {
      s_post_avoidance_smooth_steps = 28;
    }
  }
  controller_runtime.distance_to_target = target_distance_now;
  controller_runtime.navigation_segment_start_x = x;
  controller_runtime.navigation_segment_start_z = z;

  const double smooth_blend =
      (s_post_avoidance_smooth_steps > 0)
          ? clamp_value(1.0 - (double)s_post_avoidance_smooth_steps / 32.0, 0.25, 1.0)
          : 1.0;
  const double effective_heading_error = heading_error_to_target * smooth_blend;
  const double effective_angular_limit =
      (s_post_avoidance_smooth_steps > 0)
          ? fmin(active_angular_speed_limit, 0.48)
          : active_angular_speed_limit;

  const int route_relaxed_mode_base = 1;
  ControllerNavigationTrackingInput tracking_input = {
      .mode = controller_runtime.navigation_mode,
      .is_final_waypoint = is_final_waypoint,
      .target_has_heading = target.has_heading,
      .target_heading = target.heading_rad,
      .current_heading = heading,
      .distance_to_target = controller_runtime.distance_to_target,
      .heading_error_to_target = effective_heading_error,
      .updated_heading_error = effective_heading_error,
      .route_relaxed_mode = route_relaxed_mode_base,
      .avoidance_active = controller_runtime.avoidance.active,
      .lidar_speed_scale = 1.0,
      .expected_wall_speed_scale = 1.0,
      .expected_zone_wall_slowdown = expected_zone_wall_slowdown,
      .expected_zone_wall_ahead = expected_zone_wall_ahead,
      .runtime_linear_speed_limit = active_linear_speed_limit,
      .runtime_angular_speed_limit = effective_angular_limit,
  };
  const ControllerNavigationLidarInput navigation_lidar_input = {
      .lidar_available = perception_runtime.lidar.available,
      .center_passage_available = center_passage_available,
      .center_obstacle_range = center_obstacle_range,
      .near_front_range = near_front_range,
      .left_lidar_context = left_lidar_context,
      .right_lidar_context = right_lidar_context,
      .best_gap_beam_angle = lidar_context.best_gap_beam_angle,
      .heading_error = effective_heading_error,
      .camera_visual_front_obstacle = camera_visual_front_obstacle,
      .camera_obstacle_center_offset = perception_runtime.camera.obstacle_center_offset,
      .expected_zone_wall_close = expected_zone_wall_close,
      .expected_zone_wall_slowdown = expected_zone_wall_slowdown,
      .expected_front_range = expected_front_range,
      .current_priority_turn_sign = controller_runtime.lidar_priority_turn_sign,
      .current_priority_hold_steps = controller_runtime.lidar_priority_hold_steps,
      .prev_heading_bias = s_prev_lidar_heading_bias,
  };
  const ControllerNavigationMotionServiceInput motion_input = {
      .tracking = tracking_input,
      .lidar = navigation_lidar_input,
  };
  ControllerNavigationServiceMotionOutput motion_output;
  const int final_alignment = controller_navigation_service_calculate_motion(
      &control_config.navigation.tracking,
      &control_config.navigation.lidar,
      &motion_input,
      &motion_output);
  controller_runtime.navigation_mode = motion_output.motion.tracking.mode;

  if (target_distance_now > 0.042 &&
      target_distance_now <= 0.22 &&
      near_front_range > 0.16 &&
      fabs(heading_error_to_target) < 0.42) {
    const double min_creep = fmin(active_linear_speed_limit, 0.065);
    double linear_cmd = fmax(motion_output.motion.tracking.linear_speed, min_creep);
    double angular_cmd = clamp_value(
        heading_error_to_target * control_config.navigation.tracking.track_heading_gain,
        -effective_angular_limit,
        effective_angular_limit);
    s_prev_lidar_heading_bias = 0.0;
    if (s_skip_notice_hold_steps == 0) {
      clear_error();
    }
    set_status("approaching_waypoint_center");
    apply_kinematic_step(x, z, heading, linear_cmd, angular_cmd);
    return;
  }

  if (final_alignment) {
    s_prev_lidar_heading_bias = 0.0;
    if (s_skip_notice_hold_steps == 0) {
      clear_error();
    }
    set_status("aligning_final_heading");
    apply_kinematic_step(
        x,
        z,
        heading,
        motion_output.motion.tracking.linear_speed,
        motion_output.motion.tracking.angular_speed);
    return;
  }
  s_prev_lidar_heading_bias = motion_output.motion.lidar.heading_bias;
  controller_runtime.lidar_priority_turn_sign = motion_output.motion.lidar.priority_turn_sign;
  controller_runtime.lidar_priority_hold_steps = motion_output.motion.lidar.priority_hold_steps;
  if (s_skip_notice_hold_steps == 0) {
    clear_error();
  }
  set_status(controller_navigation_presentation_tracking_status(
      motion_output.motion.tracking.status));
  apply_kinematic_step(
      x,
      z,
      heading,
      motion_output.motion.tracking.linear_speed,
      motion_output.motion.tracking.angular_speed);
}