#include "controller_navigation_state.h"
#include <assert.h>
int main(void) { ControllerRuntime r = {0}; r.current_waypoint_index = 4; controller_navigation_state_begin(&r, 4, 2.0, 3.0); assert(r.navigation_mode == NAV_MODE_TURN && r.navigation_segment_start_x == 2.0); controller_navigation_state_clear_local(&r, 0, 0); controller_navigation_state_reset(&r, 0, 0); assert(r.navigation_mode == NAV_MODE_IDLE && r.navigation_waypoint_index == -1); return 0; }
