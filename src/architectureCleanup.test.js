import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("architecture cleanup", () => {
  it("publishes bridge ports on loopback only", () => {
    const compose = readFileSync("compose.yaml", "utf8");

    for (const port of [9001, 9002, 9003]) {
      expect(compose).toContain(`127.0.0.1:${port}:${port}`);
    }
  });

  it("defines independent service containers and a Windows simulator launcher", () => {
    const compose = readFileSync("compose.yaml", "utf8");

    expect(compose).toContain("dockerfile: docker/frontend.Dockerfile");
    expect(compose).toContain('127.0.0.1:8080:80');
    for (const service of ["planning", "route", "telemetry"]) {
      expect(compose).toContain(`bridge/processes/run-${service}-service.cjs`);
    }
    expect(compose).not.toContain("ws-bridge.cjs");
    expect(existsSync("scripts/start-stack.mjs")).toBe(true);
    expect(existsSync("docker/nginx.conf")).toBe(true);
  });

  it("does not keep the unused collapsible section implementation", () => {
    expect(existsSync("src/components/dashboard/CollapsibleSection.jsx")).toBe(false);

    const plannerUiState = readFileSync("src/lib/plannerUiState.js", "utf8");
    expect(plannerUiState).not.toContain("getSectionOpen");
    expect(plannerUiState).not.toContain("setSectionOpenInStorage");
    expect(plannerUiState).not.toContain("sections");
  });

  it("ignores generated binaries and does not keep the unused legacy map asset", () => {
    expect(existsSync("public/map.png")).toBe(false);
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toContain("native/build");
    expect(gitignore).toContain("webots/controllers/youbot_web/*.exe");
  });

  it("ignores generated Webots UI metadata and runtime camera frames", () => {
    expect(existsSync("webots/worlds/.youbot_only.jpg")).toBe(false);

    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toContain("web_state/*.jpg");
    expect(gitignore).toContain("webots/worlds/.*.wbproj");
  });

  it("does not keep temporary implementation plan artifacts", () => {
    const artifacts = existsSync("docs/superpowers")
      ? readdirSync("docs/superpowers", { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
      : [];
    expect(artifacts).toHaveLength(0);
  });

  it("does not keep obsolete architecture and refactoring artifacts", () => {
    expect(existsSync("PROJECT_MODULARITY.drawio")).toBe(false);
    expect(existsSync("PROJECT_MODULARITY.png")).toBe(false);
    expect(existsSync("PROJECT_SCHEME.md")).toBe(false);
    expect(existsSync("REFACTORING_PLAN.md")).toBe(false);
    expect(existsSync("LIDAR_FLOWCHART.md")).toBe(false);
  });

  it("does not keep Vite starter styles and branding", () => {
    expect(existsSync("src/App.css")).toBe(false);
    expect(existsSync("src/assets")).toBe(false);
    expect(existsSync("public/vite.svg")).toBe(false);

    const indexHtml = readFileSync("index.html", "utf8");
    expect(indexHtml).toContain('<html lang="ru">');
    expect(indexHtml).toContain("<title>GPO — планировщик маршрута</title>");
    expect(indexHtml).not.toContain("vite.svg");
  });

  it("loads the dashboard lazily and leaves spreadsheet parsing to the server", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    const plannerFileImport = readFileSync(
      "src/features/planner/services/plannerFileImport.js",
      "utf8"
    );

    expect(app).toContain('lazy(() => import("./pages/Dashboard"))');
    expect(plannerFileImport).not.toContain("xlsx");
    expect(plannerFileImport).toContain("IMPORT_GRAPH_URL");
  });
});
