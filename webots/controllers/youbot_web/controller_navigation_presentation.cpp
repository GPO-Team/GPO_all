#include "controller_navigation_presentation.h"

const char *controller_navigation_presentation_tracking_status(
    ControllerNavigationTrackingStatus status) {
  switch (status) {
    case CONTROLLER_NAVIGATION_STATUS_ALIGN_FINAL:
      return "aligning_final_heading";
    case CONTROLLER_NAVIGATION_STATUS_TURN_PATH:
      return "turning_to_path";
    case CONTROLLER_NAVIGATION_STATUS_TURN_LIDAR:
      return "turning_lidar_priority";
    case CONTROLLER_NAVIGATION_STATUS_TRACK_LIDAR:
      return "tracking_lidar_priority";
    case CONTROLLER_NAVIGATION_STATUS_TRACK_ZONE:
      return "tracking_planned_zone_bypass";
    case CONTROLLER_NAVIGATION_STATUS_TRACK_PATH:
    default:
      return "tracking_path";
  }
}
