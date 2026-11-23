import { fork, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createRouteCommand } from "../shared/contracts/index.js";

const root = path.resolve(import.meta.dirname, "..");
const directory = await mkdtemp(path.join(os.tmpdir(), "gpo-docker-"));
const project = `gpo-test-${Date.now()}`;
const physics = process.argv.includes("--physics");
const freePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const selected = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return selected;
};
const [frontendPort, telemetryPort, routePort, planningPort, gatewayPort, lockPort] =
  await Promise.all(Array.from({ length: 6 }, freePort));
const env = {
  ...process.env,
  STACK_PROJECT: project,
  STACK_WEB_STATE_DIR: path.join(directory, "state"),
  STACK_TOKEN_FILE: path.join(directory, "token"),
  STACK_FRONTEND_PORT: String(frontendPort),
  STACK_TELEMETRY_PORT: String(telemetryPort),
  STACK_ROUTE_PORT: String(routePort),
  STACK_PLANNING_PORT: String(planningPort),
  STACK_GATEWAY_PORT: String(gatewayPort),
  STACK_LOCK_PORT: String(lockPort),
};
let launcher, socket, telemetry;
let logs = "";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition, label, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await condition()) return; await delay(250); }
  throw new Error(`Timeout: ${label}`);
}
const compose = (...args) => new Promise((resolve, reject) => {
  const child = spawn("docker", ["compose", "-p", project, ...args], { cwd: root, env, windowsHide: true, stdio: "inherit" });
  child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Compose exited ${code}`)));
});
const mission = async id => (await fetch(`http://127.0.0.1:${routePort}/api/missions/${id}`)).json();
const send = command => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off("message", receive); reject(new Error("ACK timeout")); }, 15000);
  const receive = data => { const ack = JSON.parse(data); if (ack.requestId === command.requestId) { clearTimeout(timer); socket.off("message", receive); resolve(ack); } };
  socket.on("message", receive); socket.send(JSON.stringify(command));
});
try {
  launcher = fork(path.join(root, "scripts/start-stack.mjs"), [physics ? "--headless" : "--no-webots", ...(process.argv.includes("--no-build") ? ["--no-build"] : [])], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  launcher.stdout.on("data", data => { logs = (logs + data).slice(-30000); });
  launcher.stderr.on("data", data => { logs = (logs + data).slice(-30000); });
  let ready = false; launcher.on("message", value => { if (value.type === "ready") { ready = true; env.STACK_COMPOSE_TOKEN_FILE = value.tokenMountFile; } });
  await until(() => { if (launcher.exitCode !== null) throw new Error(logs); return ready; }, "launcher readiness", 900000);
  const duplicate = fork(path.join(root, "scripts/start-stack.mjs"), ["--no-webots", "--no-build"], { cwd: root, env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const [duplicateCode] = await once(duplicate, "exit");
  assert.equal(duplicateCode, 1, "A duplicate launcher must refuse to own the running stack");
  assert.equal((await fetch(`http://127.0.0.1:${frontendPort}/health`)).status, 200);
  assert.match(await (await fetch(`http://127.0.0.1:${frontendPort}/dashboard`)).text(), /<div id="root">/);
  const scene = { polygons: [], surfaceZones: [], chargingStations: [], motion: { cruiseSpeedMps: 0.22, payloadKg: 0, batteryRange: 100 } };
  const plan = await (await fetch(`http://127.0.0.1:${planningPort}/api/solve-route`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], scene, task: "tsp" }) })).json();
  assert.equal(plan.ok, true, JSON.stringify(plan));
  socket = new WebSocket(`ws://127.0.0.1:${routePort}/ui`); await once(socket, "open");
  const command = createRouteCommand({ source: "docker-test", requestId: "docker-complete", payload: { type: "route", route: plan.route, seedRoute: plan.seedRoute, scene } });
  assert.equal((await send(command)).ok, true);
  const stateFile = path.join(directory, "state/robot_state.json");
  if (!physics) await writeFile(stateFile, JSON.stringify({ pose: { x: 0, y: 0, z: 0, yaw: 0 }, navigation: { missionId: "docker-complete", finished: true } }));
  await until(async () => (await mission("docker-complete")).status === "completed", "mission completion");
  const routeBefore = await readFile(path.join(directory, "state/route.csv"), "utf8");
  socket.terminate(); socket = null;
  await compose("kill", "-s", "SIGKILL", "route");
  await compose("start", "route");
  await until(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${routePort}/ready`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      return false;
    }
  }, "route restart", 90000);
  assert.equal((await mission("docker-complete")).status, "completed");
  socket = new WebSocket(`ws://127.0.0.1:${routePort}/ui`); await once(socket, "open");
  assert.equal((await send(command)).ok, true);
  assert.equal(await readFile(path.join(directory, "state/route.csv"), "utf8"), routeBefore);
  assert.equal((await send(createRouteCommand({ source: "docker-test", requestId: "docker-cancel", payload: { type: "route", route: [{ x: 0, y: 0 }, { x: 18, y: 0 }], scene } }))).ok, true);
  if (physics) await until(async () => (await mission("docker-cancel")).status === "running", "robot movement");
  assert.equal((await fetch(`http://127.0.0.1:${routePort}/api/missions/docker-cancel/cancel`, { method: "POST" })).status, 202);
  if (!physics) await writeFile(stateFile, JSON.stringify({ pose: { x: 0, y: 0, z: 0, yaw: 0 }, navigation: { missionId: "docker-cancel", status: "mission_cancelled" } }));
  await until(async () => (await mission("docker-cancel")).status === "cancelled", "mission cancellation");
  if (physics) {
    const first = JSON.parse(await readFile(stateFile, "utf8")); await delay(1000);
    const last = JSON.parse(await readFile(stateFile, "utf8"));
    assert.ok(Math.hypot(last.pose.x - first.pose.x, last.pose.y - first.pose.y) < 0.05);
  }
  telemetry = new WebSocket(`ws://127.0.0.1:${telemetryPort}`);
  let observed = false;
  telemetry.on("message", data => { const event = JSON.parse(data); if (event.type === "telemetry.event" && event.payload?.pose) observed = true; });
  await once(telemetry, "open");
  if (!physics) await writeFile(stateFile, JSON.stringify({ pose: { x: 3.25, y: 0, z: 0, yaw: 0 }, navigation: { missionId: "docker-cancel", status: "mission_cancelled", finished: true } }));
  await until(() => observed, "telemetry websocket", 15000);
  console.log(`Docker smoke passed: frontend, native planning, mission completion, crash recovery, idempotency, cancellation, telemetry. Physics=${physics}`);
} catch (error) { console.error(logs); throw error; }
finally {
  socket?.terminate(); telemetry?.terminate();
  if (launcher?.connected) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 45000);
      launcher.once("exit", () => { clearTimeout(timer); resolve(); });
      launcher.send("shutdown");
    });
    if (launcher.exitCode === null) launcher.kill();
  }
  // Only this test's uniquely named Compose project and its disposable volume.
  await compose("down", "-v", "--timeout", "15");
  await mkdir(path.join(root, "output"), { recursive: true });
  await writeFile(path.join(root, "output/docker-smoke.log"), logs);
  await rm(directory, { recursive: true, force: true });
}
