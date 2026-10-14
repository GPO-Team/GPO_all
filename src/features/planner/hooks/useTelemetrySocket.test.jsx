// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTelemetrySocket } from "./useTelemetrySocket";

let root;
let latest;
let sockets;
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sockets = [];
  vi.stubGlobal("WebSocket", class {
    constructor() { sockets.push(this); }
    close() { this.onclose?.(); }
  });
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function Harness() {
  const state = useTelemetrySocket({ staleAfterMs: 5000 });
  React.useEffect(() => { latest = state; });
  return null;
}
it("requires fresh valid telemetry and expires a silent connection", async () => {
  await act(async () => root.render(<Harness />));
  await act(async () => sockets[0].onopen());
  expect(latest.connected).toBe(false);
  await act(async () => sockets[0].onmessage({ data: '{"pose":{"x":1,"y":2}}' }));
  expect(latest.connected).toBe(true);
  await act(async () => vi.advanceTimersByTime(5001));
  expect(latest.connected).toBe(false);
  await act(async () => sockets[0].onmessage({ data: '{}' }));
  expect(latest.connected).toBe(false);
  await act(async () => sockets[0].onmessage({ data: '{"pose":{"x":2,"y":3}}' }));
  expect(latest.connected).toBe(true);
});
it("ignores messages from a closed socket after reconnect", async () => {
  await act(async () => root.render(<Harness />));
  const old = sockets[0];
  await act(async () => old.onclose());
  await act(async () => vi.advanceTimersByTime(1000));
  await act(async () => old.onmessage({ data: '{"pose":{"x":99,"y":99}}' }));
  expect(latest.telemetry.x).toBe(0);
});
