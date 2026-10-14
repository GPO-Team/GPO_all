const { validateMissionId } = require("../protocol/mission-contract.cjs");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  createMotionProfileText,
  createRuntimeCommandText,
  sanitizeMotionProfile,
  sanitizeRuntimeObstacle,
} = require("./web-state-serializers.cjs");
const {
  resolveAlgorithmKey,
  resolveTaskKey,
} = require("../protocol/solver-validation.cjs");
const {
  validatePoints,
  validatePolygons,
  validateSurfaceZones,
} = require("../protocol/route-validation.cjs");

const toDegrees = (radians) => (radians * 180) / Math.PI;

const createWebStateStore = ({ coordinateContract, stateDir }) => {
  const fsp = fs.promises;
  const paths = {
    routeJson: path.join(stateDir, "route.json"),
    routeCsv: path.join(stateDir, "route.csv"),
    limitZonesJson: path.join(stateDir, "limit_zones.json"),
    limitZonesTxt: path.join(stateDir, "limit_zones.txt"),
    surfaceZonesJson: path.join(stateDir, "surface_zones.json"),
    surfaceZonesTxt: path.join(stateDir, "surface_zones.txt"),
    motionProfile: path.join(stateDir, "motion_profile.txt"),
    runtimeCommand: path.join(stateDir, "runtime_command.txt"),
    sceneRevision: path.join(stateDir, "scene_revision.txt"),
  };
  const routeCsvHeader = coordinateContract.routeCsv.header.join(",");
  let ensureStateDirPromise = null;
  let pendingWrite = Promise.resolve();
  const serialize = operation => (...args) => {
    const result = pendingWrite.then(() => operation(...args));
    pendingWrite = result.catch(() => {});
    return result;
  };
  const atomicWrite = async (target, text) => {
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fsp.writeFile(temporary, text);
      await fsp.rename(temporary, target);
    } finally {
      await fsp.unlink(temporary).catch(() => {});
    }
  };

  const ensureStateDir = () => {
    if (!ensureStateDirPromise) {
      ensureStateDirPromise = fsp.mkdir(stateDir, { recursive: true }).catch(error => {
        ensureStateDirPromise = null;
        throw error;
      });
    }
    return ensureStateDirPromise;
  };

  const writeMotionProfile = async (motion) => {
    await ensureStateDir();
    const motionProfile = sanitizeMotionProfile(motion);
    await atomicWrite(paths.motionProfile, createMotionProfileText(motionProfile));
    return motionProfile;
  };

  const writeRoute = async (payload) => {
    await ensureStateDir();
    const route = validatePoints(payload?.route || []);
    const task = resolveTaskKey(payload?.algorithm?.task);
    const algorithmKey = resolveAlgorithmKey(payload?.algorithm?.key);
    const params = payload?.algorithm?.params || {};
    const motion = sanitizeMotionProfile(payload?.motion);
    const routeJson = {
      type: "route",
      coordinateContractVersion: coordinateContract.version,
      createdAt: new Date().toISOString(),
      task,
      algorithm: { key: algorithmKey, params },
      motion,
      route,
    };
    const commandId = payload.commandId === undefined ? randomUUID() : validateMissionId(payload.commandId);
    routeJson.commandId = commandId;
    const csvLines = [routeCsvHeader, `# command ${commandId}`];
    for (let index = 0; index < route.length; index += 1) {
      const point = route[index];
      const previous = index === 0 ? { x: 0, y: 0 } : route[index - 1];
      const headingDeg = toDegrees(Math.atan2(point.y - previous.y, point.x - previous.x));
      csvLines.push(`${point.x},${point.y},${headingDeg}`);
    }
    await atomicWrite(paths.routeJson, JSON.stringify(routeJson, null, 2));
    await writeMotionProfile(motion);
    // Route is the commit point: publish only after its motion profile is ready.
    await atomicWrite(paths.routeCsv, `${csvLines.join("\n")}\n`);
  };

  const writeLimitZones = async (payload) => {
    await ensureStateDir();
    const zones = validatePolygons(payload?.zones || []);
    const zonesJson = {
      type: "limit_zones",
      coordinateContractVersion: coordinateContract.version,
      createdAt: new Date().toISOString(),
      zones,
    };
    const textLines = [`zone_count ${zones.length}`];
    for (const zone of zones) {
      textLines.push(`zone ${zone.points.length}`);
      for (const point of zone.points) textLines.push(`${point.x} ${point.y}`);
    }
    await atomicWrite(paths.limitZonesJson, JSON.stringify(zonesJson, null, 2));
    await atomicWrite(paths.limitZonesTxt, `${textLines.join("\n")}\n`);
  };

  const writeSurfaceZones = async (payload) => {
    await ensureStateDir();
    const zones = validateSurfaceZones(payload?.zones || []);
    const zonesJson = {
      type: "surface_zones",
      coordinateContractVersion: coordinateContract.version,
      createdAt: new Date().toISOString(),
      zones,
    };
    const textLines = [`surface_zone_count ${zones.length}`];
    for (const zone of zones) {
      textLines.push(`surface_zone ${zone.points.length} ${zone.surfaceKey} ${zone.id}`);
      for (const point of zone.points) textLines.push(`${point.x} ${point.y}`);
    }
    await atomicWrite(paths.surfaceZonesJson, JSON.stringify(zonesJson, null, 2));
    await atomicWrite(paths.surfaceZonesTxt, `${textLines.join("\n")}\n`);
  };

  const writeRuntimeCommand = async (payload) => {
    await ensureStateDir();
    const previous = await fsp.readFile(paths.runtimeCommand, "utf8").catch(error => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    // A retry after a lost gateway reply must not append another runtime effect.
    if (payload.requestKey && previous.includes(`# request ${payload.requestKey}\n`)) return;
    const latestId = [...previous.matchAll(/^id (\d+)$/gm)].reduce((max, match) => Math.max(max, Number(match[1])), 0);
    const requestedId = Number(payload?.commandId);
    const commandId = Math.max(latestId + 1, Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : Date.now());
    if (!Number.isSafeInteger(commandId)) throw new Error("Runtime command id exceeds the supported range.");
    const commandText = (payload.requestKey ? `# request ${validateMissionId(payload.requestKey)}\n` : "") + createRuntimeCommandText({ ...payload, commandId });
    if (payload?.type === "start_mapping_survey") await writeMotionProfile(payload.motion);
    await atomicWrite(paths.runtimeCommand, previous + (previous && !previous.endsWith("\n") ? "\n" : "") + commandText);
  };

  const writeTransfer = async payload => {
    await ensureStateDir();
    await writeLimitZones({zones:payload.scene?.polygons || []});
    await writeSurfaceZones({zones:payload.scene?.surfaceZones || []});
    await writeMotionProfile(payload.scene?.motion);
    await atomicWrite(paths.sceneRevision, `${payload.sceneRevision}\n`);
    await writeRuntimeCommand({...payload,missionId:payload.missionId || payload.commandId});
  };

  return {
    ensureStateDir,
    paths,
    writeLimitZones: serialize(writeLimitZones),
    writeMotionProfile: serialize(writeMotionProfile),
    writeRoute: serialize(writeRoute),
    writeRuntimeCommand: serialize(writeRuntimeCommand),
    writeSurfaceZones: serialize(writeSurfaceZones),
    writeTransfer: serialize(writeTransfer),
  };
};

module.exports = {
  createWebStateStore,
  sanitizeMotionProfile,
  sanitizeRuntimeObstacle,
};
