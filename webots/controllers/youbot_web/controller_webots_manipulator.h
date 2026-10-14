#ifndef CONTROLLER_WEBOTS_MANIPULATOR_H
#define CONTROLLER_WEBOTS_MANIPULATOR_H
#include "controller_manipulator.h"
#include "controller_types.h"
typedef enum {DELIVERY_IDLE, DELIVERY_FETCH, DELIVERY_PICK, DELIVERY_DRIVE, DELIVERY_PLACE, DELIVERY_TERMINAL} ControllerDeliveryPhase;

typedef struct {
  ControllerManipulator state;
  char mission_id[64];
  char object_def[64];
  ControllerManipulatorSample sample;
  double object_world[3];
  ControllerDeliveryPhase delivery_phase;
  int mobile;
  double destination_world[3];
  double delivery_yaw;
  double delivery_elapsed;
  double drive_timeout;
  int delivery_waypoint;
  int room_zone_index;
} ControllerWebotsManipulator;

void controller_webots_manipulator_start(const RuntimeCommand *command);
void controller_webots_manipulator_cancel(const char *mission_id);
// Returns true while it owns navigation, including terminal failure/cancellation.
int controller_webots_manipulator_step(double dt);
int controller_webots_manipulator_busy(void);
int controller_webots_manipulator_active(const ControllerWebotsManipulator *manipulator);
const char *controller_webots_manipulator_stage(const ControllerWebotsManipulator *manipulator);
#endif
