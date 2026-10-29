import json
import os
import tempfile
import unittest
from pathlib import Path

from importlib.util import module_from_spec, spec_from_file_location


class WebotsHealthcheckTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name) / "robot_state.json"
        self.started = Path(self.directory.name) / "started"
        self.started.touch()
        os.utime(self.started, (100, 100))

    def check(self):
        spec = spec_from_file_location("healthcheck", Path(__file__).with_name("webots-healthcheck.py"))
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.is_healthy(self.state, self.started, now=110)

    def write(self, value, modified=109):
        self.state.write_text(json.dumps(value))
        os.utime(self.state, (modified, modified))

    def test_mission_error_does_not_make_live_controller_unhealthy(self):
        self.write({"pose": {"x": 0, "y": 1, "yaw": 0}, "navigation": {"status": "error"}})
        self.assertTrue(self.check())

    def test_stale_telemetry_is_unhealthy(self):
        self.write({"pose": {"x": 0, "y": 0, "yaw": 0}}, modified=90)
        self.assertFalse(self.check())

    def test_telemetry_from_previous_boot_is_unhealthy(self):
        self.write({"pose": {"x": 0, "y": 0, "yaw": 0}}, modified=99)
        self.assertFalse(self.check())

    def test_missing_state_or_start_marker_is_unhealthy(self):
        self.assertFalse(self.check())
        self.write({"pose": {"x": 0, "y": 0, "yaw": 0}})
        self.started.unlink()
        self.assertFalse(self.check())

    def test_invalid_json_or_pose_is_unhealthy(self):
        for value in [None, [], {"pose": {}}, {"pose": {"x": 0, "y": float("nan"), "yaw": 0}},
                      {"pose": {"x": "0", "y": 0, "yaw": 0}}]:
            self.write(value)
            self.assertFalse(self.check(), repr(value))
        self.state.write_text("{")
        self.assertFalse(self.check())


if __name__ == "__main__":
    unittest.main()
