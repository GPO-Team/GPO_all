#include "controller_mapping_scan_transition.h"
#include <cmath>
void controller_mapping_scan_transition_apply(ControllerRuntime *r,double x,double z){if(!r||r->current_waypoint_index<0||r->current_waypoint_index>=r->route.count)return;r->navigation_waypoint_index=r->current_waypoint_index;r->navigation_segment_start_x=x;r->navigation_segment_start_z=z;r->navigation_mode=NAV_MODE_TURN;r->distance_to_target=hypot(r->route.waypoints[r->current_waypoint_index].x-x,r->route.waypoints[r->current_waypoint_index].z-z);}
