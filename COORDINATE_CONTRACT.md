# Coordinate Contract

This project uses a single world-plane contract across the UI, bridge and Webots controller.

## World axes

- `x`: world X coordinate on the floor plane
- `y`: world Y coordinate on the floor plane
- `z`: height above the floor
- `yaw`: robot heading on the floor plane, in radians

The route planner and the robot move in the `x/y` plane.
The `z` axis is height only.

## Route payload

Route points are always sent as:

```json
{
  "x": 1.25,
  "y": -0.80
}
```

## route.csv

The bridge writes controller waypoints using this header:

```text
x,y,headingDeg
```

`headingDeg` is the desired floor-plane heading in degrees.

## Telemetry payload

Telemetry sent to the UI is normalized to:

```json
{
  "type": "telemetry",
  "pose": {
    "x": 1.25,
    "y": -0.80,
    "z": 0.102838,
    "yaw": 1.57
  },
  "navigation": {},
  "simulationTime": 12.5
}
```

For a short migration window, the bridge may also mirror `x`, `y`, `z` and `yaw` at the top level.
