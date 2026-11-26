import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import warehouseModule from "./warehouse-service.cjs";
import repositoryModule from "../repositories/warehouse-repository.cjs";
import sqliteModule from "../repositories/sqlite-repository.cjs";

const rack = (extra = {}) => ({
  id: "rack1",
  code: "A",
  name: "Стеллаж",
  x: 0,
  y: 0,
  yaw: 0,
  bays: 2,
  placesPerBay: 1,
  bayWidth: 1,
  depth: 1,
  levels: [{ supportZ: 0.2, clearHeight: 0.8, maxLoadKg: 20 }],
  ...extra,
});
const cargo = (id = "box1", extra = {}) => ({
  id,
  label: "Коробка",
  width: 0.4,
  depth: 0.4,
  height: 0.4,
  massKg: 5,
  ...extra,
});
const memoryRepository = () => {
  let saved;
  return {
    load: async () => saved && structuredClone(saved),
    save: async (value) => {
      saved = structuredClone(value);
    },
  };
};
const setup = async (repository = memoryRepository()) => {
  const service = warehouseModule.createWarehouseService({
    repository,
    now: () => "2026-10-28T00:00:00.000Z",
  });
  await service.createRack({ rack: rack(), expectedRevision: 0 });
  await service.registerCargo({ cargo: cargo(), expectedRevision: 1 });
  return service;
};

describe("warehouse service", () => {
  it("starts empty with both stations and returns independent snapshots", async () => {
    const service = warehouseModule.createWarehouseService({ repository: memoryRepository() });
    const result = await service.get();
    expect(result).toMatchObject({
      ok: true,
      warehouse: { schemaVersion: 1, revision: 0, racks: [], cargo: [], tasks: [] },
      slots: [],
    });
    expect(result.warehouse.stations.map((item) => item.id)).toEqual(["receiving", "shipping"]);
    result.warehouse.stations[0].name = "changed";
    expect((await service.get()).warehouse.stations[0].name).not.toBe("changed");
  });
  it("serializes racing reservations and keeps cargo at receiving", async () => {
    const service = await setup();
    await service.registerCargo({ cargo: cargo("box2"), expectedRevision: 2 });
    const results = await Promise.allSettled(
      ["box1", "box2"].map((cargoId, index) =>
        service.prepareTask({
          id: `task${index}`,
          cargoId,
          destinationId: "rack1:1:1:1",
          expectedRevision: 3,
        }),
      ),
    );
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.find((item) => item.status === "rejected").reason).toMatchObject({
      statusCode: 409,
    });
    const result = await service.get();
    expect(result.warehouse.tasks).toHaveLength(1);
    expect(result.slots[0].reservedBy).toBe("task0");
    expect(result.warehouse.cargo.every((item) => item.locationId === "receiving")).toBe(true);
  });
  it("enforces reservation locks and idempotent retries before revision checks", async () => {
    const service = await setup();
    const command = {
      id: "task1",
      cargoId: "box1",
      destinationId: "rack1:1:1:1",
      expectedRevision: 2,
    };
    await service.prepareTask(command);
    expect((await service.prepareTask(command)).warehouse.revision).toBe(3);
    await expect(
      service.prepareTask({ ...command, destinationId: "rack1:2:1:1" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "id_conflict" });
    await expect(
      service.updateRack("rack1", { rack: rack({ name: "change" }), expectedRevision: 3 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.deleteRack("rack1", { expectedRevision: 3 })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      service.updateStations({
        stations: (await service.get()).warehouse.stations,
        expectedRevision: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.importLayout({
        layout: { schemaVersion: 1, racks: [], stations: (await service.get()).warehouse.stations },
        expectedRevision: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await service.cancelTask("task1", { expectedRevision: 3 });
    expect((await service.cancelTask("task1", { expectedRevision: 0 })).warehouse.revision).toBe(4);
    const retry = await service.prepareTask(command);
    expect(retry.warehouse.tasks[0].status).toBe("cancelled");
    expect(retry.slots[0].reservedBy).toBe(null);
  });
  it("rejects stale revisions, duplicate cargo, missing entities and invalid fit", async () => {
    const service = await setup();
    await expect(
      service.registerCargo({ cargo: cargo("other"), expectedRevision: 0 }),
    ).rejects.toMatchObject({ code: "revision_conflict" });
    await expect(
      service.registerCargo({ cargo: cargo(), expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.prepareTask({
        id: "t",
        cargoId: "absent",
        destinationId: "rack1:1:1:1",
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await service.registerCargo({ cargo: cargo("large", { width: 2 }), expectedRevision: 2 });
    await expect(
      service.prepareTask({
        id: "t",
        cargoId: "large",
        destinationId: "rack1:1:1:1",
        expectedRevision: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await service.prepareTask({
      id: "t",
      cargoId: "box1",
      destinationId: "rack1:1:1:1",
      expectedRevision: 3,
    });
    await expect(
      service.prepareTask({
        id: "t2",
        cargoId: "box1",
        destinationId: "rack1:2:1:1",
        expectedRevision: 4,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("suggests eligible cells first and explains rejected geometry and reservations", async () => {
    const service = await setup();
    await service.createRack({
      rack: rack({ id: "small", code: "B", x: 4, bayWidth: 0.3 }),
      expectedRevision: 2,
    });
    await service.prepareTask({
      id: "t",
      cargoId: "box1",
      destinationId: "rack1:1:1:1",
      expectedRevision: 3,
    });
    await service.registerCargo({ cargo: cargo("box2"), expectedRevision: 4 });
    const result = await service.suggestions("box2");
    expect(result.revision).toBe(5);
    expect(result.suggestions[0]).toMatchObject({
      slotId: "rack1:2:1:1",
      eligible: true,
      robotAccess: "unverified",
      reasons: [],
    });
    expect(result.suggestions.slice(1).every((item) => !item.eligible && item.reasons.length)).toBe(
      true,
    );
  });
  it("keeps published state unchanged when persistence fails and recovers its queue", async () => {
    const repository = memoryRepository();
    const service = await setup(repository);
    const save = repository.save;
    repository.save = async () => {
      throw new Error("disk full");
    };
    await expect(
      service.prepareTask({
        id: "t",
        cargoId: "box1",
        destinationId: "rack1:1:1:1",
        expectedRevision: 2,
      }),
    ).rejects.toThrow("disk full");
    expect((await service.get()).warehouse).toMatchObject({ revision: 2, tasks: [] });
    repository.save = save;
    expect(
      (
        await service.prepareTask({
          id: "t",
          cargoId: "box1",
          destinationId: "rack1:1:1:1",
          expectedRevision: 2,
        })
      ).warehouse.revision,
    ).toBe(3);
  });
  it("reads only committed state while a reservation is waiting for storage", async () => {
    const repository = memoryRepository();
    const service = await setup(repository);
    const save = repository.save;
    let release, entered;
    const writing = new Promise((resolve) => {
      entered = resolve;
    });
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    repository.save = async (value) => {
      entered();
      await gate;
      await save(value);
    };
    const preparing = service.prepareTask({
      id: "t",
      cargoId: "box1",
      destinationId: "rack1:1:1:1",
      expectedRevision: 2,
    });
    await writing;
    const before = await service.get();
    expect(before.warehouse.revision).toBe(2);
    expect(before.slots[0].reservedBy).toBe(null);
    expect((await service.suggestions("box1")).suggestions.every((item) => item.eligible)).toBe(
      true,
    );
    release();
    const committed = await preparing;
    committed.warehouse.tasks[0].status = "cancelled";
    committed.slots[0].reservedBy = null;
    expect((await service.get()).warehouse.tasks[0].status).toBe("prepared");
  });
  it("imports layout without discarding cargo and generates missing rack IDs", async () => {
    const service = await setup();
    const stations = (await service.get()).warehouse.stations;
    const result = await service.importLayout({
      layout: { schemaVersion: 1, racks: [rack({ id: undefined, code: "NEW" })], stations },
      expectedRevision: 2,
    });
    expect(result.warehouse.cargo).toHaveLength(1);
    expect(result.warehouse.racks[0].id).toMatch(/^[A-Za-z0-9_-]{1,63}$/);
    expect(result.slots[0].address).toBe("NEW-01-01-01");
  });
  it.each([
    { bays: 1.5 },
    { bays: 13 },
    { placesPerBay: 9 },
    { depth: 0 },
    { x: NaN },
    { x: 22 },
    { yaw: Infinity },
    { levels: [{ supportZ: 19.8, clearHeight: 1, maxLoadKg: 2 }] },
    {
      levels: [
        { supportZ: 0, clearHeight: 1, maxLoadKg: 2 },
        { supportZ: 0.5, clearHeight: 1, maxLoadKg: 2 },
      ],
    },
    { code: " " },
    { name: "x".repeat(201) },
    { id: "../unsafe" },
  ])("rejects invalid rack data %j", async (extra) => {
    const service = warehouseModule.createWarehouseService({ repository: memoryRepository() });
    await expect(
      service.createRack({ rack: rack(extra), expectedRevision: 0 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("rejects rotated overlaps, duplicate codes and the total slot limit", async () => {
    const service = await setup();
    await expect(
      service.createRack({ rack: rack({ id: "other", code: "B", yaw: 0.5 }), expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.createRack({ rack: rack({ id: "other", x: 5 }), expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.importLayout({
        layout: {
          schemaVersion: 1,
          stations: (await service.get()).warehouse.stations,
          racks: [
            rack({
              bays: 12,
              placesPerBay: 8,
              levels: Array.from({ length: 12 }, (_, i) => ({
                supportZ: i,
                clearHeight: 0.8,
                maxLoadKg: 5,
              })),
            }),
          ],
        },
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("rejects invalid station settings and unsupported layout versions", async () => {
    const service = await setup();
    const stations = (await service.get()).warehouse.stations;
    for (const invalidStations of [
      [],
      [stations[0], stations[0]],
      stations.map((item) => ({ ...item, x: Infinity })),
      stations.map((item) => ({ ...item, kind: "unknown" })),
    ]) {
      await expect(
        service.updateStations({ stations: invalidStations, expectedRevision: 2 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(
      service.importLayout({
        layout: { schemaVersion: 2, racks: [], stations },
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await service.get()).warehouse.revision).toBe(2);
  });
  it.each([
    { width: "1" },
    { massKg: 0 },
    { height: Infinity },
    { depth: -1 },
    { id: "unsafe/id" },
    { label: " " },
  ])("rejects invalid cargo %j", async (extra) => {
    const service = await setup();
    await expect(
      service.registerCargo({ cargo: cargo("other", extra), expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("persists across reopen including lost-response prepare/cancel retries", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "warehouse-test-"));
    let records = sqliteModule.createSqliteRepository({ directory });
    try {
      let service = await setup(
        repositoryModule.createWarehouseRepository({ repository: records }),
      );
      const command = {
        id: "t",
        cargoId: "box1",
        destinationId: "rack1:1:1:1",
        expectedRevision: 2,
      };
      await service.prepareTask(command);
      await records.close();
      records = sqliteModule.createSqliteRepository({ directory });
      service = warehouseModule.createWarehouseService({
        repository: repositoryModule.createWarehouseRepository({ repository: records }),
      });
      expect((await service.prepareTask(command)).warehouse.revision).toBe(3);
      await service.cancelTask("t", { expectedRevision: 3 });
      await records.close();
      records = sqliteModule.createSqliteRepository({ directory });
      service = warehouseModule.createWarehouseService({
        repository: repositoryModule.createWarehouseRepository({ repository: records }),
      });
      expect((await service.cancelTask("t", { expectedRevision: 3 })).warehouse.revision).toBe(4);
      expect((await service.prepareTask(command)).warehouse.tasks[0].status).toBe("cancelled");
    } finally {
      await records.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    (state) => {
      delete state.stations;
    },
    (state) => {
      state.cargo[0].width = -1;
    },
    (state) => {
      state.cargo.push({ ...state.cargo[0] });
    },
    (state) => {
      state.tasks[0].destinationId = "missing:1:1:1";
    },
    (state) => {
      state.tasks[0].cargoId = "missing";
    },
    (state) => {
      state.tasks[0].status = "completed";
    },
    (state) => {
      state.tasks.push({ ...state.tasks[0], id: "duplicate-reservation" });
    },
    (state) => {
      state.cargo[0].width = 2;
    },
    (state) => {
      state.tasks[0].createdAt = "invalid";
    },
  ])(
    "refuses malformed stored data instead of publishing a successful snapshot (%#)",
    async (corrupt) => {
      const original = await setup();
      await original.prepareTask({
        id: "task",
        cargoId: "box1",
        destinationId: "rack1:1:1:1",
        expectedRevision: 2,
      });
      const stored = (await original.get()).warehouse;
      corrupt(stored);
      const service = warehouseModule.createWarehouseService({
        repository: { load: async () => stored, save: async () => {} },
      });
      await expect(service.get()).rejects.toMatchObject({
        statusCode: 503,
        code: "invalid_storage",
      });
    },
  );

  it("reopens cancelled history after deleting the destination rack", async () => {
    const original = await setup();
    await original.prepareTask({
      id: "task",
      cargoId: "box1",
      destinationId: "rack1:1:1:1",
      expectedRevision: 2,
    });
    await original.cancelTask("task", { expectedRevision: 3 });
    const stored = (await original.deleteRack("rack1", { expectedRevision: 4 })).warehouse;
    const service = warehouseModule.createWarehouseService({
      repository: { load: async () => stored, save: async () => {} },
    });
    expect((await service.get()).warehouse.tasks[0].status).toBe("cancelled");
  });

  it("does not mistake an existing malformed database record for an empty warehouse", async () => {
    const repository = repositoryModule.createWarehouseRepository({
      repository: { get: async () => ({ missionId: "warehouse" }), save: async () => {} },
    });
    const service = warehouseModule.createWarehouseService({ repository });
    await expect(service.get()).rejects.toMatchObject({ statusCode: 503, code: "invalid_storage" });
  });
});

it("restores a full legacy history without consuming capacity or forgetting cancelled request IDs", async () => {
  const repository = memoryRepository();
  await setup(repository);
  const legacy = await repository.load();
  const date = "2026-10-28T00:00:00.000Z";
  const destinationId = "rack1:1:1:1";
  legacy.tasks = Array.from({ length: 10000 }, (_, index) => ({
    id: `old-${index}`, cargoId: "box1", sourceId: "receiving", destinationId,
    status: "cancelled", createdAt: date, cancelledAt: date,
  }));
  await repository.save(legacy);
  const restored = warehouseModule.createWarehouseService({ repository });
  const command = { expectedRevision: 2, id: "fresh", cargoId: "box1", destinationId };
  const created = await restored.prepareTask(command);
  expect(created.slots[0].reservedBy).toBe("fresh");
  expect(created.warehouse.tasks).toHaveLength(10001);
  const restarted = warehouseModule.createWarehouseService({ repository });
  const retry = await restarted.prepareTask({ ...command, id: "old-0" });
  expect(retry.warehouse.revision).toBe(3);
  expect(retry.warehouse.tasks.find((task) => task.id === "old-0").status).toBe("cancelled");
  expect(retry.slots[0].reservedBy).toBe("fresh");
});

const setupFloorDelivery = async () => {
  const repository = memoryRepository();
  const missions = { get: vi.fn(async () => null), submit: vi.fn(async (_command, {requestId}) => ({ missionId:requestId, status: "persisted" })) };
  const makeService = () => warehouseModule.createWarehouseService({ repository, missionService: missions });
  const service = makeService();
  await service.createRack({ rack: rack({levels:[{ supportZ: 0, clearHeight: .8, maxLoadKg: 20 }]}), expectedRevision: 0 });
  await service.registerCargo({ cargo: cargo("box1", {objectDef:"PICK_BOX",width:.03,depth:.03,height:.08}), expectedRevision: 1 });
  const destinationId = "rack1:1:1:1";
  await service.prepareTask({ id:"job", cargoId:"box1", destinationId, expectedRevision:2 });
  return { repository, missions, makeService, service, destinationId };
};

it("keeps a floor slot reserved until the linked vision mission verifies delivery", async () => {
  const { missions, makeService, service, destinationId } = await setupFloorDelivery();
  const running = await service.startTask("job", {expectedRevision:3});
  const task = running.warehouse.tasks[0];
  expect(task).toMatchObject({status:"executing", missionId:expect.any(String)});
  expect(missions.submit).toHaveBeenCalledWith(
    {type:"pick_place",source:"vision",pickup:{objectDef:"PICK_BOX",x:-8,y:-6},destination:{x:-.5,y:0,z:.04}},
    {requestId:task.missionId},
  );
  expect(running.warehouse.cargo[0].locationId).toBe("receiving");
  expect(running.slots[0].reservedBy).toBe("job");
  await expect(service.cancelTask("job", {expectedRevision:running.warehouse.revision})).rejects.toMatchObject({code:"task_in_execution"});
  missions.get.mockResolvedValue({missionId:task.missionId,status:"completed",deliveryEvidence:{
    objectDef:"PICK_BOX",objectPosition:{x:-.49,y:0,z:.04},loadHeld:false,onPlatform:false,
  }});
  const restarted = makeService();
  await restarted.reconcile();
  const delivered = await restarted.get();
  expect(delivered.warehouse.tasks[0]).toMatchObject({status:"completed",missionId:task.missionId});
  expect(delivered.warehouse.cargo[0].locationId).toBe(destinationId);
  expect(delivered.slots[0]).toMatchObject({reservedBy:null,occupiedBy:"box1"});
  expect(missions.submit).toHaveBeenCalledOnce();
});

it("preserves the same mission ID after a lost launch response and reconciles it after restart", async () => {
  const { missions, makeService, service } = await setupFloorDelivery();
  missions.submit.mockRejectedValueOnce(new Error("lost reply"));
  await expect(service.startTask("job", {expectedRevision:3})).rejects.toThrow("lost reply");
  const pending = (await service.get()).warehouse.tasks[0];
  expect(pending.status).toBe("launching");
  const restarted = makeService();
  await restarted.reconcile();
  expect(missions.submit).toHaveBeenCalledTimes(1);
  await restarted.startTask("job", {expectedRevision:3});
  expect(missions.submit.mock.calls.map(([, options]) => options.requestId))
    .toEqual([pending.missionId, pending.missionId]);
});

it("retains the reservation for a completion with no verified cargo position", async () => {
  const { missions, service } = await setupFloorDelivery();
  const running = await service.startTask("job", {expectedRevision:3});
  missions.get.mockResolvedValue({
    missionId: running.warehouse.tasks[0].missionId, status:"completed",
    deliveryEvidence:{objectDef:"PICK_BOX",objectPosition:{x:0,y:0,z:.04},loadHeld:false,onPlatform:false},
  });
  await service.reconcile();
  const attention = await service.get();
  expect(attention.warehouse.tasks[0]).toMatchObject({status:"attention",failureReason:"delivery_unconfirmed"});
  expect(attention.warehouse.cargo[0].locationId).toBe("receiving");
  expect(attention.slots[0].reservedBy).toBe("job");
  await expect(service.cancelTask("job", {expectedRevision:attention.warehouse.revision}))
    .rejects.toMatchObject({code:"task_in_execution"});
  const cancelled = await service.cancelTask("job", {expectedRevision:attention.warehouse.revision, confirmReturned:true});
  expect(cancelled.warehouse.tasks[0].status).toBe("cancelled");
  expect(cancelled.slots[0].reservedBy).toBeNull();
});

it("marks previous-session stock unverified and records an operator-confirmed return", async () => {
  const { repository, missions, service, destinationId } = await setupFloorDelivery();
  const running = await service.startTask("job", {expectedRevision:3});
  missions.get.mockResolvedValue({
    missionId:running.warehouse.tasks[0].missionId,status:"completed",controllerBootId:"boot-before",
    deliveryEvidence:{objectDef:"PICK_BOX",objectPosition:{x:-.49,y:0,z:.04},loadHeld:false,onPlatform:false},
  });
  await service.reconcile();
  let boot = "boot-before";
  const restarted = warehouseModule.createWarehouseService({
    repository,missionService:missions,getControllerSession:async () => boot,
  });
  await restarted.reconcile();
  expect((await restarted.get()).slots[0].needsVerification).toBeUndefined();
  boot = "boot-after";
  await restarted.reconcile();
  const uncertain = await restarted.get();
  expect(uncertain.slots[0]).toMatchObject({occupiedBy:"box1",needsVerification:true});
  const restored = await restarted.verifyCargo("box1",{
    expectedRevision:uncertain.warehouse.revision,location:"receiving",controllerSession:uncertain.verificationSession,
  });
  expect(restored.slots[0].occupiedBy).toBeUndefined();
  expect(restored.warehouse.cargo[0].locationId).toBe("receiving");
  expect(restored.warehouse.tasks[0]).toMatchObject({status:"completed",destinationId});
  const recovered = warehouseModule.createWarehouseService({repository});
  expect((await recovered.get()).warehouse.cargo[0].locationId).toBe("receiving");
});

it("keeps a shelf occupied through retrieval and frees it only after delivery to shipping", async () => {
  const repository = memoryRepository();
  const missions = { get: vi.fn(async () => null), submit: vi.fn(async (_command, {requestId}) => ({missionId:requestId,status:"persisted"})) };
  const makeService = () => warehouseModule.createWarehouseService({repository,missionService:missions});
  const service = makeService();
  await service.createRack({rack:rack({bays:1,levels:[{supportZ:.10,clearHeight:.25,maxLoadKg:1,supportDef:"WAREHOUSE_SHELF"}]}),expectedRevision:0});
  await service.registerCargo({cargo:cargo("box", {objectDef:"PICK_BOX",width:.03,depth:.03,height:.08,massKg:.04}),expectedRevision:1});
  const slot = "rack1:1:1:1";
  await service.prepareTask({id:"put",cargoId:"box",destinationId:slot,expectedRevision:2});
  const inbound = await service.startTask("put",{expectedRevision:3});
  expect(missions.submit.mock.calls.at(-1)[0].destination).toEqual({x:0,y:0,z:.14,supportDef:"WAREHOUSE_SHELF"});
  const confirm = (missionId,objectPosition) => missions.get.mockResolvedValue({
    missionId,status:"completed",deliveryEvidence:{objectDef:"PICK_BOX",objectPosition,loadHeld:false,onPlatform:false},
  });
  confirm(inbound.warehouse.tasks[0].missionId,{x:0,y:0,z:.14});
  await service.reconcile();
  const stored = await service.get();
  expect(stored.slots[0].occupiedBy).toBe("box");
  const outbound = await service.prepareTask({id:"take",cargoId:"box",destinationId:"shipping",expectedRevision:stored.warehouse.revision});
  expect(outbound.slots[0]).toMatchObject({occupiedBy:"box",reservedBy:"take"});
  const executing = await service.startTask("take",{expectedRevision:outbound.warehouse.revision});
  const task = executing.warehouse.tasks.find((item) => item.id === "take");
  expect(missions.submit.mock.calls.at(-1)[0]).toMatchObject({source:"warehouse",
    pickup:{objectDef:"PICK_BOX",x:0,y:0,z:.14,supportDef:"WAREHOUSE_SHELF"},destination:{x:8,y:-6,z:.04},
  });
  confirm(task.missionId,{x:8,y:-6,z:.04});
  const resumed = makeService();
  await resumed.reconcile();
  const delivered = await resumed.get();
  expect(delivered.slots[0].occupiedBy).toBeUndefined();
  expect(delivered.warehouse.cargo[0].locationId).toBe("shipping");
  expect(delivered.warehouse.tasks).toEqual(expect.arrayContaining([
    expect.objectContaining({id:"put",status:"completed"}),
    expect.objectContaining({id:"take",status:"completed",sourceId:slot,destinationId:"shipping"}),
  ]));
});
