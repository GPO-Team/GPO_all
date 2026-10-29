#include "controller_manipulator_kinematics.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace {
// Cyberbotics Youbot.proto R2025a, first arm. Offsets are expressed in
// the parent endpoint frame; arm2/3/4 rotate about negative Y.
constexpr double kPi = 3.14159265358979323846;
constexpr double kMin[] = {-2.9496, -1.13446, -2.63545, -1.78024, -2.92343};
constexpr double kMax[] = {2.9496, 1.5708, 2.54818, 1.78024, 2.92343};
constexpr double kUpper = .155, kForearm = .135, kTool = .081 + .120;
}

int controller_manipulator_joints_valid(const double q[5]) {
  if (!q) return 0;
  for (int i = 0; i < 5; ++i)
    if (!std::isfinite(q[i]) || q[i] < kMin[i] || q[i] > kMax[i]) return 0;
  return 1;
}

int controller_manipulator_normalize_measurement(const double q[5], double normalized[5]) {
  if (!q || !normalized) return 0;
  for (int i = 0; i < 5; ++i)
    if (!std::isfinite(q[i]) || q[i] < kMin[i] - .001 || q[i] > kMax[i] + .001) return 0;
  for (int i = 0; i < 5; ++i) normalized[i] = std::clamp(q[i], kMin[i], kMax[i]);
  return 1;
}

int controller_manipulator_forward(const double q[5], ControllerManipulatorTcp *tcp) {
  if (!tcp || !controller_manipulator_joints_valid(q)) return 0;
  const double pitch = q[1] + q[2] + q[3];
  const double radial = .033 - kUpper * std::sin(q[1])
      - kForearm * std::sin(q[1] + q[2]) - kTool * std::sin(pitch);
  *tcp = {.156 + radial * std::cos(q[0]), radial * std::sin(q[0]),
      .147 + kUpper * std::cos(q[1]) + kForearm * std::cos(q[1] + q[2])
          + kTool * std::cos(pitch), pitch, q[4]};
  return 1;
}

int controller_manipulator_inverse(const ControllerManipulatorTcp *tcp,
    const double seed[5], double solution[5]) {
  double normalized_seed[5];
  if (!tcp || !solution || !controller_manipulator_normalize_measurement(seed, normalized_seed)
      || !std::isfinite(tcp->x) || !std::isfinite(tcp->y)
      || !std::isfinite(tcp->z) || !std::isfinite(tcp->pitch)
      || !std::isfinite(tcp->roll) || std::fabs(tcp->pitch) > 100.0) return 0;
  const double distance = std::hypot(tcp->x - .156, tcp->y);
  const double azimuth = distance < 1e-12 ? normalized_seed[0] : std::atan2(tcp->y, tcp->x - .156);
  double best = std::numeric_limits<double>::infinity();
  for (int radial_sign : {1, -1}) {
    const double radial = radial_sign * distance - .033 + kTool * std::sin(tcp->pitch);
    const double height = tcp->z - .147 - kTool * std::cos(tcp->pitch);
    double cosine = (radial * radial + height * height - kUpper * kUpper - kForearm * kForearm)
        / (2.0 * kUpper * kForearm);
    if (cosine < -1.0 - 1e-10 || cosine > 1.0 + 1e-10) continue;
    cosine = std::clamp(cosine, -1.0, 1.0);
    for (int elbow_sign : {1, -1}) {
      const double elbow = elbow_sign * std::acos(cosine);
      const double shoulder = std::atan2(-radial, height)
          - std::atan2(kForearm * std::sin(elbow), kUpper + kForearm * std::cos(elbow));
      for (int yaw_turn = -1; yaw_turn <= 1; ++yaw_turn) {
        for (int shoulder_turn = -1; shoulder_turn <= 1; ++shoulder_turn) {
          for (int pitch_turn = -2; pitch_turn <= 2; ++pitch_turn) {
            const double q2 = shoulder + shoulder_turn * 2.0 * kPi;
            const double pitch = std::remainder(tcp->pitch, 2.0 * kPi) + pitch_turn * 2.0 * kPi;
            double q[5] = {azimuth + (radial_sign < 0 ? kPi : 0.0) + yaw_turn * 2.0 * kPi,
                q2, elbow, pitch - q2 - elbow, tcp->roll};
            if (!controller_manipulator_joints_valid(q)) continue;
            double cost = 0;
            for (int i = 0; i < 5; ++i) cost += (q[i] - normalized_seed[i]) * (q[i] - normalized_seed[i]);
            if (cost < best) {
              best = cost;
              std::copy(q, q + 5, solution);
            }
          }
        }
      }
    }
  }
  return std::isfinite(best);
}
