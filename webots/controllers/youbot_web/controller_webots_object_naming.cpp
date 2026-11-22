#include "controller_webots_object_naming.h"

#include <cmath>
#include <stdio.h>
#include <string.h>

#include <webots/supervisor.h>

namespace {
int is_ignored_scene_node(
    const char *type_name,
    const char *def_name,
    const char *node_name) {
  if (!type_name) return 1;
  if (strcmp(type_name, "WorldInfo") == 0 ||
      strcmp(type_name, "Viewpoint") == 0 ||
      strcmp(type_name, "TexturedBackground") == 0 ||
      strcmp(type_name, "TexturedBackgroundLight") == 0 ||
      strcmp(type_name, "DirectionalLight") == 0 ||
      strcmp(type_name, "PointLight") == 0 ||
      strcmp(type_name, "SpotLight") == 0 ||
      strcmp(type_name, "Background") == 0 ||
      strcmp(type_name, "Floor") == 0 ||
      strcmp(type_name, "RectangleArena") == 0 ||
      strcmp(type_name, "Pose") == 0 ||
      strcmp(type_name, "Group") == 0 ||
      strcmp(type_name, "Transform") == 0 ||
      strcmp(type_name, "Robot") == 0 ||
      strcmp(type_name, "YoubotManipulation") == 0 ||
      strcmp(type_name, "Youbot") == 0) {
    return 1;
  }
  if (def_name && strncmp(def_name, "WEB_", 4) == 0) {
    return 1;
  }
  if (node_name &&
      (strcmp(node_name, "floor") == 0 ||
       strcmp(node_name, "youBot") == 0)) {
    return 1;
  }
  return 0;
}

void sanitize_csv_label(char *text) {
  if (!text) return;
  for (char *p = text; *p; ++p) {
    const unsigned char ch = (unsigned char)*p;
    if (ch < 32 || ch > 126 || *p == ',' || *p == ';') {
      *p = ' ';
    }
  }
}
}

int controller_webots_object_naming_resolve(
    double world_x,
    double world_z,
    double max_search_radius_m,
    const char *fallback_label,
    char *out_label,
    size_t out_label_size) {
  if (!out_label || out_label_size == 0) return 0;
  if (fallback_label && fallback_label[0] != '\0') {
    snprintf(out_label, out_label_size, "%s", fallback_label);
  } else {
    out_label[0] = '\0';
  }

  WbNodeRef root = wb_supervisor_node_get_root();
  if (!root) return 0;
  WbFieldRef children = wb_supervisor_node_get_field(root, "children");
  if (!children) return 0;

  const int count = wb_supervisor_field_get_count(children);
  double best_dist = (max_search_radius_m > 0.0) ? max_search_radius_m : 1.35;
  WbNodeRef best_node = 0;

  for (int i = 0; i < count; ++i) {
    WbNodeRef node = wb_supervisor_field_get_mf_node(children, i);
    if (!node) continue;
    const char *type_name = wb_supervisor_node_get_type_name(node);
    const char *def_name = wb_supervisor_node_get_def(node);
    WbFieldRef name_field = wb_supervisor_node_get_field(node, "name");
    const char *node_name = name_field ? wb_supervisor_field_get_sf_string(name_field) : "";

    if (is_ignored_scene_node(type_name, def_name, node_name)) continue;

    const double *pos = wb_supervisor_node_get_position(node);
    if (!pos) continue;

    const double dist = hypot(pos[0] - world_x, pos[1] - world_z);
    if (dist <= best_dist) {
      best_dist = dist;
      best_node = node;
    }
  }

  if (!best_node) return 0;

  const char *type_name = wb_supervisor_node_get_type_name(best_node);
  const char *def_name = wb_supervisor_node_get_def(best_node);
  WbFieldRef name_field = wb_supervisor_node_get_field(best_node, "name");
  const char *node_name = name_field ? wb_supervisor_field_get_sf_string(name_field) : "";

  const char *primary = (def_name && def_name[0])
                            ? def_name
                            : ((type_name && type_name[0]) ? type_name : "Object");
  const char *instance = (node_name && node_name[0] &&
                          strcmp(node_name, "solid") != 0 &&
                          strcmp(node_name, primary) != 0)
                             ? node_name
                             : nullptr;

  if (instance) {
    snprintf(out_label, out_label_size, "%s [%s]", primary, instance);
  } else {
    snprintf(out_label, out_label_size, "%s", primary);
  }

  sanitize_csv_label(out_label);
  return 1;
}