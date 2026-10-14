#include "controller_input_orchestration.h"

#include <assert.h>

typedef struct {
  char trace[16];
  int count;
} TestContext;

static void append(void *value, char value_to_append) {
  TestContext *context = static_cast<TestContext *>(value);
  context->trace[context->count++] = value_to_append;
}

static ControllerInputMotionReloadResult reload_motion(void *context) {
  append(context, 'M');
  return CONTROLLER_INPUT_MOTION_RELOAD_CHANGED;
}
static void reload_runtime(void *context) { append(context, 'C'); }
static void reload_limit(void *context) { append(context, 'L'); }
static void reload_surface(void *context) { append(context, 'S'); }
static void reload_route(void *context) { append(context, 'R'); }
static void set_status(void *context, const char *status) {
  assert(status[0] == 'm');
  append(context, 'T');
}

int main(void) {
  TestContext test = {{0}, 0};
  const ControllerInputOrchestrationOperations operations = {
      reload_motion, reload_runtime, reload_limit, reload_surface, reload_route, set_status};
  ControllerInputOrchestration input;
  controller_input_orchestration_init(&input, &operations, &test, 10, 20, 6);

  controller_input_orchestration_reload_zones(&input, 10);
  controller_input_orchestration_reload_surface_zones(&input, 10);
  controller_input_orchestration_reload_route(&input, 20);
  controller_input_orchestration_reload_motion(&input, 20);
  controller_input_orchestration_reload_runtime_command(&input, 18);

  assert(test.count == 6);
  assert(test.trace[0] == 'L' && test.trace[1] == 'S' && test.trace[2] == 'R');
  assert(test.trace[3] == 'M' && test.trace[4] == 'T' && test.trace[5] == 'C');
  return 0;
}
