#include "controller_webots_pose.h"

#include <stddef.h>
#include <cmath>

void controller_webots_pose_init(ControllerWebotsPose *pose) {
  if (!pose) return;
  *pose = ControllerWebotsPose{0};

  pose->self_node = wb_supervisor_node_get_self();
  if (pose->self_node) {
    pose->translation_field = wb_supervisor_node_get_field(pose->self_node, "translation");
    pose->rotation_field = wb_supervisor_node_get_field(pose->self_node, "rotation");
  }

  WbNodeRef root_node = wb_supervisor_node_get_root();
  if (root_node) {
    pose->root_children_field = wb_supervisor_node_get_field(root_node, "children");
  }
}

int controller_webots_pose_is_ready(const ControllerWebotsPose *pose) {
  return pose && pose->self_node && pose->translation_field && pose->rotation_field;
}

int controller_webots_pose_reset(
    ControllerWebotsPose *pose, double x, double y, double height, double heading) {
  if (!controller_webots_pose_is_ready(pose)) return 0;

  const double translation[3] = {x, y, height};
  const double rotation[4] = {0.0, 0.0, 1.0, heading};
  wb_supervisor_field_set_sf_vec3f(pose->translation_field, translation);
  wb_supervisor_field_set_sf_rotation(pose->rotation_field, rotation);
  wb_supervisor_node_reset_physics(pose->self_node);
  return 1;
}

int controller_webots_pose_read(
    const ControllerWebotsPose *pose, double *x, double *y, double *heading) {
  if (!controller_webots_pose_is_ready(pose) || !x || !y || !heading) return 0;

  const double *translation = wb_supervisor_field_get_sf_vec3f(pose->translation_field);
  const double *orientation = wb_supervisor_node_get_orientation(pose->self_node);
  if (!translation || !orientation || !std::isfinite(orientation[0]) || !std::isfinite(orientation[3])) return 0;

  *x = translation[0];
  *y = translation[1];
  // Axis-angle includes pitch and roll caused by physical load on the base.
  *heading = std::atan2(orientation[3], orientation[0]);
  return 1;
}
