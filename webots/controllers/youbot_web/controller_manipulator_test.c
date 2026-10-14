#include "controller_manipulator.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static ControllerManipulatorSample sample_for(const ControllerManipulator *arm) {
  ControllerManipulatorSample sample = {.object_valid = 1};
  memcpy(sample.joints, arm->targets, sizeof(sample.joints));
  sample.fingers[0] = sample.fingers[1] = arm->finger_target;
  if (arm->stage <= MANIPULATOR_CLOSE) memcpy(sample.object, arm->source, sizeof(sample.object));
  else if (arm->stage >= MANIPULATOR_RELEASE) memcpy(sample.object, arm->destination, sizeof(sample.object));
  else controller_manipulator_forward(sample.joints, sample.object);
  return sample;
}

int main(void) {
  const double source[3] = {0.40, -0.10, -0.047};
  const double destination[3] = {0.40, 0.10, -0.047};
  double angles[5], actual[3];
  assert(controller_manipulator_inverse(source, angles));
  controller_manipulator_forward(angles, actual);
  for (int i = 0; i < 3; ++i) assert(fabs(actual[i] - source[i]) < 1e-8);
  const double impossible[3] = {4, 0, 0};
  assert(!controller_manipulator_inverse(impossible, angles));
  const double invalid[3] = {NAN, 0, 0};
  assert(!controller_manipulator_inverse(invalid, angles));

  ControllerManipulator arm = {0};
  assert(!controller_manipulator_start(&arm, impossible, destination));
  assert(strcmp(arm.error, "source_unreachable") == 0);
  assert(!controller_manipulator_start(&arm, source, impossible));
  assert(strcmp(arm.error, "target_unreachable") == 0);
  assert(controller_manipulator_start(&arm, source, destination));
  assert(!controller_manipulator_start(&arm, source, destination));
  for (int i = 0; i < 1000 && controller_manipulator_active(&arm); ++i) {
    ControllerManipulatorSample sample = sample_for(&arm);
    if (arm.stage == MANIPULATOR_CLOSE) sample.fingers[0] = sample.fingers[1] = 0.0045;
    controller_manipulator_step(&arm, &sample, 0.016);
  }
  assert(arm.stage == MANIPULATOR_COMPLETED);
  const double transport_pose[5] = {0, 1.57, -2.635, 1.78, 0};
  for(int i=0;i<5;++i)assert(fabs(arm.targets[i]-transport_pose[i])<1e-8);

  assert(controller_manipulator_start(&arm, source, destination));
  ControllerManipulatorSample sample = sample_for(&arm);
  sample.object_valid = 0;
  controller_manipulator_step(&arm, &sample, 0.016);
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "object_missing") == 0);

  assert(controller_manipulator_start(&arm, source, destination));
  sample = sample_for(&arm);
  sample.joints[0] += 0.1;
  controller_manipulator_step(&arm, &sample, 12.1);
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "stage_timeout") == 0);

  assert(controller_manipulator_start(&arm, source, destination));
  sample = sample_for(&arm);
  controller_manipulator_cancel(&arm, &sample);
  assert(arm.stage == MANIPULATOR_CANCELLED);
  assert(arm.finger_target == sample.fingers[0]);

  assert(controller_manipulator_start(&arm, source, destination));
  for (int i = 0; i < 1000 && controller_manipulator_active(&arm); ++i) {
    sample = sample_for(&arm);
    controller_manipulator_step(&arm, &sample, 0.016);
  }
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "empty_grasp") == 0);

  assert(controller_manipulator_start(&arm, source, destination));
  for (int i = 0; i < 1000 && arm.stage != MANIPULATOR_TRANSFER; ++i) {
    sample = sample_for(&arm);
    if (arm.stage == MANIPULATOR_CLOSE) sample.fingers[0] = sample.fingers[1] = 0.0045;
    controller_manipulator_step(&arm, &sample, 0.016);
  }
  assert(arm.stage == MANIPULATOR_TRANSFER);
  sample = sample_for(&arm);
  sample.object[2] -= 0.1;
  controller_manipulator_step(&arm, &sample, 0.016);
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "object_lost") == 0);
  puts("manipulator tests passed");
  return 0;
}
