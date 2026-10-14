import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

const controllerDirectory = "webots/controllers/youbot_web";
const runtimeSource = [
  "controller_app_lifecycle.cpp",
  "controller_camera_runtime.cpp",
  "controller_lidar_runtime.cpp",
  "controller_survey_runtime.cpp",
  "controller_navigation_runtime.cpp",
  "controller_input_runtime.cpp",
].map((file) => readFileSync(`${controllerDirectory}/${file}`, "utf8")).join("\n");

describe("Webots controller build configuration", () => {
  it("keeps the executable entry point thin and registers focused runtimes", () => {
    const entryPath = `${controllerDirectory}/youbot_web.cpp`;
    const entry = readFileSync(entryPath, "utf8");
    const entryLines = entry.split(/\r?\n/u).filter((line) => line.trim()).length;
    const runtimeModules = [
      "controller_app_context",
      "controller_camera_runtime",
      "controller_lidar_runtime",
      "controller_survey_runtime",
      "controller_navigation_runtime",
      "controller_input_runtime",
      "controller_app_lifecycle",
    ];

    expect(entryLines).toBeLessThanOrEqual(50);
    expect(entry).toContain('#include "controller_app_context.h"');
    expect(entry).toContain('#include "controller_app_lifecycle.h"');
    for (const module of runtimeModules) {
      expect(existsSync(`${controllerDirectory}/${module}.h`)).toBe(true);
      expect(existsSync(`${controllerDirectory}/${module}.cpp`)).toBe(true);
    }
    expect(entry).not.toMatch(/static\s+(?:void|int|double)\s+(?!main\b)/u);
  });

  it("uses one canonical manifest for every production controller source", () => {
    const manifestPath = `${controllerDirectory}/controller_sources.txt`;

    expect(existsSync(manifestPath), "controller source manifest is missing").toBe(true);
    if (!existsSync(manifestPath)) return;

    const manifestSources = readFileSync(manifestPath, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
    const productionSources = readdirSync(controllerDirectory)
      .filter((file) => file.endsWith(".cpp") && !file.endsWith("_test.cpp"))
      .sort();
    const legacyCSources = readdirSync(controllerDirectory)
      .filter((file) => file.endsWith(".c"));

    expect(manifestSources).toEqual(productionSources);
    expect(legacyCSources).toEqual([]);
    for (const buildFile of ["Makefile", "build_youbot_web.bat", "run_controller_tests.bat"]) {
      const buildSource = readFileSync(`${controllerDirectory}/${buildFile}`, "utf8");
      expect(buildSource, `${buildFile} must consume controller_sources.txt`).toContain(
        "controller_sources.txt",
      );
    }
  });

  it("loads the canonical source manifest from the Webots Makefile", () => {
    const makefile = readFileSync(`${controllerDirectory}/Makefile`, "utf8");

    expect(makefile).toContain("CXX_SOURCES := $(strip $(file <controller_sources.txt))");
    expect(makefile).toContain("CXXFLAGS += -std=c++20");
  });

  it("loads the canonical source manifest from both Windows commands", () => {
    const windowsBuild = readFileSync(`${controllerDirectory}/build_youbot_web.bat`, "utf8");
    const testRunner = readFileSync(`${controllerDirectory}/run_controller_tests.bat`, "utf8");

    expect(windowsBuild).toContain('in ("controller_sources.txt")');
    expect(testRunner).toContain('in ("%CONTROLLER_DIR%controller_sources.txt")');
    expect(testRunner).toContain('if /I not "%%S"=="youbot_web.cpp"');
    expect(windowsBuild).toContain("/std:c++20");
    expect(testRunner).toContain("/std:c++20");
  });

  it("uses strict void signatures for lifecycle callbacks", () => {
    const source = runtimeSource;
    const callbackNames = [
      "maybe_reload_zones",
      "maybe_reload_surface_zones",
      "maybe_reload_route",
      "maybe_reload_motion_profile",
      "maybe_reload_runtime_command",
      "capture_lidar_trace",
      "maybe_write_map",
      "run_navigation_step",
      "update_route_avoidance_metrics",
      "write_state_snapshot",
    ];

    for (const name of callbackNames) {
      expect(source, `${name} must accept an explicit void parameter list`).toMatch(
        new RegExp(`(?:static\\s+)?(?:void|int)\\s+${name}\\(void\\)`),
      );
    }
  });

  it("provides one command for all standalone controller tests", () => {
    expect(packageJson.scripts["test:webots"]).toBe(
      "webots\\controllers\\youbot_web\\run_controller_tests.bat",
    );
  });

  it("allows a single standalone controller test to be selected", () => {
    const testRunner = readFileSync(`${controllerDirectory}/run_controller_tests.bat`, "utf8");

    expect(testRunner).toContain("CONTROLLER_TEST_FILTER");
  });

  it("does not persist negative zero-like youBot finger positions", () => {
    const world = readFileSync("webots/worlds/youbot_only.wbt", "utf8");

    expect(world).not.toMatch(/hidden position_8_[01] -\d+(?:\.\d+)?e-\d+/u);
  });

  it("propagates controller compile and runtime failures to npm", () => {
    const testRunner = readFileSync(`${controllerDirectory}/run_controller_tests.bat`, "utf8");

    expect(testRunner).toContain("goto :test_failed");
    expect(testRunner).toContain('if not "!TEST_EXIT!"=="0"');
    expect(testRunner).toMatch(/:test_failed[\s\S]*exit \/b 1/u);
  });

  it("builds standalone tests with the Webots SDK and production adapters", () => {
    const testRunner = readFileSync(`${controllerDirectory}/run_controller_tests.bat`, "utf8");
    const manifest = readFileSync(`${controllerDirectory}/controller_sources.txt`, "utf8");

    for (const source of [
      "controller_webots_devices.cpp",
      "controller_webots_pose.cpp",
      "controller_webots_sensors.cpp",
      "controller_webots_simulation.cpp",
    ]) {
      expect(manifest, `${source} is missing from the canonical manifest`).toContain(source);
    }

    expect(testRunner).toContain("if not defined WEBOTS_HOME (");
    expect(testRunner).toContain('"D:\\DS\\Programs\\Webots\\include\\controller\\c\\webots\\robot.h"');
    expect(testRunner).toContain('"C:\\Program Files\\Webots\\include\\controller\\c\\webots\\robot.h"');
    expect(testRunner).toContain('if not exist "%WEBOTS_HOME%\\include\\controller\\c\\webots\\robot.h" (');
    expect(testRunner).toContain('set "WEBOTS_INCLUDE=%WEBOTS_HOME%\\include\\controller\\c"');
    expect(testRunner).toContain('set "WEBOTS_LIBRARY=%WEBOTS_HOME%\\lib\\controller"');
    expect(testRunner).toContain('/I"%WEBOTS_INCLUDE%"');
    expect(testRunner).toContain('/LIBPATH:"%WEBOTS_LIBRARY%" Controller.lib');
  });

  it("keeps Supervisor pose access outside the orchestration file", () => {
    const source = runtimeSource;

    expect(source).not.toContain("wb_supervisor_node_get_self");
    expect(source).not.toContain("wb_supervisor_field_get_sf_vec3f");
    expect(source).not.toContain("wb_supervisor_field_set_sf_vec3f");
    expect(source).toContain('#include "controller_webots_pose.h"');
  });

  it("keeps Webots motor access outside the orchestration file", () => {
    const source = runtimeSource;

    expect(source).not.toContain("wb_motor_set_position");
    expect(source).not.toContain("wb_motor_set_velocity");
    expect(source).not.toContain("<webots/motor.h>");
    expect(source).toContain('#include "controller_webots_devices.h"');
  });

  it("keeps Webots sensor access outside the orchestration file", () => {
    const source = runtimeSource;

    expect(source).not.toContain("wb_robot_get_device");
    expect(source).not.toContain("wb_lidar_");
    expect(source).not.toContain("wb_camera_");
    expect(source).not.toContain("<webots/lidar.h>");
    expect(source).not.toContain("<webots/camera.h>");
    expect(source).toContain('#include "controller_webots_sensors.h"');
  });

  it("delegates limit-zone rendering to the Simulation Adapter", () => {
    const source = runtimeSource;
    const reloadService = readFileSync(
      `${controllerDirectory}/controller_route_zone_reload_service.cpp`,
      "utf8",
    );
    const adapter = readFileSync(`${controllerDirectory}/controller_webots_zone_sync.cpp`, "utf8");

    expect(source).toContain("controller_route_zone_reload_service_reload_limit(");
    expect(reloadService).toContain("controller_webots_zone_sync_limit_zones(");
    expect(adapter).toContain("controller_webots_simulation_sync_limit_zones(");
    expect(source).not.toContain("name \"dynamic_zone_wall\"");
    expect(source).not.toContain("controller_webots_simulation_format_limit_wall(");
  });

  it("delegates limit-zone node synchronization to the Simulation Adapter", () => {
    const source = runtimeSource;
    const reloadService = readFileSync(
      `${controllerDirectory}/controller_route_zone_reload_service.cpp`,
      "utf8",
    );
    const adapter = readFileSync(`${controllerDirectory}/controller_webots_zone_sync.cpp`, "utf8");

    expect(source).toContain("controller_route_zone_reload_service_reload_limit(");
    expect(reloadService).toContain("controller_webots_zone_sync_limit_zones(");
    expect(adapter).toContain("controller_webots_simulation_sync_limit_zones(");
    expect(source).not.toContain('"WEB_LIMIT_%d_%d"');
  });

  it("delegates surface-zone presentation to the Simulation Adapter", () => {
    const source = runtimeSource;
    const reloadService = readFileSync(
      `${controllerDirectory}/controller_route_zone_reload_service.cpp`,
      "utf8",
    );
    const adapter = readFileSync(`${controllerDirectory}/controller_webots_zone_sync.cpp`, "utf8");

    expect(source).toContain("controller_route_zone_reload_service_reload_surface(");
    expect(reloadService).toContain("controller_webots_zone_sync_surface_zones(");
    expect(adapter).toContain("controller_webots_simulation_sync_surface_zones(");
    expect(source).not.toContain("geometry IndexedFaceSet {");
    expect(source).not.toContain("controller_webots_simulation_format_surface_zone(");
  });

  it("delegates runtime-obstacle presentation to the Simulation Adapter", () => {
    const source = runtimeSource;
    const adapter = readFileSync(`${controllerDirectory}/controller_webots_zone_sync.cpp`, "utf8");

    expect(source).toContain("controller_webots_zone_sync_spawn_obstacle(");
    expect(adapter).toContain("controller_webots_simulation_spawn_runtime_obstacle(");
    expect(source).not.toContain("name \"runtime_obstacle\"");
    expect(source).not.toContain("controller_webots_simulation_format_runtime_obstacle(");
    expect(source).not.toContain("wb_supervisor_node_get_from_def");
  });

  it("delegates camera-to-LiDAR range matching to Camera Fusion", () => {
    const source = runtimeSource;
    const adapter = readFileSync(`${controllerDirectory}/controller_webots_camera_range.cpp`, "utf8");

    expect(source).toContain("controller_webots_camera_range_from_lidar(");
    expect(source).toContain("controller_webots_camera_confirmed_range_from_lidar(");
    expect(adapter).toContain("controller_camera_fusion_confirmed_range(");
    expect(source).not.toContain("double best_angle_error = CAMERA_RANGE_SEARCH_WINDOW_RAD");
  });

  it("delegates virtual-camera reticle rendering to Camera Render", () => {
    const source = runtimeSource;

    expect(source).toContain("controller_camera_render_reticle(");
    expect(source).not.toContain("center_x - 14, horizon, center_x + 14, horizon, 80, 220, 230");
  });

  it("delegates virtual-camera waypoint-marker rendering to Camera Render", () => {
    const source = runtimeSource;

    expect(source).toContain("controller_camera_render_waypoint_marker(");
    expect(source).not.toContain("target_x - 3, horizon - 21, target_x + 3, horizon - 15");
  });

  it("delegates camera-observation decisions to Camera", () => {
    const source = runtimeSource;
    const adapter = readFileSync(`${controllerDirectory}/controller_webots_camera_perception.cpp`, "utf8");

    expect(source).toContain("controller_webots_camera_perception_analyze(");
    expect(adapter).toContain("controller_camera_observation_hint(");
    expect(source).not.toContain("camera_obstacle_center_offset * fmax(effective_fov, 0.8) * 0.5");
  });

  it("delegates virtual-camera LiDAR clustering to Camera Virtual", () => {
    const source = runtimeSource;

    expect(source).toContain("controller_camera_virtual_collect(");
    expect(source).not.toContain("typedef struct {\n    double angle;\n    double range;\n    int beams;\n  } VirtualCameraCluster");
  });
});
