import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRouteChannelPayload } from "./routeChannel";
class Socket extends EventTarget {
  static OPEN = 1;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  message(value) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) })); }
}
afterEach(() => vi.unstubAllGlobals());
describe("route acknowledgements", () => {
  it("waits for its matching persistence ACK", async () => {
    vi.stubGlobal("WebSocket", Socket);
    const socket = new Socket();
    const onSent = vi.fn();
    const completion = sendRouteChannelPayload({ current: socket }, { type: "route" }, { onSent });
    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(onSent).not.toHaveBeenCalled();
    socket.message({ type: "route.ack", requestId: "other", ok: true });
    expect(onSent).not.toHaveBeenCalled();
    socket.message({ type: "route.ack", requestId: sent.requestId, ok: true });
    expect(await completion).toBe(true);
    expect(onSent).toHaveBeenCalledOnce();
    expect(socket.close).not.toHaveBeenCalled();
  });
  it("reports persistence rejection without reporting success", async () => {
    vi.stubGlobal("WebSocket", Socket);
    const socket = new Socket(), onSent = vi.fn(), onError = vi.fn();
    const completion = sendRouteChannelPayload({ current: socket }, {}, { onSent, onError });
    const {requestId} = JSON.parse(socket.send.mock.calls[0][0]);
    socket.message({ type: "route.ack", requestId, ok: false, error: "disk full" });
    expect(await completion).toBe(false);
    expect(onError.mock.calls[0][0].message).toBe("disk full");
    expect(onSent).not.toHaveBeenCalled();
  });
  it("times out when the bridge does not acknowledge", async () => {
    vi.stubGlobal("WebSocket", Socket);
    expect(await sendRouteChannelPayload({current:new Socket()}, {}, {timeoutMs:5})).toBe(false);
  });
  it("explains how to recover when a previous mission blocks submission", async () => {
    vi.stubGlobal("WebSocket", Socket);
    const socket = new Socket(), onSent = vi.fn(), onError = vi.fn();
    const completion = sendRouteChannelPayload({current: socket}, {}, {onSent, onError});
    const {requestId} = JSON.parse(socket.send.mock.calls[0][0]);
    socket.message({type: "route.ack", requestId, ok: false, code: "mission_active", error: "Mission old is active."});
    expect(await completion).toBe(false);
    expect(onError.mock.calls[0][0].message).toContain("Остановить маршрут");
    expect(onSent).not.toHaveBeenCalled();
  });
});
