#include "controller_mapping_scan.h"

#include "controller_math.h"

#include <cmath>

#define CONTROLLER_MAPPING_SCAN_PI 3.14159265358979323846
#define CONTROLLER_MAPPING_SCAN_EPS 1e-9

static void add_point(
    const ControllerMappingScanConfig *config,
    ControllerMappingScanPointAllowed point_allowed,
    void *context,
    SurveyPoint *points,
    int max_points,
    int *count,
    double x,
    double y) {
  if (*count >= max_points || (point_allowed && !point_allowed(context, x, y))) return;
  if (*count > 0 && hypot(points[*count - 1].x - x, points[*count - 1].y - y) <
                        config->min_point_spacing) {
    points[*count - 1] = SurveyPoint{x, y};
    return;
  }
  points[(*count)++] = SurveyPoint{x, y};
}

int controller_mapping_scan_build(
    const ControllerMappingScanConfig *config,
    const ControllerMappingScanInput *input,
    ControllerMappingScanPointAllowed point_allowed,
    void *point_allowed_context,
    SurveyPoint *points,
    int max_points,
    int *point_count,
    double *obstacle_x,
    double *obstacle_y) {
  if (!config || !input || !points || !point_count || !obstacle_x || !obstacle_y ||
      max_points <= 0 || config->circle_point_count <= 0) return 0;

  const double sensor_origin_x = input->robot_x + cos(input->heading) * config->sensor_local_x -
                                 sin(input->heading) * config->sensor_local_y;
  const double sensor_origin_y = input->robot_y + sin(input->heading) * config->sensor_local_x +
                                 cos(input->heading) * config->sensor_local_y;
  const double range = clamp_value(input->obstacle_range, config->min_range, config->max_range);
  const double obstacle_angle = input->heading - input->obstacle_beam_angle;
  *obstacle_x = sensor_origin_x + cos(obstacle_angle) * range;
  *obstacle_y = sensor_origin_y + sin(obstacle_angle) * range;
  if (hypot(*obstacle_x - input->last_scan_x, *obstacle_y - input->last_scan_y) <
      config->min_repeat_distance) return 0;

  *point_count = 0;
  double start_angle = atan2(input->robot_y - *obstacle_y, input->robot_x - *obstacle_x);
  if (!std::isfinite(start_angle) ||
      hypot(input->robot_x - *obstacle_x, input->robot_y - *obstacle_y) < 0.12) {
    start_angle = wrap_angle(input->heading + CONTROLLER_MAPPING_SCAN_PI);
  }
  const double scan_turn = input->turn_sign >= 0.0 ? 1.0 : -1.0;
  add_point(
      config, point_allowed, point_allowed_context, points, max_points, point_count,
      *obstacle_x + cos(start_angle) * config->radius,
      *obstacle_y + sin(start_angle) * config->radius);
  for (int step = 1; step <= config->circle_point_count; ++step) {
    const double angle = start_angle + scan_turn * 2.0 * CONTROLLER_MAPPING_SCAN_PI *
                                           (double)step / (double)config->circle_point_count;
    add_point(
        config, point_allowed, point_allowed_context, points, max_points, point_count,
        *obstacle_x + cos(angle) * config->radius,
        *obstacle_y + sin(angle) * config->radius);
  }

  const double segment_dx = input->target_x - input->segment_start_x;
  const double segment_dy = input->target_y - input->segment_start_y;
  const double segment_length = hypot(segment_dx, segment_dy);
  if (segment_length > CONTROLLER_MAPPING_SCAN_EPS) {
    const double ux = segment_dx / segment_length;
    const double uy = segment_dy / segment_length;
    const double obstacle_along = (*obstacle_x - input->segment_start_x) * ux +
                                  (*obstacle_y - input->segment_start_y) * uy;
    const double resume_along = clamp_value(
        obstacle_along + config->radius * 1.35, 0.0, segment_length);
    add_point(
        config, point_allowed, point_allowed_context, points, max_points, point_count,
        input->segment_start_x + ux * resume_along,
        input->segment_start_y + uy * resume_along);
  }
  return *point_count >= 5;
}

int controller_mapping_scan_insert_route(
    RouteData *route, int waypoint_index, const SurveyPoint *points, int point_count) {
  if (!route || !points || waypoint_index < 0 || waypoint_index > route->count ||
      point_count <= 0 || route->count + point_count > MAX_WAYPOINTS) return 0;
  for (int i = route->count - 1; i >= waypoint_index; --i) {
    route->waypoints[i + point_count] = route->waypoints[i];
  }
  for (int i = 0; i < point_count; ++i) {
    route->waypoints[waypoint_index + i] = Waypoint{points[i].x, points[i].y, 0.0, 0};
  }
  route->count += point_count;
  return 1;
}
