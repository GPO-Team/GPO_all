#ifndef CONTROLLER_TRANSFER_ROUTE_H
#define CONTROLLER_TRANSFER_ROUTE_H
#include "controller_types.h"

// Shortest path on a conservative rectangle-corner visibility graph.
// Bounds are world x [-22,22], y [-17,17], inset by robot clearance.
// Output excludes the start and includes a final heading of zero.
int controller_transfer_route_plan(const ZoneData *zones,
    double start_x, double start_y, double goal_x, double goal_y,
    double clearance, RouteData *out);
#endif
