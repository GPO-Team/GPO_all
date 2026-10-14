#include "controller_object_transfer_runtime.h"

#include <assert.h>
#include <math.h>

namespace {
constexpr double kTolerance = 1e-9;

void expect_pose(
    ControllerObjectTransferStage stage,
    double expected_offset,
    double expected_height) {
  double offset = 0.0;
  double height = 0.0;
  controller_object_transfer_carry_pose(stage, &offset, &height);
  assert(fabs(offset - expected_offset) <= kTolerance);
  assert(fabs(height - expected_height) <= kTolerance);
}
}

int main() {
  expect_pose(CONTROLLER_TRANSFER_PLACING_ON_PLATFORM, -0.15, 0.225);
  expect_pose(CONTROLLER_TRANSFER_RELEASING_ON_PLATFORM, -0.15, 0.225);
  expect_pose(CONTROLLER_TRANSFER_PICKING_FROM_PLATFORM, -0.15, 0.225);
  expect_pose(CONTROLLER_TRANSFER_GRASPING_FROM_PLATFORM, -0.15, 0.225);
  expect_pose(CONTROLLER_TRANSFER_LIFTING_FROM_PLATFORM, -0.15, 0.34);
  expect_pose(CONTROLLER_TRANSFER_LIFTING, 0.35, 0.43);
  expect_pose(CONTROLLER_TRANSFER_TRANSPORTING, 0.35, 0.43);
  return 0;
}
