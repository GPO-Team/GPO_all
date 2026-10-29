// Runs the production controller in an isolated real Webots physics world.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, cp, copyFile, readFile, writeFile, rename, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const attempts = Number(process.env.MANIPULATOR_SMOKE_ATTEMPTS || 1);
assert.ok(Number.isInteger(attempts) && attempts >= 1 && attempts <= 100, "Invalid attempt count");
if (attempts > 1) {
  assert.ok(!process.env.MANIPULATOR_SMOKE_CANCEL_STAGE && process.env.MANIPULATOR_SMOKE_MISSING_GRIP !== "1" &&
    process.env.MANIPULATOR_SMOKE_RECOVER !== "1", "Repeated full cycles cannot use cancellation, missing-grip or recovery modes");
  const results = [];
  const batch = Date.now();
  for (let index = 1; index <= attempts; ++index) {
    const suffix = `repeat-${batch}-${index}`;
    const child = spawn(process.execPath, [import.meta.filename], {
      cwd: root, windowsHide: true, stdio: "inherit",
      env: { ...process.env, MANIPULATOR_SMOKE_ATTEMPTS: "1", MANIPULATOR_SMOKE_RESULT_SUFFIX: suffix },
    });
    const [code] = await once(child, "exit");
    const result = JSON.parse(await readFile(path.join(root, `output/manipulator-smoke-result-${suffix}.json`), "utf8"));
    const final = result.lastState?.objectTransfer;
    const completed = final?.status === "completed" && final.attached === false && final.onPlatform === false &&
      final.manipulator?.releaseEvidence === true;
    results.push({ attempt: index, exitCode: code, ok: code === 0 && result.ok === true && completed,
      error: result.error, report: `manipulator-smoke-result-${suffix}.json` });
  }
  await writeFile(path.join(root, "output/manipulator-repeat-summary.json"), JSON.stringify({ attempts, successes: results.filter(result => result.ok).length, results }, null, 2));
  assert.ok(results.every(result => result.ok), `${results.filter(result => result.ok).length}/${attempts} physical attempts passed`);
  process.exit(0);
}
const directory = await mkdtemp(path.join(os.tmpdir(), "gpo-manipulator-"));
const containerMode = process.env.MANIPULATOR_SMOKE_CONTAINER === "1";
const gpu = process.env.SIMULATOR_GPU === "1";
const containerName = path.basename(directory).toLowerCase();
const stateDirectory = path.join(directory, "state");
const timeout = Number(process.env.MANIPULATOR_SMOKE_TIMEOUT_MS || 180000);
const staticZone = process.env.MANIPULATOR_SMOKE_STATIC_ZONE === "1";
const destination = {
  x: Number(process.env.MANIPULATOR_SMOKE_DESTINATION_X ?? (staticZone ? 4.6 : 2.0)),
  y: Number(process.env.MANIPULATOR_SMOKE_DESTINATION_Y ?? (staticZone ? 0.9 : 0.6)),
};
const mode = process.env.MANIPULATOR_SMOKE_MODE || "fast";
const startPose = process.env.MANIPULATOR_SMOKE_START_POSE
  ? process.env.MANIPULATOR_SMOKE_START_POSE.split(",").map(Number) : null;
assert.ok(!startPose || (startPose.length === 3 && startPose.every(Number.isFinite)), "Invalid start pose");
const repeat = process.env.MANIPULATOR_SMOKE_REPEAT_DESTINATION
  ? process.env.MANIPULATOR_SMOKE_REPEAT_DESTINATION.split(",").map(Number) : null;
assert.ok(!repeat || (repeat.length === 2 && repeat.every(Number.isFinite)), "Invalid repeat destination");
const cancelStage = process.env.MANIPULATOR_SMOKE_CANCEL_STAGE || "";
const recover = process.env.MANIPULATOR_SMOKE_RECOVER === "1";
const missingGrip = process.env.MANIPULATOR_SMOKE_MISSING_GRIP === "1";
assert.ok(!missingGrip || (!repeat && !recover && !cancelStage), "Missing grip must be tested separately");
assert.ok(!recover || !cancelStage, "Recovery scenario includes its own safe cancellation");
assert.ok(!repeat || (!recover && !cancelStage), "Repeated transfers require a normal completion scenario");
let recoveryPhase = 0;
let recoveryEpoch = 0;
assert.ok(["fast", "realtime"].includes(mode), "Unsupported Webots mode");
assert.ok(["", "approaching_object", "transporting", "grasping"].includes(cancelStage), "Unsupported cancellation stage");
assert.ok(Number.isFinite(destination.x) && Number.isFinite(destination.y), "Invalid destination");
const scenario = process.env.MANIPULATOR_SMOKE_RESULT_SUFFIX
  || (missingGrip ? "missing-grip" : recover ? "recovery" : staticZone ? "static-zone" : cancelStage ? `cancel-${cancelStage}-${mode}` : mode === "realtime" ? "realtime"
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
let platformOrigin;
let platformTravel = 0;
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
    ok, error, mode, missingGrip, cancelStage, cancelled, staticZone, maxTransportWaypoints, platformTravel, maxJointMotion, maxObjectHeight: Number.isFinite(maxObjectHeight) ? maxObjectHeight : null,
    initialObjectPose: firstState?.objectTransfer?.objectPose,
    finalObjectPose: lastState?.objectTransfer?.objectPose,
    destination, repeat, samples, lastState, logs: logs.slice(-12000),
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
  if (missingGrip) {
    const world = await readFile(path.join(directory, "worlds/test.wbt"), "utf8");
    assert.equal((world.match(/size 0\.025 0\.025 0\.05/g) || []).length, 2, "Demo handle geometry changed");
    await writeFile(path.join(directory, "worlds/test.wbt"), world.replaceAll("size 0.025 0.025 0.05", "size 0.001 0.001 0.001"));
  }
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
    ? ["run", "--rm", "--init", "--network", "none", "--shm-size", "256m", "--name", containerName, "--mount", `type=bind,source=${stateDirectory},target=/data/webots`, "--env", `WEBOTS_MODE=${mode}`,
      ...(gpu ? ["--device", "/dev/dxg:/dev/dxg", "--mount", "type=bind,source=/mnt/host/wslg/.X11-unix,target=/tmp/.X11-unix,readonly", "--mount", "type=bind,source=/usr/lib/wsl,target=/usr/lib/wsl,readonly", "--env", "DISPLAY=:0", "--env", "LD_LIBRARY_PATH=/usr/lib/wsl/lib", "--env", "MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA", "--env", "WEBOTS_RENDERER=gpu"] : ["--env", "WEBOTS_RENDERER=cpu"]), "gpo-webots:local"]
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
  if (startPose) {
    await writeFile(path.join(stateDirectory, "route.csv"),
      `x,y,heading_deg\n# command approach-regression\n${startPose[0]},${startPose[1]},${startPose[2] * 180 / Math.PI}\n`);
    await until(async () => {
      lastState = await readState();
      return lastState?.navigation?.missionId === "approach-regression" && lastState.navigation.finished;
    }, "initial route before pickup");
    firstState = lastState;
    console.log(`Pickup start pose: ${JSON.stringify(firstState.pose)}`);
  }
  const temporaryCommand = path.join(stateDirectory, "runtime_command.tmp");
  const runTransfer = async (target, missionId) => {
    await writeFile(temporaryCommand, `id ${Date.now()}\ntype transfer_object\nmission_id ${missionId}\nobject_id demo-box\ndestination_x ${target.x}\ndestination_y ${target.y}\n`);
    await rename(temporaryCommand, path.join(stateDirectory, "runtime_command.txt"));
    await until(async () => {
      const state = await readState();
      if (!state) return false;
      lastState = state;
      const transfer = state.objectTransfer;
      if (transfer?.missionId !== missionId) return false;
      if (transfer.stage === "transporting") {
        assert.equal(transfer.attached, false, "Cargo must be released on the platform during transport");
        assert.equal(transfer.onPlatform, true, "Cargo must be supported on the platform");
        assert.equal(transfer.manipulator.attachmentEvidence, false, "Platform cargo must be physically unlocked");
        const dx=transfer.objectPose.x-state.pose.x,dy=transfer.objectPose.y-state.pose.y;
        assert.ok(Math.hypot(Math.cos(state.pose.yaw)*dx+Math.sin(state.pose.yaw)*dy+.07,
          -Math.sin(state.pose.yaw)*dx+Math.cos(state.pose.yaw)*dy-.075)<.035,"Cargo slid on the platform");
        assert.ok(Math.abs(transfer.objectPose.z-state.pose.z-.1235)<.015,"Cargo lost platform height");
        platformOrigin ||= state.pose;
        platformTravel=Math.max(platformTravel,Math.hypot(state.pose.x-platformOrigin.x,state.pose.y-platformOrigin.y));
        assert.ok(transfer.objectPose.z > firstState.objectTransfer.objectPose.z + 0.04,
          "Cargo lost its ground clearance during transport");
        assert.ok(transfer.objectUp.z > 0.97, "Cargo tipped during transport");
      }
      const joints = transfer.manipulator?.jointPositions || [];
      joints.forEach((joint, index) => {
        maxJointMotion = Math.max(maxJointMotion, Math.abs(joint - firstState.objectTransfer.manipulator.jointPositions[index]));
      });
      maxObjectHeight = Math.max(maxObjectHeight, transfer.objectPose?.z ?? -Infinity);
      if (transfer.stage === "transporting") {
        maxTransportWaypoints = Math.max(maxTransportWaypoints, state.route?.waypoints?.length || 0);
      }
      if (samples.at(-1)?.stage !== transfer.stage || samples.length === 0) {
        samples.push({ missionId, time: state.simulationTime, stage: transfer.stage, status: transfer.status, basePose: state.pose,
          joints, tcpPose: transfer.manipulator?.tcpPose, objectPose: transfer.objectPose,
          attached: transfer.attached, onPlatform: transfer.onPlatform, objectUp: transfer.objectUp,
          gripEvidence: transfer.manipulator?.gripEvidence, releaseEvidence: transfer.manipulator?.releaseEvidence });
        console.log(`${transfer.stage}: ${JSON.stringify(transfer.objectPose)}`);
      }
      if (cancelStage && !cancelled && transfer.stage === cancelStage && transfer.status === "running") {
        await writeFile(temporaryCommand, `id ${Date.now()}\ntype cancel_mission\nmission_id ${missionId}\n`);
        await rename(temporaryCommand, path.join(stateDirectory, "runtime_command.txt"));
        cancelled = true;
        console.log(`Cancellation requested during ${cancelStage}.`);
      }
      if (recover && recoveryPhase === 0 && transfer.stage === "transporting") {
        // Keep the injected obstacle ahead of the load, outside its collision body.
        await writeFile(temporaryCommand, `id ${Date.now()}\ntype spawn_obstacle\nx ${state.pose.x+0.70}\ny ${state.pose.y}\nsize_x 0.1\nsize_y 0.5\nheight 0.4\n`);
        await rename(temporaryCommand,path.join(stateDirectory,"runtime_command.txt"));
        recoveryPhase=1;
      }
      if (recover && transfer.status === "holding_for_recovery") {
        assert.ok(transfer.attached || transfer.onPlatform,"Held fault lost resource ownership");
        if (recoveryPhase === 1) {
          recoveryEpoch=transfer.recoveryEpoch;
          await writeFile(temporaryCommand,`id ${Date.now()}\ntype resume_transfer\nmission_id ${missionId}\n`);
          await rename(temporaryCommand,path.join(stateDirectory,"runtime_command.txt"));
          recoveryPhase=2;
          console.log("Resume requested for retained cargo.");
        } else if(recoveryPhase === 2 && transfer.recoveryEpoch>recoveryEpoch) {
          await writeFile(temporaryCommand,`id ${Date.now()}\ntype cancel_mission\nmission_id ${missionId}\n`);
          await rename(temporaryCommand,path.join(stateDirectory,"runtime_command.txt"));
          recoveryPhase=3;cancelled=true;
          console.log("Repeated blocked recovery detected; safely lowering cargo.");
        }
        return false;
      }
      if (["failed", "holding_for_recovery"].includes(transfer.status)) {
        if (missingGrip) {
          assert.equal(transfer.errorCode, "grasp_failed");
          assert.equal(transfer.attached, false);
          assert.equal(transfer.onPlatform, false);
          assert.ok(!samples.some(sample => sample.stage === "transporting"), "Drove without a confirmed grasp");
          return true;
        }
        throw new Error(`Physical transfer stopped: ${JSON.stringify(transfer)}`);
      }
      return transfer.status === (cancelStage || recover ? "cancelled" : "completed");
    }, "physical grasp, lift, transport and release");
  };
  await runTransfer(destination, "physical-manipulator-smoke");
  if (!missingGrip) {
  const finalDestination = repeat ? { x: repeat[0], y: repeat[1] } : destination;
  if (repeat) await runTransfer(finalDestination, "physical-manipulator-repeat");
  if (cancelStage !== "approaching_object") assert.ok(maxJointMotion > 0.2, `No meaningful measured arm motion: ${maxJointMotion}`);
  if (!cancelStage || cancelStage === "transporting") {
    assert.ok(maxObjectHeight > firstState.objectTransfer.objectPose.z + 0.04, `No measured physical lift: ${maxObjectHeight}`);
    assert.ok(samples.some(sample => sample.onPlatform && !sample.attached && sample.stage === "transporting"), "No released platform transport");
    if (!cancelStage) assert.ok(samples.some(sample => sample.attached && sample.stage === "lifting_from_platform"), "No physical retrieval from platform");
    if (!cancelStage && !recover) assert.ok(platformTravel>.15,"No measured base travel with released cargo on platform");
  }
  if (!cancelStage || samples.some(sample => sample.gripEvidence)) {
    assert.equal(lastState.objectTransfer.manipulator.releaseEvidence, true, "No verified physical release");
  }
  assert.equal(lastState.objectTransfer.attached, false, "Object remains attached after completion");
  const finalPose = lastState.objectTransfer.objectPose;
  if (cancelStage || recover) {
    if(recover)assert.equal(recoveryPhase,3,"Recovery was not exercised");
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
    assert.ok(Math.hypot(finalPose.x - finalDestination.x, finalPose.y - finalDestination.y) < 0.05, `Object missed destination: ${JSON.stringify(finalPose)}`);
  }
  }
  const stopped = lastState;
  await until(async () => {
    const settled = await readState();
    if (!settled) return false;
    lastState = settled;
    assert.equal(settled.objectTransfer.status, stopped.objectTransfer.status, "Terminal status changed without a command");
    assert.ok(Math.hypot(settled.objectTransfer.objectPose.x - stopped.objectTransfer.objectPose.x,
      settled.objectTransfer.objectPose.y - stopped.objectTransfer.objectPose.y,
      settled.objectTransfer.objectPose.z - stopped.objectTransfer.objectPose.z) < 0.01, "Cargo kept moving after termination");
    assert.ok(Math.hypot(settled.pose.x - stopped.pose.x, settled.pose.y - stopped.pose.y) < 0.01, "Base moved after termination");
    return settled.simulationTime - stopped.simulationTime >= 2;
  }, "stable physical termination");
  await report(true);
  console.log(`Physical manipulation ${missingGrip ? "rejected an unconfirmed grasp safely" : cancelStage || recover ? "cancelled safely" : "completed"}; arm motion ${maxJointMotion.toFixed(3)} rad; maximum object z ${maxObjectHeight.toFixed(3)} m.`);
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
