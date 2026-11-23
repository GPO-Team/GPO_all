#ifndef YOUBOT_WEB_CONTROLLER_WEBOTS_OBJECT_NAMING_H
#define YOUBOT_WEB_CONTROLLER_WEBOTS_OBJECT_NAMING_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

int controller_webots_object_naming_resolve(
    double world_x,
    double world_z,
    double max_search_radius_m,
    const char *fallback_label,
    char *out_label,
    size_t out_label_size);

#ifdef __cplusplus
}
#endif

#endif