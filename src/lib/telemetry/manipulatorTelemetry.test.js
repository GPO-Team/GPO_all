import { expect, it } from "vitest";
import { normalizeTelemetry } from "./normalizeDashboardTelemetry";
it.each(["driving_to_object","carrying","stowing"])("preserves mobile delivery stage %s", stage => {
  expect(normalizeTelemetry({pose:{x:0,y:0},manipulator:{stage,active:true,missionId:"delivery"}}).manipulator).toMatchObject({stage,active:true,missionId:"delivery"});
});
it("normalizes malformed manipulator fields without exposing objects to React", () => {
  const telemetry = normalizeTelemetry({pose:{x:0,y:0},manipulator:{stage:"__proto__",error:{message:"bad"},active:"false",joints:[NaN]}});
  expect(telemetry.manipulator.stage).toBe("idle");
  expect(telemetry.manipulator.error).toBe("");
  expect(telemetry.manipulator.active).toBe(false);
  expect(telemetry.manipulator.joints).toEqual([]);
});
