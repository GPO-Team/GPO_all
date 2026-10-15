import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import gateway from "./gateway-service.cjs";
import adapters from "../adapters/webots-file-adapter.cjs";
import stores from "../artifacts/web-state-store.cjs";
import scenes from "../protocol/scene-validation.cjs";
import coordinateContract from "../../shared/coordinate-contract.json";

let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

it("publishes a transfer once when delivered journaling fails and the gateway restarts", async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "gpo-transfer-replay-"));
  const artifactStore = stores.createWebStateStore({ stateDir: directory, coordinateContract });
  const adapter = adapters.createWebotsFileAdapter({ artifactStore, stateDir: directory });
  const records = new Map();
  let failDelivered = true;
  const repository = {
    get: async id => records.get(id),
    save: async record => {
      if (record.status === "delivered" && failDelivered) {
        failDelivered = false;
        throw new Error("journal unavailable after publication");
      }
      records.set(record.missionId, record);
    },
  };
  const scene = scenes.normalizeScene({});
  const command = { type: "transfer_object", commandId: "delivery-once", objectId: "demo-box",
    destination: { x: 2, y: 2 }, scene, sceneRevision: scenes.sceneRevision(scene) };
  await expect(gateway.createGatewayService({ repository, adapter }).execute("submit", command.commandId, command))
    .rejects.toThrow("journal unavailable");
  // Recreate both services: the publication identity must survive process memory.
  const restartedStore = stores.createWebStateStore({ stateDir: directory, coordinateContract });
  const restartedAdapter = adapters.createWebotsFileAdapter({ artifactStore: restartedStore, stateDir: directory });
  await gateway.createGatewayService({ repository, adapter: restartedAdapter }).execute("submit", command.commandId, command);
  const journal = await readFile(artifactStore.paths.runtimeCommand, "utf8");
  expect(journal.match(/^type transfer_object$/gm)).toHaveLength(1);
});

it("does not replay a legacy transfer without a request key after another command", async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "gpo-transfer-legacy-"));
  const store = stores.createWebStateStore({ stateDir: directory, coordinateContract });
  const command = { type: "transfer_object", missionId: "legacy-transfer", commandId: "legacy-transfer",
    objectId: "demo-box", destination: { x: 2, y: 2 }, sceneRevision: "legacy" };
  await store.writeRuntimeCommand(command);
  await store.writeRuntimeCommand({ type: "spawn_random_obstacle", obstacle: { x: 5, y: 5 } });
  const restartedStore = stores.createWebStateStore({ stateDir: directory, coordinateContract });
  await restartedStore.writeTransfer(command);
  expect((await readFile(store.paths.runtimeCommand, "utf8")).match(/^type transfer_object$/gm)).toHaveLength(1);
});
