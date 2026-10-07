// Runs the production controller in an isolated real Webots physics world.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, cp, copyFile, readFile, writeFile, rename, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const directory = await mkdtemp(path.join(os.tmpdir(), "gpo-manipulator-"));
const containerMode = process.env.MANIPULATOR_SMOKE_CONTAINER === "1";
const containerName = path.basename(directory).toLowerCase();
const stateDirectory = path.join(directory, "state");
const timeout = Number(process.env.MANIPULATOR_SMOKE_TIMEOUT_MS || 180000);
const staticZone = process.env.MANIPULATOR_SMOKE_STATIC_ZONE === "1";
const destination = {
  x: Number(process.env.MANIPULATOR_SMOKE_DESTINATION_X ?? (staticZone ? 4.6 : 2.0)),
  y: Number(process.env.MANIPULATOR_SMOKE_DESTINATION_Y ?? (staticZone ? 0.9 : 0.6)),
};
const mode = process.env.MANIPULATOR_SMOKE_MODE || "fast";
const cancelStage = process.env.MANIPULATOR_SMOKE_CANCEL_STAGE || "";
assert.ok(["fast", "realtime"].includes(mode), "Unsupported Webots mode");
assert.ok(["", "transporting", "grasping"].includes(cancelStage), "Unsupported cancellation stage");
assert.ok(Number.isFinite(destination.x) && Number.isFinite(destination.y), "Invalid destination");
const scenario = process.env.MANIPULATOR_SMOKE_RESULT_SUFFIX
  || (staticZone ? "static-zone" : cancelStage ? `cancel-${cancelStage}-${mode}` : mode === "realtime" ? "realtime"
    : process.env.MANIPULATOR_SMOKE_DESTINATION_X || process.env.MANIPULATOR_SMOKE_DESTINATION_Y ? "alternative-destination" : "");
assert.ok(/^[a-zA-Z0-9_-]*$/.test(scenario), "Invalid result suffix");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let simulator;
let launchError;
let logs = "";
let firstState;
let lastState;
let maxJointMotion = 0;
let maxObjectHeight = -Infinity;
let cancelled = false;
let maxTransportWaypoints = 0;
const samples = [];
const readState = async () => {
  try { return JSON.parse(await readFile(path.join(stateDirectory, "robot_state.json"), "utf8")); }
  catch { return null; }
};
const until = async (condition, label) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (simulator.exitCode !== null) throw new Error(`Webots exited (${simulator.exitCode}): ${logs.slice(-8000)}`);
    if (await condition()) return;
    await delay(75);
  }
  throw new Error(`Timeout: ${label}; last state ${JSON.stringify(lastState?.objectTransfer)}`);
};
const report = async (ok, error) => {
  await mkdir(path.join(root, "output"), { recursive: true });
  await writeFile(path.join(root, `output/manipulator-smoke-result${scenario ? `-${scenario}` : ""}.json`), JSON.stringify({
    ok, error, mode, cancelStage, cancelled, staticZone, maxTransportWaypoints, maxJointMotion, maxObjectHeight: Number.isFinite(maxObjectHeight) ? maxObjectHeight : null,
    initialObjectPose: firstState?.objectTransfer?.objectPose,
    finalObjectPose: lastState?.objectTransfer?.objectPose,
    destination, samples, lastState, logs: logs.slice(-12000),
  }, null, 2));
};
try {
  for (const name of ["worlds", "controllers/youbot_web", "state"]) {
    await mkdir(path.join(directory, name), { recursive: true });
  }
  if (staticZone) {
    // The controller creates physical boundary walls from this zone file.
    await writeFile(path.join(stateDirectory, "limit_zones.txt"), "zone_count 1\nzone 4\n2.8 0.3\n3.1 0.3\n3.1 0.6\n2.8 0.6\n");
  }
  await cp(path.join(root, "webots/protos"), path.join(directory, "protos"), { recursive: true });
  await copyFile(path.join(root, "webots/worlds/youbot_only.wbt"), path.join(directory, "worlds/test.wbt"));
  const binary = process.platform === "win32" ? "youbot_web.exe" : "youbot_web";
  if (!containerMode) await copyFile(path.join(root, "webots/controllers/youbot_web", binary), path.join(directory, "controllers/youbot_web", binary));
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const webotsHome = process.env.WEBOTS_HOME || (process.platform === "win32" ? "C:/Program Files/Webots" : "/usr/local/webots");
  const executable = process.env.WEBOTS_EXECUTABLE || (process.platform === "win32"
    ? path.join(webotsHome, "msys64/mingw64/bin/webots.exe") : path.join(webotsHome, "webots"));
  const command = containerMode ? "docker" : executable;
  const args = containerMode
    ? ["run", "--rm", "--init", "--network", "none", "--shm-size", "256m", "--name", containerName, "--mount", `type=bind,source=${stateDirectory},target=/data/webots`, "--env", `WEBOTS_MODE=${mode}`, "--env", "WEBOTS_RENDERER=cpu", "gpo-webots:local"]
    : ["--batch", "--minimize", "--no-rendering", `--mode=${mode}`, "--stdout", "--stderr", `--port=${port}`, path.join(directory, "worlds/test.wbt")];
  simulator = spawn(command, args, {
    cwd: root, env: { ...process.env, WEB_STATE_DIR: stateDirectory }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  simulator.stdout.on("data", chunk => { logs += chunk; });
  simulator.stderr.on("data", chunk => { logs += chunk; });
  simulator.on("error", error => { launchError = error; logs += String(error); });
  await until(async () => {
    lastState = await readState();
    const transfer = lastState?.objectTransfer;
    if (!transfer?.controllerBootId || !transfer?.objectPose || !transfer?.manipulator?.jointPositions || !transfer.manipulator.sensorValidity) return false;
    if (staticZone && !(lastState.dynamicZones?.count >= 1 && lastState.dynamicZones?.wallCount >= 4)) return false;
    firstState = lastState;
    return true;
  }, "controller boot and physical sensor telemetry");
  const missionId = "physical-manipulator-smoke";
  const temporaryCommand = path.join(stateDirectory, "runtime_command.tmp");
  await writeFile(temporaryCommand, `id ${Date.now()}\ntype transfer_object\nmission_id ${missionId}\nobject_id demo-box\ndestination_x ${destination.x}\ndestination_y ${destination.y}\n`);
  await rename(temporaryCommand, path.join(stateDirectory, "runtime_command.txt"));
  await until(async () => {
    const state = await readState();
    if (!state) return false;
    lastState = state;
    const transfer = state.objectTransfer;
    if (transfer?.missionId !== missionId) return false;
    const joints = transfer.manipulator?.jointPositions || [];
    joints.forEach((joint, index) => {
      maxJointMotion = Math.max(maxJointMotion, Math.abs(joint - firstState.objectTransfer.manipulator.jointPositions[index]));
    });
    maxObjectHeight = Math.max(maxObjectHeight, transfer.objectPose?.z ?? -Infinity);
    if (transfer.stage === "transporting") {
      maxTransportWaypoints = Math.max(maxTransportWaypoints, state.route?.waypoints?.length || 0);
    }
    if (samples.at(-1)?.stage !== transfer.stage || samples.length === 0) {
      samples.push({ time: state.simulationTime, stage: transfer.stage, status: transfer.status,
        joints, tcpPose: transfer.manipulator?.tcpPose, objectPose: transfer.objectPose,
        gripEvidence: transfer.manipulator?.gripEvidence, releaseEvidence: transfer.manipulator?.releaseEvidence });
      console.log(`${transfer.stage}: ${JSON.stringify(transfer.objectPose)}`);
    }
    if (cancelStage && !cancelled && transfer.stage === cancelStage && transfer.status === "running") {
      await writeFile(temporaryCommand, `id ${Date.now()}\ntype cancel_mission\nmission_id ${missionId}\n`);
      await rename(temporaryCommand, path.join(stateDirectory, "runtime_command.txt"));
      cancelled = true;
      console.log(`Cancellation requested during ${cancelStage}.`);
    }
    if (["failed", "holding_for_recovery"].includes(transfer.status)) {
      throw new Error(`Physical transfer stopped: ${JSON.stringify(transfer)}`);
    }
    return transfer.status === (cancelStage ? "cancelled" : "completed");
  }, "physical grasp, lift, transport and release");
  assert.ok(maxJointMotion > 0.2, `No meaningful measured arm motion: ${maxJointMotion}`);
  if (!cancelStage || cancelStage === "transporting") {
    assert.ok(maxObjectHeight > firstState.objectTransfer.objectPose.z + 0.04, `No measured physical lift: ${maxObjectHeight}`);
    assert.ok(samples.some(sample => sample.gripEvidence && sample.stage === "transporting"), "No measured grip during transport");
  }
  if (!cancelStage || samples.some(sample => sample.gripEvidence)) {
    assert.equal(lastState.objectTransfer.manipulator.releaseEvidence, true, "No verified physical release");
  }
  assert.equal(lastState.objectTransfer.attached, false, "Object remains attached after completion");
  const finalPose = lastState.objectTransfer.objectPose;
  if (cancelStage) {
    assert.equal(cancelled, true, "Cancellation was never published");
    assert.ok(Math.abs(finalPose.z - firstState.objectTransfer.objectPose.z) < 0.015, "Cancelled object was not placed on the floor");
    await delay(1200);
    const settled = await readState();
    assert.ok(settled, "Missing post-cancellation telemetry");
    assert.equal(settled.objectTransfer.status, "cancelled");
    const settledPose = settled.objectTransfer.objectPose;
    assert.ok(Math.hypot(settledPose.x - finalPose.x, settledPose.y - finalPose.y, settledPose.z - finalPose.z) < 0.01, "Cancelled object kept moving");
    lastState = settled;
  } else {
    if (staticZone) assert.ok(maxTransportWaypoints > 1, "Static zone did not produce a transport detour");
    assert.ok(Math.hypot(finalPose.x - destination.x, finalPose.y - destination.y) < 0.2, `Object missed destination: ${JSON.stringify(finalPose)}`);
  }
  await report(true);
  console.log(`Physical manipulation ${cancelStage ? "cancelled safely" : "completed"}; arm motion ${maxJointMotion.toFixed(3)} rad; maximum object z ${maxObjectHeight.toFixed(3)} m.`);
} catch (error) {
  await report(false, String(error));
  console.error(logs.slice(-8000));
  throw error;
} finally {
  if (containerMode && simulator?.pid) {
    const cleanup = spawn("docker", ["rm", "--force", containerName], { windowsHide: true, stdio: "ignore" });
    await once(cleanup, "exit");
  }
  if (simulator?.pid && simulator.exitCode === null) {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(simulator.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      await once(killer, "exit");
    } else {
      simulator.kill("SIGTERM");
      await once(simulator, "exit");
    }
  }
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith("gpo-manipulator-"));
  await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
