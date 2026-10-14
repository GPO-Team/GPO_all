#include "controller_math.h"

#include <cmath>

#define TEST_PI 3.14159265358979323846
#define TEST_EPS 1e-9

static int nearly_equal(double left, double right) {
  return fabs(left - right) <= TEST_EPS;
}

int main(void) {
  if (!nearly_equal(clamp_value(3.0, 0.0, 2.0), 2.0)) return 1;
  if (!nearly_equal(hypot2(3.0, 4.0), 5.0)) return 2;
  if (!nearly_equal(dot2(1.0, 2.0, 3.0, 4.0), 11.0)) return 3;
  if (!nearly_equal(wrap_angle(TEST_PI * 3.0), TEST_PI)) return 4;
  if (!nearly_equal(blend_angle(0.0, TEST_PI / 2.0, 0.5), TEST_PI / 4.0)) return 5;
  return 0;
}
