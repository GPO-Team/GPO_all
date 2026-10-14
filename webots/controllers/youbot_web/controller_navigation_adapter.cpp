#include "controller_navigation_adapter.h"
int controller_navigation_adapter_terminal_effect(const ControllerRuntimeNavigationResult *result, ControllerNavigationAdapterEffect *effect) {
  if (!result || !effect) return 0;
  *effect = ControllerNavigationAdapterEffect{0};
  switch (result->action) {
    case CONTROLLER_RUNTIME_ACTION_WAIT_FOR_ROUTE: *effect = ControllerNavigationAdapterEffect{1,1,1,1,0,0,0,0,"waiting_for_route"}; return 1;
    case CONTROLLER_RUNTIME_ACTION_STOP_FINISHED: *effect = ControllerNavigationAdapterEffect{1,1,0,1,0,0,0,0,"finished"}; return 1;
    case CONTROLLER_RUNTIME_ACTION_ROUTE_COMPLETED: *effect = ControllerNavigationAdapterEffect{1,1,0,0,0,0,0,0,"finished"}; return 1;
    case CONTROLLER_RUNTIME_ACTION_RELOCALIZE: *effect = ControllerNavigationAdapterEffect{1,0,0,0,1,result->navigation.session.session.segment_start_x,result->navigation.session.session.segment_start_z,result->navigation.session.session.distance_to_target,"relocalized_pose"}; return 1;
    default: return 0;
  }
}
