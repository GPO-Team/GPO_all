#include "controller_navigation_route.h"

#include <cmath>

namespace {
constexpr double kCenterEnterRadiusM = 0.045;
constexpr double kCenterHoldExitRadiusM = 0.075;
constexpr int kCenterHoldTicks = 75;

int s_tracked_wp_index = -1;
double s_tracked_wp_x = 0.0;
double s_tracked_wp_z = 0.0;
double s_closest_dist = 1e9;
int s_holding_center = 0;
int s_center_hold_steps = 0;
int s_near_steps = 0;
int s_has_last_angle = 0;
double s_last_angle = 0.0;
double s_accumulated_orbit_rad = 0.0;

int s_avoidance_active = 0;
int s_obstacle_near_robot = 0;
int s_last_target_unreachable = 0;

void reset_orbit_tracker(int wp_index, double wp_x, double wp_z) {
  s_tracked_wp_index = wp_index;
  s_tracked_wp_x = wp_x;
  s_tracked_wp_z = wp_z;
  s_closest_dist = 1e9;
  s_holding_center = 0;
  s_center_hold_steps = 0;
  s_near_steps = 0;
  s_has_last_angle = 0;
  s_last_angle = 0.0;
  s_accumulated_orbit_rad = 0.0;
}

double wrap_angle(double angle) {
  return atan2(sin(angle), cos(angle));
}

int waypoint_reached(
    int wp_index,
    double x,
    double z,
    double heading,
    const Waypoint *waypoint,
    int is_final_waypoint,
    double position_tolerance,
    double heading_tolerance_rad) {
  if (s_tracked_wp_index != wp_index ||
      hypot(s_tracked_wp_x - waypoint->x, s_tracked_wp_z - waypoint->z) > 0.01) {
    reset_orbit_tracker(wp_index, waypoint->x, waypoint->z);
  }

  const double enter_tolerance =
      (position_tolerance > 0.0)
          ? fmax(position_tolerance, kCenterEnterRadiusM)
          : kCenterEnterRadiusM;
  const double dist = hypot(waypoint->x - x, waypoint->z - z);
  if (dist < s_closest_dist) {
    s_closest_dist = dist;
  }

  if (dist <= enter_tolerance ||
      (s_holding_center && dist <= kCenterHoldExitRadiusM)) {
    s_holding_center = 1;
    ++s_center_hold_steps;
    if (s_center_hold_steps < kCenterHoldTicks) {
      return 0;
    }
    if (!is_final_waypoint || !waypoint->has_heading) {
      s_holding_center = 0;
      return 1;
    }
    if (fabs(wrap_angle(waypoint->heading_rad - heading)) <= heading_tolerance_rad) {
      s_holding_center = 0;
      return 1;
    }
    if (s_center_hold_steps >= kCenterHoldTicks + 45) {
      s_holding_center = 0;
      return 1;
    }
    return 0;
  }

  s_holding_center = 0;
  s_center_hold_steps = 0;

  if (s_avoidance_active || s_obstacle_near_robot) {
    const double orbit_band = 0.36;
    if (dist <= orbit_band) {
      ++s_near_steps;
      const double angle_from_wp = atan2(z - waypoint->z, x - waypoint->x);
      if (s_has_last_angle) {
        s_accumulated_orbit_rad += fabs(wrap_angle(angle_from_wp - s_last_angle));
      }
      s_last_angle = angle_from_wp;
      s_has_last_angle = 1;

      if (s_accumulated_orbit_rad >= 3.2 || s_near_steps >= 120) {
        s_last_target_unreachable = 1;
        return 1;
      }
    } else if (dist > orbit_band + 0.25) {
      s_has_last_angle = 0;
    }
  } else {
    s_near_steps = 0;
    s_has_last_angle = 0;
    s_accumulated_orbit_rad = 0.0;
  }

  return 0;
}
}

void controller_navigation_route_set_avoidance_context(
    int avoidance_active, int obstacle_near) {
  s_avoidance_active = avoidance_active ? 1 : 0;
  s_obstacle_near_robot = obstacle_near ? 1 : 0;
}

int controller_navigation_route_last_target_unreachable(void) {
  return s_last_target_unreachable;
}

int controller_navigation_route_is_holding_center(void) {
  return s_holding_center;
}

ControllerNavigationRouteDecision controller_navigation_route_evaluate(
    const RouteData *route,
    int *current_waypoint_index,
    int *route_finished,
    double x,
    double z,
    double heading,
    double position_tolerance,
    double heading_tolerance_rad,
    ControllerNavigationRouteOutput *output, bool adaptive_arrival) {
  if (!route || !current_waypoint_index || !route_finished || !output ||
      route->count <= 0) {
    if (route_finished) *route_finished = 0;
    s_last_target_unreachable = 0;
    reset_orbit_tracker(-1, 0.0, 0.0);
    return CONTROLLER_NAVIGATION_ROUTE_WAITING;
  }
  if (*route_finished) {
    s_holding_center = 0;
    return CONTROLLER_NAVIGATION_ROUTE_FINISHED;
  }

  s_last_target_unreachable = 0;
  output->target = route->waypoints[*current_waypoint_index];
  output->is_final_waypoint = *current_waypoint_index + 1 >= route->count;
  if (!adaptive_arrival) {
    reset_orbit_tracker(-1, 0.0, 0.0);
  }
  const bool reached = adaptive_arrival
      ? waypoint_reached(*current_waypoint_index, x, z, heading, &output->target,
                         output->is_final_waypoint, position_tolerance, heading_tolerance_rad)
      : hypot(output->target.x - x, output->target.z - z) <= position_tolerance &&
            (!output->is_final_waypoint || !output->target.has_heading ||
             fabs(wrap_angle(output->target.heading_rad - heading)) <= heading_tolerance_rad);
  if (!reached) {
    return CONTROLLER_NAVIGATION_ROUTE_ACTIVE;
  }
  if (output->is_final_waypoint) {
    *route_finished = 1;
    reset_orbit_tracker(-1, 0.0, 0.0);
    return CONTROLLER_NAVIGATION_ROUTE_COMPLETED;
  }

  ++*current_waypoint_index;
  output->target = route->waypoints[*current_waypoint_index];
  output->is_final_waypoint = *current_waypoint_index + 1 >= route->count;
  reset_orbit_tracker(*current_waypoint_index, output->target.x, output->target.z);
  return CONTROLLER_NAVIGATION_ROUTE_ADVANCED;
}