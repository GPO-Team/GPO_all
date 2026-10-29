import { describe, expect, it } from "vitest";
import {
  DEFAULT_POINT_TASK,
  POINT_KIND_OPTIONS,
  getZoneColor,
} from "./zonePlannerPresentation";

describe("zone planner presentation", () => {
  it("preserves point options and cyclic zone colors", () => {
    expect(POINT_KIND_OPTIONS.map((option) => option.key)).toEqual([
      "visit", "free_visit", "charge", "limit", "surface",
    ]);
    expect(DEFAULT_POINT_TASK).toBe("Ожидание 2 сек");
    expect(getZoneColor(6)).toEqual(getZoneColor(0));
  });
});
