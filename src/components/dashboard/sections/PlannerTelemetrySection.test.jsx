import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlannerTelemetrySection from "./PlannerTelemetrySection";
import { normalizeTelemetry } from "../../../lib/dashboardTelemetry";
import bridgeNormalizer from "../../../../bridge/telemetry/normalizer.cjs";
import coordinateContract from "../../../../shared/coordinate-contract.json";

describe("robot telemetry", () => {
  it("carries controller motion and navigation through normalization into sensor readings", () => {
    const bridgePacket = bridgeNormalizer.createTelemetryNormalizer(coordinateContract)({
      type: "telemetry", simulationTime: 42.5, pose: { x: 1.25, y: 2, z: 0.1, yaw: 0.4 },
      navigation: { status: "tracking_path", currentWaypointIndex: 2, distanceToTarget: "3.5",
        target: { x: "4", y: "5", headingDeg: "90" }, avoidanceActive: false, offRouteActive: false, avoidanceTimeSec: 12.4 },
      motionProfile: { cruiseSpeedMps: "0.8", payloadKg: "2", batteryRange: "120",
        batterySpeedFactor: "0.75", runtimeLinearLimitMps: "0.6", runtimeAngularLimitRad: "1.2" },
      perception: { lidar: { enabled: true, frontMinRange: 1.6 },
        camera: { enabled: true, frameDataUrl: "data:image/png;base64,frame" } },
    });
    const telemetry = normalizeTelemetry(bridgePacket);
    const html = renderToStaticMarkup(<PlannerTelemetrySection telemetry={telemetry} telemetryWsUp routeWsUp solverApiUp />);
    expect(html).toContain("Телеметрия робота");
    expect(html).toContain("<details open");
    for (const reading of ["1.25 м", "Следование маршруту", "3.50 м", "4.00 / 5.00 м", "90.00 °", "0.80 м/с", "120.0 энерго-ед.", "0.60 м/с", "1.20 рад/с", "1.60 м", "12.4 с"]) {
      expect(html).toContain(reading);
    }
    expect(html.indexOf("Показания датчиков")).toBeLessThan(html.indexOf("Камера робота"));
    expect(html).toContain("Камера робота");
    expect(html).not.toContain("Режим обследования");
  });

  it("retains omitted controller fields and clears a completed target", () => {
    const previous = normalizeTelemetry({ type: "telemetry", pose: { x: 1, y: 2 },
      motionProfile: { cruiseSpeedMps: 0.8 }, navigation: { target: { x: 3, y: 4 }, error: "" } });
    const updated = normalizeTelemetry({ type: "telemetry", pose: { x: 2, y: 3 },
      navigation: { finished: true, target: null }, motionProfile: { payloadKg: "2", batteryRange: "bad" } }, previous);
    expect(updated.navigation.target).toBeNull();
    expect(updated.motionProfile).toMatchObject({ cruiseSpeedMps: 0.8, payloadKg: 2, batteryRange: null });
    const html = renderToStaticMarkup(<PlannerTelemetrySection telemetry={updated} />);
    expect(html).toContain("Нет соединения с телеметрией");
    expect(html).toContain("Маршрут завершён");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("null");
  });
});
