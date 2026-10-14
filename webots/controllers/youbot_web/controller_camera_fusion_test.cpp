#include "controller_camera_fusion.h"

#include <cmath>

#define TEST_EPS 1e-6

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  const float ranges[] = {4.5f, 3.0f, 1.4f, 0.8f, 1.1f, 4.5f, 4.5f};
  const double closest = controller_camera_fusion_estimate_range(
      ranges, 7, 1.2, 0.0, 0.25, 0.12, 4.5, 2.0);
  if (!nearly_equal(closest, 0.8)) return 1;
  double confirmed = 0.0;
  if (!controller_camera_fusion_confirmed_range(
          ranges, 7, 1.2, 0.0, 0.25, 0.12, 4.5, &confirmed) ||
      !nearly_equal(confirmed, 0.8)) return 4;

  const float invalid_ranges[] = {NAN, INFINITY, 0.08f, 4.49f, 4.5f};
  const double fallback = controller_camera_fusion_estimate_range(
      invalid_ranges, 5, 1.0, 0.0, 0.2, 0.12, 4.5, 2.0);
  if (!nearly_equal(fallback, 2.0)) return 2;

  const double unavailable = controller_camera_fusion_estimate_range(
      NULL, 0, 1.0, 0.0, 0.2, 0.12, 4.5, 2.0);
  if (!nearly_equal(unavailable, 2.0)) return 3;
  if (controller_camera_fusion_confirmed_range(
          invalid_ranges, 5, 1.0, 0.0, 0.2, 0.12, 4.5, &confirmed)) return 5;

  return 0;
}
