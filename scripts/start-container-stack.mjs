import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const project = process.env.STACK_PROJECT || "gpo-full";
const args = process.argv.slice(2);
const allowed = new Set(["--no-build", "--cpu", "--gpu"]);
for (const arg of args) {
  if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
}
if (args.includes("--cpu") && args.includes("--gpu")) {
  throw new Error("Use either --cpu or --gpu, not both.");
}

const baseFiles = ["-f", "compose.yaml", "-f", "compose.simulator.yaml"];
const gpuFiles = ["-f", "compose.simulator.gpu-wslg.yaml"];
const run = (commandArgs, { capture = false, env = process.env } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", commandArgs, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    child.stdout?.on("data", data => { output += data; });
    child.stderr?.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("exit", code => resolve({ code, output }));
  });

const compose = (...composeArgs) =>
  run(["compose", "-p", project, ...baseFiles, ...composeArgs]);

async function wslgGpuAvailable() {
  const x11Path = process.env.WSLG_X11_PATH || "/mnt/host/wslg/.X11-unix";
  const wslLibPath = process.env.WSL_LIB_PATH || "/usr/lib/wsl";
  const probe = await run([
    "run",
    "--rm",
    "--device", "/dev/dxg:/dev/dxg",
    "--mount", `type=bind,source=${x11Path},target=/probe-x11,readonly`,
    "--mount", `type=bind,source=${wslLibPath},target=/probe-wsl,readonly`,
    "--entrypoint", "node",
    "gpo-service:local",
    "-e",
    "const f=require('fs');process.exit(f.existsSync('/dev/dxg')&&f.existsSync('/probe-x11')&&f.existsSync('/probe-wsl/lib')?0:1)",
  ], { capture: true });
  return probe.code === 0;
}

if (!args.includes("--no-build")) {
  const built = await compose("build");
  if (built.code !== 0) process.exit(built.code || 1);
}

const gpuAvailable = args.includes("--cpu") ? false : await wslgGpuAvailable();
if (args.includes("--gpu") && !gpuAvailable) {
  throw new Error("GPU mode requested, but Docker cannot access WSLg /dev/dxg and its graphics mounts.");
}
const useGpu = !args.includes("--cpu") && gpuAvailable;

const renderer = useGpu ? (args.includes("--gpu") ? "gpu" : "auto") : "cpu";
console.log(useGpu
  ? "GPU доступен: запускаю Webots с аппаратным OpenGL (с автоматическим откатом на CPU)."
  : "Совместимый GPU/WSLg не найден: запускаю Webots на CPU.");
const started = await run([
  "compose",
  "-p", project,
  ...baseFiles,
  ...(useGpu ? gpuFiles : []),
  "up", "-d", "--wait", "--wait-timeout", "180",
], { env: { ...process.env, WEBOTS_RENDERER: renderer } });
if (started.code !== 0) process.exit(started.code || 1);
console.log("Стек готов: http://127.0.0.1:8080/dashboard");
