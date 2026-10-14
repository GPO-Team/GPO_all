#include "controller_mapping_scan_transition.h"
#include <assert.h>
int main(void){ControllerRuntime r={0};r.route.count=1;r.route.waypoints[0]=Waypoint{3,4,0,0};controller_mapping_scan_transition_apply(&r,0,0);assert(r.navigation_mode==NAV_MODE_TURN&&r.distance_to_target==5);return 0;}
