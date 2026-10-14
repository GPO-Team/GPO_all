#include "controller_manipulator.h"
#include <cmath>
#include <string.h>

#define ARM_PI 3.14159265358979323846
#define ARM_TOOL_LENGTH 0.199
#define ARM_CLEARANCE 0.08
static const double lower[5] = {-2.9496, -1.13446, -2.63545, -1.78024, -2.92343};
static const double upper[5] = {2.9496, 1.5708, 2.54818, 1.78024, 2.92343};

void controller_manipulator_forward(const double q[5], double p[3]) {
  const double a = q[1], b = a + q[2], c = b + q[3];
  const double r = 0.033 - 0.155 * sin(a) - 0.135 * sin(b) - ARM_TOOL_LENGTH * sin(c);
  p[0] = 0.156 + r * cos(q[0]);
  p[1] = r * sin(q[0]);
  p[2] = 0.147 + 0.155 * cos(a) + 0.135 * cos(b) + ARM_TOOL_LENGTH * cos(c);
}

int controller_manipulator_inverse(const double p[3], double q[5]) {
  if (!p || !q) return 0;
  for (int i = 0; i < 3; ++i) if (!std::isfinite(p[i])) return 0;
  const double dx = p[0] - 0.156, dy = p[1];
  const double r = hypot(dx, dy) - 0.033;
  const double z = p[2] - 0.147 + ARM_TOOL_LENGTH;
  const double cosine = (r * r + z * z - 0.155 * 0.155 - 0.135 * 0.135) / (2 * 0.155 * 0.135);
  if (r <= 0.06 || cosine < -1 || cosine > 1) return 0;
  q[0] = atan2(dy, dx);
  q[2] = -acos(cosine);
  q[1] = atan2(-r, z) - atan2(0.135 * sin(q[2]), 0.155 + 0.135 * cos(q[2]));
  q[3] = -ARM_PI - q[1] - q[2];
  q[4] = 0;
  for (int i = 0; i < 5; ++i) if (!std::isfinite(q[i]) || q[i] < lower[i] || q[i] > upper[i]) return 0;
  return 1;
}

int controller_manipulator_active(const ControllerManipulator *arm) {
  return arm && arm->stage >= MANIPULATOR_OPEN && arm->stage <= MANIPULATOR_STOW;
}

double controller_manipulator_finger_target(const ControllerManipulator *arm, int finger) {
  if (!arm || finger < 0 || finger > 1) return 0;
  return arm->hold_fingers ? arm->held_fingers[finger] : arm->finger_target;
}

static void enter(ControllerManipulator *arm, ControllerManipulatorStage stage) {
  arm->stage = stage;
  arm->elapsed = arm->settled = 0;
  int pose = -1;
  switch (stage) {
    case MANIPULATOR_APPROACH: case MANIPULATOR_LIFT: pose = 1; break;
    case MANIPULATOR_DESCEND: case MANIPULATOR_CLOSE: pose = 0; break;
    case MANIPULATOR_TRANSFER: case MANIPULATOR_RETRACT: pose = 3; break;
    case MANIPULATOR_LOWER: case MANIPULATOR_RELEASE: pose = 2; break;
    default: break;
  }
  if (pose >= 0) memcpy(arm->targets, arm->poses[pose], sizeof(arm->targets));
  if(stage==MANIPULATOR_STOW) {
    // Fold the unloaded arm out of the front lidar plane before releasing
    // ownership to navigation. Otherwise the gripper looks like an obstacle.
    const double transport_pose[5]={0,1.57,-2.635,1.78,0};
    memcpy(arm->targets,transport_pose,sizeof(arm->targets));
  }
  arm->finger_target = stage < MANIPULATOR_CLOSE || stage >= MANIPULATOR_RELEASE ? 0.025 : 0.0;
}

int controller_manipulator_start(ControllerManipulator *arm, const double source[3], const double destination[3]) {
  if (!arm || !source || !destination || controller_manipulator_active(arm)) return 0;
  ControllerManipulator next = {};
  next.error = "";
  memcpy(next.source, source, sizeof(next.source));
  memcpy(next.destination, destination, sizeof(next.destination));
  double above_source[3] = {source[0], source[1], source[2] + ARM_CLEARANCE};
  double above_destination[3] = {destination[0], destination[1], destination[2] + ARM_CLEARANCE};
  const double *positions[4] = {source, above_source, destination, above_destination};
  const char *errors[4] = {"source_unreachable", "source_approach_unreachable",
      "target_unreachable", "target_approach_unreachable"};
  for (int index = 0; index < 4; ++index) {
    if (!controller_manipulator_inverse(positions[index], next.poses[index])) {
      arm->error = errors[index];
      return 0;
    }
  }
  // Open without lowering the arm; initial targets are set by the hardware adapter.
  memcpy(next.targets, arm->targets, sizeof(next.targets));
  enter(&next, MANIPULATOR_OPEN);
  *arm = next;
  return 1;
}

static int joints_ready(const ControllerManipulator *arm, const ControllerManipulatorSample *sample) {
  for (int i = 0; i < 5; ++i) {
    if (!std::isfinite(sample->joints[i]) || fabs(sample->joints[i] - arm->targets[i]) > 0.015) return 0;
  }
  return 1;
}

static double distance(const double a[3], const double b[3]) {
  return sqrt((a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]));
}

static void freeze_at_sample(ControllerManipulator *arm, const ControllerManipulatorSample *sample) {
  for (int i = 0; i < 5; ++i) {
    if (std::isfinite(sample->joints[i])) arm->targets[i] = fmax(lower[i], fmin(upper[i], sample->joints[i]));
    else arm->halt_motion = 1;
  }
  for (int i = 0; i < 2; ++i) {
    arm->held_fingers[i] = std::isfinite(sample->fingers[i]) ? fmax(0, fmin(0.025, sample->fingers[i]))
        : controller_manipulator_finger_target(arm, i);
    if (!std::isfinite(sample->fingers[i])) arm->halt_motion = 1;
  }
  arm->hold_fingers = 1;
}

static void fail(ControllerManipulator *arm, const ControllerManipulatorSample *sample, const char *error) {
  freeze_at_sample(arm, sample);
  // Preserve the grasp on failures after closing; never automatically drop a load.
  arm->stage = MANIPULATOR_FAILED;
  arm->error = error;
}

void controller_manipulator_cancel(ControllerManipulator *arm, const ControllerManipulatorSample *sample) {
  if (!controller_manipulator_active(arm) || !sample) return;
  freeze_at_sample(arm, sample);
  if (std::isfinite(sample->fingers[0]) && std::isfinite(sample->fingers[1])) {
    arm->finger_target = fmax(0, fmin(0.025, fmin(sample->fingers[0], sample->fingers[1])));
  }
  if (arm->halt_motion) arm->error = "invalid_sensor";
  arm->stage = MANIPULATOR_CANCELLED;
}

void controller_manipulator_step(ControllerManipulator *arm, const ControllerManipulatorSample *sample, double dt) {
  if (!controller_manipulator_active(arm) || !sample || !std::isfinite(dt) || dt <= 0) return;
  if (!sample->object_valid) { fail(arm, sample, "object_missing"); return; }
  for (int i = 0; i < 3; ++i) if (!std::isfinite(sample->object[i])) { fail(arm, sample, "invalid_sensor"); return; }
  for (int i = 0; i < 5; ++i) if (!std::isfinite(sample->joints[i])) { fail(arm, sample, "invalid_sensor"); return; }
  for (int i = 0; i < 2; ++i) if (!std::isfinite(sample->fingers[i])) { fail(arm, sample, "invalid_sensor"); return; }
  if (sample->contacts_required && (!std::isfinite(sample->contacts[0]) || !std::isfinite(sample->contacts[1]))) {
    fail(arm, sample, "invalid_sensor"); return;
  }
  arm->elapsed += dt;
  if (arm->elapsed > 12) { fail(arm, sample, "stage_timeout"); return; }
  if (arm->stage <= MANIPULATOR_DESCEND && distance(sample->object, arm->source) > 0.03) {
    fail(arm, sample, "object_moved"); return;
  }
  int ready = joints_ready(arm, sample);
  if (arm->stage == MANIPULATOR_OPEN || arm->stage == MANIPULATOR_RELEASE) {
    ready = ready && sample->fingers[0] > 0.024 && sample->fingers[1] > 0.024;
  }
  if (arm->stage == MANIPULATOR_CLOSE) {
    const int stable = fabs(sample->fingers[0] - arm->previous_fingers[0]) <= 0.002 * dt &&
        fabs(sample->fingers[1] - arm->previous_fingers[1]) <= 0.002 * dt;
    memcpy(arm->previous_fingers, sample->fingers, sizeof(arm->previous_fingers));
    if (arm->elapsed < 1.0) return;
    if (sample->fingers[0] + sample->fingers[1] < 0.002) { fail(arm, sample, "empty_grasp"); return; }
    ready = ready && stable && (!sample->contacts_required || (fabs(sample->contacts[0])>0.02 && fabs(sample->contacts[1])>0.02));
  }
  if (arm->stage >= MANIPULATOR_LIFT && arm->stage <= MANIPULATOR_LOWER) {
    double tool[3];
    controller_manipulator_forward(sample->joints, tool);
    if (distance(tool, sample->object) > 0.055) { fail(arm, sample, "object_lost"); return; }
    if (arm->stage == MANIPULATOR_LIFT) ready = ready && sample->object[2] > arm->source[2] + 0.04;
  }
  if (arm->stage == MANIPULATOR_LOWER || arm->stage == MANIPULATOR_RELEASE) {
    ready = ready && distance(sample->object, arm->destination) < 0.03;
  }
  if ((arm->stage == MANIPULATOR_RETRACT || arm->stage == MANIPULATOR_STOW) && distance(sample->object, arm->destination) > 0.04) {
    fail(arm, sample, "placement_failed"); return;
  }
  arm->settled = ready ? arm->settled + dt : 0;
  if (arm->settled < 0.16) return;
  enter(arm, (ControllerManipulatorStage)(arm->stage + 1));
}

const char *controller_manipulator_stage_name(ControllerManipulatorStage stage) {
  static const char *names[] = {"idle", "opening", "approaching", "descending", "closing", "lifting",
      "transferring", "lowering", "releasing", "retracting", "stowing", "completed", "failed", "cancelled"};
  return stage >= MANIPULATOR_IDLE && stage <= MANIPULATOR_CANCELLED ? names[stage] : "failed";
}
