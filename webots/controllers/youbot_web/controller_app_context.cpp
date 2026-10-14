#include "controller_app_context.h"

#include <string.h>

ControllerAppContext controller_app;

void controller_app_context_init(ControllerAppContext *context) {
  if (!context) return;
  memset(context, 0, sizeof(*context));
  context->control_config = controller_control_config_default();
  controller_application_state_init(&context->application_state);
  controller_perception_runtime_init(&context->perception_runtime);
  context->motion_state = ControllerWebotsMotionState{
      {0.22, 0.0, 100.0},
      {0.22, 1.6, 1.0},
  };
}
