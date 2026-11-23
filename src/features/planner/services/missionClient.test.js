import {afterEach,expect,it,vi} from "vitest";
import {resumeMission} from "./missionClient";
afterEach(()=>vi.unstubAllGlobals());
it("posts an encoded mission resume request", async () => {
  const mission={ok:true,missionId:"held/id",status:"holding_for_recovery"};
  const request=vi.fn(async()=>({ok:true,json:async()=>mission}));
  vi.stubGlobal("fetch",request);
  expect(await resumeMission("held/id")).toEqual(mission);
  expect(request).toHaveBeenCalledWith(expect.stringContaining("/api/missions/held%2Fid/resume"),{method:"POST",signal:expect.any(AbortSignal)});
});
it("surfaces server resume errors", async () => {
  vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,json:async()=>({ok:false,error:"Only a held transfer can resume"})})));
  await expect(resumeMission("held")).rejects.toThrow("Only a held transfer can resume");
});

it("bounds reading the mission response body after headers", async () => {
  vi.useFakeTimers();
  try {
    let signal;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      signal = init.signal;
      return { ok: true, json: () => new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }) };
    }));
    const result = resumeMission("held").catch(error => error);
    await vi.advanceTimersByTimeAsync(15000);
    expect(signal?.aborted).toBe(true);
    expect(await result).toBeInstanceOf(Error);
  } finally { vi.useRealTimers(); }
});
