#ifndef CONTROLLER_TRANSFER_ROUTE_H
#define CONTROLLER_TRANSFER_ROUTE_H
#include "controller_types.h"

// Shortest path on a conservative rectangle-corner visibility graph.
// Bounds are world x [-22,22], y [-17,17], inset by robot clearance.
// Output excludes the start and includes the requested final heading.
typedef struct { double x, y, radius; } ControllerTransferObstacle;
int controller_transfer_route_plan(const ZoneData *zones,
    double start_x, double start_y, double goal_x, double goal_y,
    double clearance, RouteData *out, double final_heading = 0.0,
    const ControllerTransferObstacle *object = nullptr);
// Choose a reachable side of the object, avoiding the physical cargo on pickup.
int controller_transfer_route_plan_dock(const ZoneData *zones,
    double start_x, double start_y, double object_x, double object_y,
    double clearance, int pickup, RouteData *out);
typedef struct { double vx, vy, omega; } ControllerTransferVelocity;
ControllerTransferVelocity controller_transfer_route_velocity(double dx, double dy,
    double heading, double final_heading, int final_waypoint, double speed_limit, double angular_limit);
#endif
