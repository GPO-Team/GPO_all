import { describe, expect, it } from "vitest";
import { createDashboardPlannerViewModel } from "./dashboardPlannerViewModel";

describe("createDashboardPlannerViewModel", () => {
  it("selects the active surface zone and falls back to algorithm defaults", () => {
    const surfaceZones = [
      { id: "surface-zone-1", label: "Первый" },
      { id: "surface-zone-2", label: "Второй" },
    ];

    const viewModel = createDashboardPlannerViewModel({
      algorithmKey: "ga_tabu",
      algorithmParams: {},
      activeSurfaceZoneId: "surface-zone-2",
      surfaceZones,
    });

    expect(viewModel.activeSurfaceZone).toBe(surfaceZones[1]);
    expect(viewModel.selectedAlgorithmParams).toMatchObject({
      generations: expect.any(Number),
    });
    expect(viewModel.algorithmPrecision).toBe("medium");
  });
});
