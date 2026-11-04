import { spawn, fork } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, readFile, stat, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import config from "../bridge/config/runtime-config.cjs";
import { ensureToken, parseOptions, stageToken } from "./stack-config.mjs";

const root = path.resolve(import.meta.dirname, "..");
const options = parseOptions(process.argv.slice(2));
const project = process.env.STACK_PROJECT || "gpo-stack";
const tokenFile = path.resolve(root, process.env.STACK_TOKEN_FILE || "secrets/gateway-token");
const stateDir = path.resolve(root, process.env.STACK_WEB_STATE_DIR || config.WEB_STATE_DIR);
const stackPorts = {
  frontend: Number(process.env.STACK_FRONTEND_PORT || 8080),
  telemetry: Number(process.env.STACK_TELEMETRY_PORT || 9001),
  route: Number(process.env.STACK_ROUTE_PORT || 9002),
  planning: Number(process.env.STACK_PLANNING_PORT || 9003),
  gateway: Number(process.env.STACK_GATEWAY_PORT || 9004),
  lock: Number(process.env.STACK_LOCK_PORT || 9005),
};
const env = {
  ...process.env,
  STACK_TOKEN_FILE: tokenFile,
  STACK_GATEWAY_URL: `http://host.docker.internal:${stackPorts.gateway}`,
};
const children = [];
const launcherLock = createServer();
let gateway, simulator, currentCommand, finish, secretMount, interrupted = false, composeOwned = false, stopping = false;
const requestStop = () => { if (interrupted) return; interrupted = true; currentCommand?.kill(); finish?.(); };
process.on("SIGINT", requestStop);
process.on("SIGTERM", requestStop);
process.on("message", message => { if (message === "shutdown") requestStop(); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = (file, args, capture = false) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { cwd: root, env, windowsHide: true, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
  currentCommand = child;
  let output = "";
  child.stdout?.on("data", data => { output += data; });
  child.stderr?.on("data", data => { output += data; });
  child.on("error", reject);
  child.on("exit", code => { currentCommand = null; code === 0 ? resolve(output) : reject(new Error(`${file} failed (${code})${capture ? ": " + output : ""}`)); });
});
const compose = (...args) => run("docker", ["compose", "-p", project, ...args]);
async function waitFor(condition, label, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (interrupted) throw new Error("Startup interrupted");
    if (children.some(child => child.exitCode !== null || child.signalCode)) throw new Error(`Process exited while waiting for ${label}`);
    if (await condition()) return;
    await delay(250);
  }
  throw new Error(`Timeout: ${label}`);
}
async function stop() {
  if (stopping) return;
  stopping = true;
  // Stop the simulator first: shutting down a service alone does not stop motion.
  if (simulator?.pid && simulator.exitCode === null && !simulator.signalCode) {
    if (process.platform === "win32") await run("taskkill", ["/PID", String(simulator.pid), "/T", "/F"]).catch(() => {});
    else simulator.kill();
  }
  if (composeOwned) await compose("down", "--timeout", "15").catch(error => { console.error(error.message); process.exitCode = 1; });
  if (gateway?.connected) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 12000);
      gateway.once("exit", () => { clearTimeout(timer); resolve(); });
      gateway.send("shutdown");
    });
    if (gateway.exitCode === null) gateway.kill();
  }
}
try {
  if (options.webots && process.platform !== "win32") throw new Error("The graphical launcher requires Windows; use --no-webots for service testing.");
  // The OS releases this lock after crashes; no stale PID file can block recovery.
  launcherLock.listen(stackPorts.lock, "127.0.0.1");
  await once(launcherLock, "listening");
  const token = await ensureToken(tokenFile);
  secretMount = await stageToken(token);
  env.STACK_COMPOSE_TOKEN_FILE = secretMount.file;
  await run("docker", ["info"], true);
  const existing = await run("docker", ["compose", "-p", project, "ps", "--all", "--quiet"], true);
  if (existing.trim()) throw new Error(`Compose project ${project} already exists. Stop its launcher or run docker compose -p ${project} down first (without -v).`);
  for (const port of [stackPorts.frontend, stackPorts.telemetry, stackPorts.route, stackPorts.planning, stackPorts.gateway]) {
    const server = createServer();
    server.listen(port, "0.0.0.0");
    await once(server, "listening");
    await new Promise(resolve => server.close(resolve));
  }
  const webotsHome = process.env.WEBOTS_HOME || "C:/Program Files/Webots";
  const executable = path.join(webotsHome, "msys64/mingw64/bin/webots.exe");
  if (options.webots) {
    await access(executable);
    env.WEBOTS_HOME = webotsHome;
    if (options.build) await run(process.env.ComSpec || "cmd.exe", ["/d", "/c", "webots\\controllers\\youbot_web\\build_youbot_web.bat"]);
    await access(path.join(root, "webots/controllers/youbot_web/youbot_web.exe"));
  }
  await mkdir(stateDir, { recursive: true });
  gateway = fork(path.join(root, "scripts/gateway-child.cjs"), [], {
    cwd: root, windowsHide: true,
    env: { ...env, GATEWAY_BIND_HOST: "0.0.0.0", GATEWAY_PORT: String(stackPorts.gateway), GATEWAY_TOKEN: "", GATEWAY_TOKEN_FILE: tokenFile, WEB_STATE_DIR: stateDir, LOG_DIR: "" },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  children.push(gateway);
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${stackPorts.gateway}/ready`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1000) })).ok; }
    catch { return false; }
  }, "gateway", 15000);
  if (options.build) await compose("build");
  if (interrupted) throw new Error("Startup interrupted");
  composeOwned = true;
  await compose("up", "-d", "--wait", "--wait-timeout", "120");
  if (options.webots) {
    const runtimeProject = path.join(stateDir, "runtime-project");
    const world = path.join(runtimeProject, "worlds/youbot_only.wbt");
    await mkdir(path.join(runtimeProject, "worlds"), { recursive: true });
    await mkdir(path.join(runtimeProject, "controllers/youbot_web"), { recursive: true });
    await copyFile(path.join(root, "webots/worlds/youbot_only.wbt"), world);
    await copyFile(path.join(root, "webots/controllers/youbot_web/youbot_web.exe"), path.join(runtimeProject, "controllers/youbot_web/youbot_web.exe"));
    const args = ["--stdout", "--stderr", ...(options.headless ? ["--batch", "--minimize", "--no-rendering", "--mode=fast"] : ["--mode=realtime"]), world];
    const startedAt = Date.now();
    simulator = spawn(executable, args, { cwd: root, env: { ...env, WEB_STATE_DIR: stateDir }, windowsHide: options.headless, stdio: "ignore" });
    children.push(simulator);
    simulator.on("error", error => { console.error(error.message); });
    await waitFor(async () => {
      try {
        const filename = path.join(stateDir, "robot_state.json");
        return (await stat(filename)).mtimeMs >= startedAt && Boolean(JSON.parse(await readFile(filename, "utf8")).pose);
      } catch { return false; }
    }, "Webots telemetry");
  }
  console.log(`Stack ready: http://127.0.0.1:${stackPorts.frontend} — press Ctrl+C to stop. Mission volume is preserved.`);
  await new Promise(resolve => {
    finish = resolve;
    if (interrupted) resolve();
    if (process.send) process.send({ type: "ready", tokenMountFile: secretMount.file });
    for (const child of children) child.once("exit", () => { if (!stopping) { process.exitCode = 1; resolve(); } });
  });
} catch (error) {
  console.error(error.message); process.exitCode = 1;
  if (composeOwned) await compose("logs", "--tail", "40").catch(() => {});
}
finally {
  await stop();
  if (secretMount) await rm(secretMount.directory, { recursive: true, force: true });
  if (launcherLock.listening) await new Promise(resolve => launcherLock.close(resolve));
  if (process.connected) process.disconnect();
}
