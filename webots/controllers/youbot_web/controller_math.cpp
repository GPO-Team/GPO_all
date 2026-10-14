#include "controller_math.h"

#include <cmath>

#define CONTROLLER_PI 3.14159265358979323846
#define CONTROLLER_EPS 1e-9

double clamp_value(double value, double min_value, double max_value) {
  if (value < min_value) return min_value;
  if (value > max_value) return max_value;
  return value;
}

double hypot2(double x, double y) {
  return sqrt(x * x + y * y);
}

double dot2(double ax, double ay, double bx, double by) {
  return ax * bx + ay * by;
}

double wrap_angle(double angle) {
  while (angle > CONTROLLER_PI) angle -= 2.0 * CONTROLLER_PI;
  while (angle < -CONTROLLER_PI) angle += 2.0 * CONTROLLER_PI;
  return angle;
}

double blend_angle(double from_angle, double to_angle, double weight_to) {
  const double weight = clamp_value(weight_to, 0.0, 1.0);
  const double x = (1.0 - weight) * cos(from_angle) + weight * cos(to_angle);
  const double y = (1.0 - weight) * sin(from_angle) + weight * sin(to_angle);
  if (fabs(x) <= CONTROLLER_EPS && fabs(y) <= CONTROLLER_EPS) return to_angle;
  return atan2(y, x);
}

int controller_math_is_finite(double value) {
  return std::isfinite(value);
}
