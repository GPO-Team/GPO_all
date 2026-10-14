#include "controller_camera_map.h"

#include <cmath>
#include <stddef.h>

#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  MapCell obstacles[2] = {0};
  int obstacle_count = 0;
  if (!controller_camera_map_append_obstacle(
          obstacles, &obstacle_count, 2, NULL, NULL,
          0.10, TEST_EPS, 0.14, 0.26, 0)) {
    return 1;
  }
  if (obstacle_count != 1 || !nearly_equal(obstacles[0].x, 0.10) ||
      !nearly_equal(obstacles[0].y, 0.30) || obstacles[0].confidence != 1) {
    return 2;
  }
  if (!controller_camera_map_append_obstacle(
          obstacles, &obstacle_count, 2, NULL, NULL,
          0.10, TEST_EPS, 0.11, 0.29, 300)) {
    return 3;
  }
  if (obstacle_count != 1 || obstacles[0].confidence != 255) return 4;
  if (!controller_camera_map_append_obstacle(
          obstacles, &obstacle_count, 2, NULL, NULL,
          0.10, TEST_EPS, 0.40, 0.40, 2)) {
    return 5;
  }
  if (controller_camera_map_append_obstacle(
          obstacles, &obstacle_count, 2, NULL, NULL,
          0.10, TEST_EPS, 0.80, 0.80, 2)) {
    return 6;
  }

  MapCell free_cells[2] = {0};
  int free_count = 0;
  if (controller_camera_map_append_free(
          obstacles, obstacle_count, free_cells, &free_count, 2,
          0.10, TEST_EPS, 0.12, 0.28, 3)) {
    return 7;
  }
  if (free_count != 0) return 8;
  if (!controller_camera_map_append_free(
          obstacles, obstacle_count, free_cells, &free_count, 2,
          0.10, TEST_EPS, -0.24, 0.26, 2)) {
    return 9;
  }
  if (free_count != 1 || !nearly_equal(free_cells[0].x, -0.20) ||
      !nearly_equal(free_cells[0].y, 0.30) || free_cells[0].confidence != 2) {
    return 10;
  }
  if (!controller_camera_map_append_free(
          obstacles, obstacle_count, free_cells, &free_count, 2,
          0.10, TEST_EPS, -0.19, 0.31, 4)) {
    return 11;
  }
  if (free_count != 1 || free_cells[0].confidence != 6) return 12;

  MapCell reverse_order_obstacles[2] = {0};
  MapCell reverse_order_free[2] = {0};
  int reverse_order_obstacle_count = 0;
  int reverse_order_free_count = 0;
  if (!controller_camera_map_append_free(
          reverse_order_obstacles, reverse_order_obstacle_count,
          reverse_order_free, &reverse_order_free_count, 2,
          0.10, TEST_EPS, 0.52, -0.18, 2)) {
    return 13;
  }
  if (!controller_camera_map_append_obstacle(
          reverse_order_obstacles, &reverse_order_obstacle_count, 2,
          reverse_order_free, &reverse_order_free_count,
          0.10, TEST_EPS, 0.51, -0.21, 3)) {
    return 14;
  }
  if (reverse_order_obstacle_count != 1 || reverse_order_free_count != 0) {
    return 15;
  }

  return 0;
}
