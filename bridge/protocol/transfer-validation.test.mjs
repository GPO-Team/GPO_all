import { describe, expect, it } from "vitest";
import sceneValidation from "./scene-validation.cjs";
import transferValidation from "./transfer-validation.cjs";

const { normalizeScene, sceneRevision } = sceneValidation;
const { validateTransferCommand } = transferValidation;

const createCommand = overrides => {
  const scene = normalizeScene({
    polygons: [],
    surfaceZones: [],
    chargingStations: [],
    motion: {},
  });
  return {
    type: "transfer_object",
    objectId: "demo-box",
    destination: { x: 4, y: -2 },
    scene,
    sceneRevision: sceneRevision(scene),
    ...overrides,
  };
};

describe("object transfer validation", () => {
  it("normalizes a valid demo-box transfer", () => {
    expect(validateTransferCommand(createCommand())).toMatchObject({
      type: "transfer_object",
      objectId: "demo-box",
      destination: { x: 4, y: -2 },
    });
  });

  it("rejects unsupported objects", () => {
    expect(() => validateTransferCommand(createCommand({ objectId: "other" })))
      .toThrow(/demo-box/);
  });

  it.each([
    [{ x: -22.01, y: 0 }],
    [{ x: 22.01, y: 0 }],
    [{ x: 0, y: -17.01 }],
    [{ x: 0, y: 17.01 }],
  ])("rejects destinations outside the map", destination => {
    expect(() => validateTransferCommand(createCommand({ destination })))
      .toThrow(/map bounds/);
  });

  it("rejects a destination inside a restricted polygon", () => {
    const scene = normalizeScene({
      polygons: [{ id: "blocked", name: "Blocked", points: [
        { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 },
      ] }],
      surfaceZones: [],
      chargingStations: [],
      motion: {},
    });
    expect(() => validateTransferCommand(createCommand({
      destination: { x: 2, y: 2 },
      scene,
      sceneRevision: sceneRevision(scene),
    }))).toThrow(/restricted zone/);
  });

  it("rejects a stale scene revision", () => {
    expect(() => validateTransferCommand(createCommand({ sceneRevision: "stale" })))
      .toThrow(/scene revision/);
  });
});

it.each([null, undefined, {}, {x:null,y:0}, {x:0,y:null}, {x:"",y:0}, {x:false,y:0}])("rejects missing or nonnumeric destination coordinates %j", destination => {
  expect(() => validateTransferCommand(createCommand({destination}))).toThrow();
});
