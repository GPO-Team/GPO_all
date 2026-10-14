#include "controller_navigation_presentation.h"

#include <string.h>

int main(void) {
  if (strcmp(controller_navigation_presentation_tracking_status(
                 CONTROLLER_NAVIGATION_STATUS_TURN_LIDAR),
             "turning_lidar_priority") != 0) return 1;
  if (strcmp(controller_navigation_presentation_tracking_status(
                 CONTROLLER_NAVIGATION_STATUS_TRACK_ZONE),
             "tracking_planned_zone_bypass") != 0) return 2;
  if (strcmp(controller_navigation_presentation_tracking_status(
                 CONTROLLER_NAVIGATION_STATUS_TRACK_PATH),
             "tracking_path") != 0) return 3;
  return 0;
}
