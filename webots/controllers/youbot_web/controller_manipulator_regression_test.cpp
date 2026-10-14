#include "controller_manipulator.h"
#include <assert.h>
#include <cmath>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static ControllerManipulator prepare(ControllerManipulatorStage stage, int pose) {
  ControllerManipulator arm = {};
  const double source[3] = {0.4, -0.1, -0.047};
  const double destination[3] = {0.4, 0.1, -0.047};
  assert(controller_manipulator_start(&arm, source, destination));
  arm.stage = stage;
  memcpy(arm.targets, arm.poses[pose], sizeof(arm.targets));
  arm.finger_target = stage < MANIPULATOR_RELEASE ? 0 : 0.025;
  return arm;
}

static ControllerManipulatorSample sample_at(const ControllerManipulator *arm, int pose) {
  ControllerManipulatorSample sample = {.fingers = {0.0045, 0.0045}, .object_valid = 1};
  memcpy(sample.joints, arm->poses[pose], sizeof(sample.joints));
  controller_manipulator_forward(sample.joints, sample.object);
  return sample;
}

static void invalid_joint_stops_at_measured_pose(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_TRANSFER, 3);
  ControllerManipulatorSample sample = sample_at(&arm, 1);
  sample.joints[2] = NAN;
  controller_manipulator_step(&arm, &sample, 0.016);
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "invalid_sensor") == 0);
  assert(arm.halt_motion);
  assert(arm.targets[0] == sample.joints[0]);
  for (int i = 0; i < 5; ++i) assert(isfinite(arm.targets[i]));
}

static void cancellation_with_invalid_sensors_keeps_finite_targets(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_LIFT, 1);
  ControllerManipulatorSample sample = sample_at(&arm, 0);
  sample.joints[2] = sample.fingers[0] = sample.fingers[1] = NAN;
  controller_manipulator_cancel(&arm, &sample);
  assert(arm.stage == MANIPULATOR_CANCELLED);
  for (int i = 0; i < 5; ++i) assert(isfinite(arm.targets[i]));
  assert(isfinite(arm.finger_target));
  assert(arm.halt_motion);
}

static void asymmetric_contact_is_not_an_empty_grasp(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_CLOSE, 0);
  ControllerManipulatorSample sample = sample_at(&arm, 0);
  sample.fingers[0] = 0;
  sample.fingers[1] = 0.01;
  for (int i = 0; i < 100 && arm.stage == MANIPULATOR_CLOSE; ++i) {
    controller_manipulator_step(&arm, &sample, 0.016);
  }
  assert(arm.stage == MANIPULATOR_LIFT);
}

static void misplaced_load_is_not_released(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_LOWER, 2);
  ControllerManipulatorSample sample = sample_at(&arm, 2);
  sample.object[0] += 0.035;
  for (int i = 0; i < 20; ++i) controller_manipulator_step(&arm, &sample, 0.016);
  assert(arm.stage == MANIPULATOR_LOWER);
  assert(arm.finger_target == 0);
}

static void displaced_object_during_retraction_is_not_success(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_RETRACT, 3);
  ControllerManipulatorSample sample = sample_at(&arm, 3);
  sample.fingers[0] = sample.fingers[1] = 0.025;
  memcpy(sample.object, arm.destination, sizeof(sample.object));
  sample.object[1] += 0.1;
  controller_manipulator_step(&arm, &sample, 0.2);
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "placement_failed") == 0);
}

static void source_movement_invalidates_the_approach(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_APPROACH, 1);
  ControllerManipulatorSample sample = sample_at(&arm, 1);
  memcpy(sample.object, arm.source, sizeof(sample.object));
  sample.object[0] += 0.06;
  controller_manipulator_step(&arm, &sample, 0.016);
  assert(arm.stage == MANIPULATOR_FAILED);
  assert(strcmp(arm.error, "object_moved") == 0);
}

static void cancellation_preserves_each_finger_position(void) {
  ControllerManipulator arm = prepare(MANIPULATOR_LIFT, 1);
  ControllerManipulatorSample sample = sample_at(&arm, 1);
  sample.fingers[0] = 0.024;
  sample.fingers[1] = 0.004;
  controller_manipulator_cancel(&arm, &sample);
  assert(controller_manipulator_finger_target(&arm, 0) == sample.fingers[0]);
  assert(controller_manipulator_finger_target(&arm, 1) == sample.fingers[1]);
}
static void stowing_keeps_motion_ownership_until_sensor_confirmation(void) {
  ControllerManipulator arm=prepare(MANIPULATOR_RETRACT,3);
  ControllerManipulatorSample sample=sample_at(&arm,3);
  memcpy(sample.object,arm.destination,sizeof(sample.object));
  sample.fingers[0]=sample.fingers[1]=0.025;
  controller_manipulator_step(&arm,&sample,0.2);
  assert(arm.stage==MANIPULATOR_STOW && controller_manipulator_active(&arm));
  controller_manipulator_step(&arm,&sample,0.2);
  assert(arm.stage==MANIPULATOR_STOW);
  memcpy(sample.joints,arm.targets,sizeof(sample.joints));
  controller_manipulator_step(&arm,&sample,0.2);
  assert(arm.stage==MANIPULATOR_COMPLETED && !controller_manipulator_active(&arm));
}

static void grasp_requires_two_measured_contacts(void) {
  ControllerManipulator arm=prepare(MANIPULATOR_CLOSE,0);
  ControllerManipulatorSample sample=sample_at(&arm,0);
  arm.elapsed=1.1;
  memcpy(arm.previous_fingers,sample.fingers,sizeof(sample.fingers));
  sample.contacts_required=1;
  sample.contacts[0]=1;sample.contacts[1]=0;
  controller_manipulator_step(&arm,&sample,0.2);
  assert(arm.stage==MANIPULATOR_CLOSE);
  sample.contacts[1]=1;
  controller_manipulator_step(&arm,&sample,0.2);
  assert(arm.stage==MANIPULATOR_LIFT);
}

int main(int argc, char **argv) {
  void (*tests[])(void) = {invalid_joint_stops_at_measured_pose,
      cancellation_with_invalid_sensors_keeps_finite_targets, asymmetric_contact_is_not_an_empty_grasp,
      misplaced_load_is_not_released, displaced_object_during_retraction_is_not_success,
      source_movement_invalidates_the_approach, cancellation_preserves_each_finger_position,
      stowing_keeps_motion_ownership_until_sensor_confirmation,grasp_requires_two_measured_contacts};
  const int selected = argc > 1 ? atoi(argv[1]) : 0;
  for (int i = 0; i < (int)(sizeof(tests)/sizeof(tests[0])); ++i) if (!selected || selected == i + 1) {
    tests[i]();
    printf("manipulator regression %d passed\n", i + 1);
  }
  return 0;
}
