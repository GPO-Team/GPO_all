#ifndef YOUBOT_WEB_CONTROLLER_MAPPING_ROUTE_IO_H
#define YOUBOT_WEB_CONTROLLER_MAPPING_ROUTE_IO_H

#include "controller_types.h"

int controller_mapping_route_write(
    const char *path,
    const SurveyPoint *route,
    int route_count,
    MappingSurveyMode mode,
    const char *mission_id);

#endif
