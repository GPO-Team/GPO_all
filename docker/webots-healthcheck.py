import json
import math
import os
import time
from pathlib import Path

def is_healthy(state, marker, now=None):
    try:
        started = marker.stat().st_mtime
        observed = state.stat().st_mtime
        if observed < started or (time.time() if now is None else now) - observed > 15:
            return False
        with state.open() as source:
            telemetry = json.load(source)
    except (OSError, ValueError):
        return False
    pose = telemetry.get("pose") if isinstance(telemetry, dict) else None
    # A rejected mission is an application outcome, not a dead simulator.
    return isinstance(pose, dict) and all(
        type(pose.get(key)) in (float, int) and math.isfinite(pose[key])
        for key in ("x", "y", "yaw")
    )


if __name__ == "__main__":
    state = Path(os.environ["WEB_STATE_DIR"]) / "robot_state.json"
    raise SystemExit(0 if is_healthy(state, Path("/tmp/webots-started")) else 1)
