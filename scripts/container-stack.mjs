const baseFiles = ["-f", "compose.yaml", "-f", "compose.simulator.yaml"];
const gpuFiles = ["-f", "compose.simulator.gpu-wslg.yaml"];

export async function runContainerStack({
  run,
  args = [],
  env = process.env,
  revision = "unknown",
  log = console.log,
}) {
  const allowed = new Set(["--no-build", "--cpu", "--gpu"]);
  for (const arg of args) {
    if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
  }
  if (args.includes("--cpu") && args.includes("--gpu")) {
    throw new Error("Use either --cpu or --gpu, not both.");
  }
  const engine = await run(["info", "--format", "{{.ServerVersion}}"], { capture: true, timeoutMs: 15000 });
  if (engine.code !== 0) {
    throw new Error(`Docker Engine недоступен. Запустите Docker Desktop (Linux Engine) и повторите запуск.\n${engine.output}`);
  }
  const project = env.STACK_PROJECT || "gpo-full";
  const buildEnv = { ...env, GPO_SOURCE_REVISION: env.GPO_SOURCE_REVISION || revision };
  const compose = (files, ...command) => run([
    "compose", "-p", project, ...files, ...command,
  ], { env: buildEnv });
  if (!args.includes("--no-build")) {
    log(`Сборка актуальных исходников: ${buildEnv.GPO_SOURCE_REVISION}`);
    const built = await compose(baseFiles, "build");
    if (built.code !== 0) throw new Error("Docker image build failed; existing containers and volumes were preserved.");
  }
  let gpuAvailable = false;
  if (!args.includes("--cpu")) {
    const x11Path = env.WSLG_X11_PATH || "/mnt/host/wslg/.X11-unix";
    const wslLibPath = env.WSL_LIB_PATH || "/usr/lib/wsl";
    const probe = await run([
      "run", "--rm", "--device", "/dev/dxg:/dev/dxg",
      "--mount", `type=bind,source=${x11Path},target=/probe-x11,readonly`,
      "--mount", `type=bind,source=${wslLibPath},target=/probe-wsl,readonly`,
      "--entrypoint", "node", "gpo-service:local", "-e",
      "const f=require('fs');process.exit(f.existsSync('/dev/dxg')&&f.existsSync('/probe-x11')&&f.existsSync('/probe-wsl/lib')?0:1)",
    ], { capture: true, timeoutMs: 30000 });
    gpuAvailable = probe.code === 0;
    if (args.includes("--gpu") && !gpuAvailable) {
      throw new Error(`GPU requested, but Docker cannot access WSLg /dev/dxg and graphics mounts.\n${probe.output}`);
    }
  }
  const files = [...baseFiles, ...(gpuAvailable ? gpuFiles : [])];
  const renderer = gpuAvailable ? (args.includes("--gpu") ? "gpu" : "auto") : "cpu";
  const runtimeEnv = { ...buildEnv, WEBOTS_RENDERER: renderer };
  if (renderer === "gpu") log("GPU запрошен явно: Webots проверит аппаратный OpenGL и завершится с ошибкой, если он недоступен.");
  else if (args.includes("--cpu")) log("Запускаю Webots на CPU: выбран параметр --cpu.");
  else log(gpuAvailable
    ? "WSLg доступен: проверяю аппаратный OpenGL при старте Webots; при неудаче использую CPU."
    : "Совместимый GPU/WSLg не найден: запускаю Webots на CPU.");
  const started = await run([
    "compose", "-p", project, ...files,
    "up", "-d", "--wait", "--wait-timeout", "180",
  ], { env: runtimeEnv });
  if (started.code !== 0) {
    await run(["compose", "-p", project, ...files, "ps", "--all"], { env: runtimeEnv });
    await run(["compose", "-p", project, ...files, "logs", "--tail", "60"], { env: runtimeEnv });
    throw new Error("Container startup failed. See service status and logs above; volumes were preserved.");
  }
  log("Стек готов: http://127.0.0.1:8080/dashboard");
}
