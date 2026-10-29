export function newRack(codes = []) {
  let index = 1;
  let code = "A";
  while (codes.includes(code)) {
    index += 1;
    code = `R${index}`;
  }
  return {
    code,
    name: `Стеллаж ${code}`,
    x: "0",
    y: "0",
    yaw: "0",
    bays: "2",
    placesPerBay: "2",
    bayWidth: "1.2",
    depth: "0.8",
    levels: [
      { supportZ: "0.1", clearHeight: "0.7", maxLoadKg: "50" },
      { supportZ: "1", clearHeight: "0.7", maxLoadKg: "50" },
    ],
  };
}

export function rackDraft(rack) {
  return {
    ...rack,
    yaw: String(Math.round(((rack.yaw * 180) / Math.PI) * 1000) / 1000),
    levels: rack.levels.map((level) => ({ ...level })),
  };
}

export function rackPayload(draft) {
  return {
    ...draft,
    x: Number(draft.x),
    y: Number(draft.y),
    yaw: (Number(draft.yaw) * Math.PI) / 180,
    bays: Number(draft.bays),
    placesPerBay: Number(draft.placesPerBay),
    bayWidth: Number(draft.bayWidth),
    depth: Number(draft.depth),
    levels: draft.levels.map((level) => ({
      supportZ: Number(level.supportZ),
      clearHeight: Number(level.clearHeight),
      maxLoadKg: Number(level.maxLoadKg),
    })),
  };
}
