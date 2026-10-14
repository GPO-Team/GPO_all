#include "controller_lidar_runtime.h"

#include "controller_app_config.h"
#include "controller_app_internal.h"
#include "controller_lidar_math.h"
#include "controller_lidar_scan.h"
#include "controller_mapping_runtime.h"
#include "controller_math.h"
#include "controller_webots_sensors.h"

#include <cmath>
#include <webots/robot.h>

void read_pose(double *x, double *y, double *heading);

void compute_lidar_obstacle_context(LidarObstacleContext *context,
                                           double target_beam_angle,
                                           double preferred_turn_sign) {
  if (!context) return;

  const double effective_max_range =
      perception_runtime.lidar.max_range > EPS
          ? fmin(perception_runtime.lidar.max_range, LIDAR_MAX_TRACE_RANGE)
          : LIDAR_MAX_TRACE_RANGE;
  controller_lidar_context_init(context, effective_max_range);

  if (!perception_runtime.lidar.available ||
      !controller_webots_sensors_has_lidar(&webots_sensors) ||
      perception_runtime.lidar.resolution <= 1 || perception_runtime.lidar.fov <= EPS) return;

  const float *ranges = controller_webots_sensors_lidar_ranges(&webots_sensors);
  if (!ranges) return;

  double robot_x = 0.0;
  double robot_y = 0.0;
  double heading = 0.0;
  read_pose(&robot_x, &robot_y, &heading);

  const double sensor_origin_x =
      robot_x + cos(heading) * LIDAR_LOCAL_X - sin(heading) * LIDAR_LOCAL_Y;
  const double sensor_origin_y =
      robot_y + sin(heading) * LIDAR_LOCAL_X + cos(heading) * LIDAR_LOCAL_Y;
  const double sigma = fmax(perception_runtime.lidar.fov * 0.22, 0.22);
  const ControllerLidarContextConfig context_config = {
      effective_max_range,
      LIDAR_TRACK_CAUTION_RANGE,
      LIDAR_AVOID_STOP_RANGE,
      LIDAR_GAP_MIN_RANGE,
      LIDAR_FRONT_SECTOR_RAD,
      LIDAR_CENTER_SECTOR_RAD,
      LIDAR_FRONT_CORNER_MIN_RAD,
      LIDAR_FRONT_CORNER_MAX_RAD,
      sigma,
  };

  for (int i = 0; i < perception_runtime.lidar.resolution; i += LIDAR_SAMPLE_STRIDE) {
    const double raw_range = (double)ranges[i];
    const int range_is_finite = controller_math_is_finite(raw_range);
    const double sensed_range = range_is_finite
                                    ? clamp_value(raw_range, 0.0, effective_max_range)
                                    : effective_max_range;
    const int obstacle_hit =
        range_is_finite &&
        raw_range >= LIDAR_MIN_TRACE_RANGE &&
        raw_range < effective_max_range - 0.02 &&
        controller_lidar_hit_is_consistent(
            ranges,
            perception_runtime.lidar.resolution,
            i,
            raw_range,
            effective_max_range,
            LIDAR_SAMPLE_STRIDE,
            LIDAR_MIN_TRACE_RANGE,
            LIDAR_RANGE_JUMP_TOLERANCE);

    const double alpha = perception_runtime.lidar.resolution > 1
                             ? (double)i / (double)(perception_runtime.lidar.resolution - 1)
                             : 0.5;
    const double beam_angle =
        -0.5 * perception_runtime.lidar.fov + alpha * perception_runtime.lidar.fov;
    int expected_zone_wall = 0;

    if (obstacle_hit) {
      const double world_angle = heading - beam_angle;
      const double hit_x = sensor_origin_x + cos(world_angle) * raw_range;
      const double hit_y = sensor_origin_y + sin(world_angle) * raw_range;

      for (int zone_index = 0; zone_index < controller_runtime.limit_zones.count; ++zone_index) {
        if (point_near_zone_boundary(hit_x,
                                     hit_y,
                                     &controller_runtime.limit_zones.zones[zone_index],
                                     ZONE_WALL_EXPECTED_TOLERANCE)) {
          expected_zone_wall = 1;
          break;
        }
      }
    }

    controller_lidar_context_observe(
        context,
        &context_config,
        sensed_range,
        beam_angle,
        obstacle_hit,
        expected_zone_wall,
        target_beam_angle,
        preferred_turn_sign);
  }
}

void capture_lidar_trace(void) {
  double robot_x = 0.0;
  double robot_y = 0.0;
  double heading = 0.0;
  read_pose(&robot_x, &robot_y, &heading);
  const ControllerLidarScanConfig scan_config = {
      LIDAR_SAMPLE_STRIDE,
      LIDAR_MIN_TRACE_RANGE,
      LIDAR_MAX_TRACE_RANGE,
      LIDAR_RANGE_JUMP_TOLERANCE,
      LIDAR_LOCAL_X,
      LIDAR_LOCAL_Y,
      LIDAR_FRONT_SECTOR_RAD,
      LIDAR_CENTER_SECTOR_RAD,
      LIDAR_FRONT_CORNER_MIN_RAD,
      LIDAR_FRONT_CORNER_MAX_RAD,
      LIDAR_NEAR_ROBOT_IGNORE_RADIUS,
      LIDAR_SNAP_STEP,
      LIDAR_TRACE_SPACING,
  };
  controller_perception_runtime_capture_lidar(
      &perception_runtime,
      &scan_config,
      controller_webots_sensors_lidar_ranges(&webots_sensors),
      robot_x,
      robot_y,
      heading,
      wb_robot_get_time(),
      LIDAR_TRACE_TTL_SECONDS);
}

void merge_trace_into_map(double now_time) {
  controller_mapping_runtime_merge_trace(
      &mapping_runtime,
      perception_runtime.trace,
      perception_runtime.trace_count,
      now_time,
      MAP_MERGE_MAX_AGE_S,
      MAP_MERGE_MIN_HIT_COUNT,
      EPS);
}
