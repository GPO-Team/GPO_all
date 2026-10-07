import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import storeModule from "./web-state-store.cjs";
import coordinateContract from "../../shared/coordinate-contract.json" with { type: "json" };

const { createWebStateStore } = storeModule;
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true })
    )
  );
});

const createStore = async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "gpo-state-"));
  temporaryDirectories.push(stateDir);
  return { stateDir, store: createWebStateStore({ coordinateContract, stateDir }) };
};

describe("web state store", () => {
  it("preserves an explicit mission command id across delivery retries", async () => {
    const {store} = await createStore();
    const command = {commandId:"mission-42",route:[{x:0,y:0},{x:1,y:0}]};
    await store.writeRoute(command);
    const first = await fs.readFile(store.paths.routeCsv,"utf8");
    await store.writeRoute(command);
    expect(await fs.readFile(store.paths.routeCsv,"utf8")).toBe(first);
    expect(first).toContain("# command mission-42");
  });
  it("keeps the last complete controller route when an auxiliary write fails", async () => {
    const {store} = await createStore();
    await store.writeRoute({route:[{x:0,y:0},{x:1,y:0}]});
    const previous = await fs.readFile(store.paths.routeCsv, "utf8");
    await fs.unlink(store.paths.routeJson);
    await fs.mkdir(store.paths.routeJson);
    await expect(store.writeRoute({route:[{x:0,y:0},{x:5,y:0}]})).rejects.toThrow();
    expect(await fs.readFile(store.paths.routeCsv, "utf8")).toBe(previous);
  });
  it("preserves concurrent runtime commands with colliding client ids in arrival order", async () => {
    const {store} = await createStore();
    await Promise.all([1,2,3].map(x => store.writeRuntimeCommand({commandId:10, obstacle:{x,y:0}})));
    const text = await fs.readFile(store.paths.runtimeCommand, "utf8");
    expect([...text.matchAll(/^id (\d+)$/gm)].map(match => Number(match[1]))).toEqual([10,11,12]);
    expect([...text.matchAll(/^x (\d+)$/gm)].map(match => Number(match[1]))).toEqual([1,2,3]);
  });
  it("publishes a distinct launch id for identical route sends", async () => {
    const {store}=await createStore();
    const route={route:[{x:0,y:0},{x:1,y:0}]};
    await store.writeRoute(route);
    const first=await fs.readFile(store.paths.routeCsv,"utf8");
    await store.writeRoute(route);
    const second=await fs.readFile(store.paths.routeCsv,"utf8");
    expect(second).not.toBe(first);
    expect(second).toMatch(/# command [\w-]+/);
  });
  it("writes compatible route JSON, CSV and motion files", async () => {
    const { stateDir, store } = await createStore();
    await store.writeRoute({
      type: "route",
      algorithm: { key: "genetik", task: "tsp", params: { generations: 10 } },
      motion: { cruiseSpeedMps: 0.3, payloadKg: 5, batteryRange: 100 },
      route: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });

    const route = JSON.parse(await fs.readFile(path.join(stateDir, "route.json"), "utf8"));
    const csv = await fs.readFile(path.join(stateDir, "route.csv"), "utf8");
    const motion = await fs.readFile(path.join(stateDir, "motion_profile.txt"), "utf8");

    expect(route.algorithm.key).toBe("ga_tabu");
    expect(route.route).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(csv).toContain(coordinateContract.routeCsv.header.join(","));
    expect(csv).toContain("1,0,0");
    expect(motion).toContain("cruise_speed_mps 0.3");
  });

  it("writes limit and surface zone contracts", async () => {
    const { stateDir, store } = await createStore();
    const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    await store.writeLimitZones({ zones: [{ id: "limit", points }] });
    await store.writeSurfaceZones({ zones: [{ id: "rough", surfaceKey: "rough", points }] });

    expect(await fs.readFile(path.join(stateDir, "limit_zones.txt"), "utf8")).toContain(
      "zone_count 1"
    );
    expect(await fs.readFile(path.join(stateDir, "surface_zones.txt"), "utf8")).toContain(
      "surface_zone 3 rough rough"
    );
  });

  it("writes runtime commands with bounded obstacle values", async () => {
    const { stateDir, store } = await createStore();
    await store.writeRuntimeCommand({
      type: "spawn_random_obstacle",
      commandId: 10,
      obstacle: { x: 500, y: -500, sizeX: 100, sizeY: 0, height: 20 },
    });

    const command = await fs.readFile(path.join(stateDir, "runtime_command.txt"), "utf8");
    expect(command).toContain("id 10");
    expect(command).toContain("x 21.5");
    expect(command).toContain("y -16.5");
    expect(command).toContain("size_x 3.5");
  });

  it("commits a transfer scene revision before publishing its command", async () => {
    const {store}=await createStore();
    await store.writeTransfer({commandId:"transfer-1",type:"transfer_object",missionId:"transfer-1",objectId:"demo-box",
      destination:{x:4,y:-2},sceneRevision:"rev-1",scene:{polygons:[],surfaceZones:[]}});
    expect(await fs.readFile(store.paths.sceneRevision,"utf8")).toBe("rev-1\n");
    expect(await fs.readFile(store.paths.runtimeCommand,"utf8")).toContain("scene_revision rev-1");
  });
});

it("writes the transfer scene motion profile and does not publish when it fails", async () => {
  const {store}=await createStore();
  const transfer={commandId:"motion-transfer",type:"transfer_object",objectId:"demo-box",destination:{x:1,y:2},sceneRevision:"revision",scene:{motion:{cruiseSpeedMps:0.23,payloadKg:0.5}}};
  await store.writeTransfer(transfer);
  expect(await fs.readFile(store.paths.motionProfile,"utf8")).toContain("cruise_speed_mps 0.23");
  const previous=await fs.readFile(store.paths.runtimeCommand,"utf8");
  await fs.unlink(store.paths.motionProfile);
  await fs.mkdir(store.paths.motionProfile);
  await expect(store.writeTransfer({...transfer,commandId:"next-transfer"})).rejects.toThrow();
  expect(await fs.readFile(store.paths.runtimeCommand,"utf8")).toBe(previous);
});
