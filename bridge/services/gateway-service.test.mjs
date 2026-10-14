import { describe, expect, it, vi } from "vitest";
import gateway from "./gateway-service.cjs";

const setup = () => {
  const records = new Map();
  const repository = { get: async id => records.get(id), save: async r => records.set(r.missionId, r) };
  const adapter = { getFeedback:vi.fn(async()=>null), submit: vi.fn(async () => {}), update: vi.fn(async () => true), cancel: vi.fn(async () => {}) };
  return { repository, adapter, service: gateway.createGatewayService({ repository, adapter }) };
};
describe("gateway delivery journal", () => {
  it("rejects untracked survey updates even when the robot is idle", async () => {
    const {service,adapter} = setup();
    await expect(service.execute("update", "survey", {type:"start_mapping_survey"})).rejects.toMatchObject({statusCode:400});
    expect(adapter.update).not.toHaveBeenCalled();
  });
  it("does not redeliver after a lost reply or gateway restart", async () => {
    const { repository, adapter, service } = setup();
    const payload = { commandId: "m1", route: [{x:0,y:0},{x:1,y:0}] };
    await service.execute("submit", "m1", payload);
    await gateway.createGatewayService({ repository, adapter }).execute("submit", "m1", payload);
    expect(adapter.submit).toHaveBeenCalledOnce();
    await expect(service.execute("submit", "m1", {...payload,route:[]})).rejects.toMatchObject({statusCode:409});
  });
  it("retries an uncertain write with the same command identity", async () => {
    const { adapter, service } = setup();
    adapter.submit.mockRejectedValueOnce(new Error("unavailable"));
    await expect(service.execute("submit", "m2", {commandId:"m2"})).rejects.toThrow("unavailable");
    await service.execute("submit", "m2", {commandId:"m2"});
    expect(adapter.submit.mock.calls.map(([p]) => p.commandId)).toEqual(["m2","m2"]);
  });
  it("redelivers a durable cancellation until a restarted controller acknowledges it", async () => {
    const { repository, adapter, service } = setup();
    const payload = {missionId:"m3"};
    await service.execute("cancel", "m3", payload);
    await gateway.createGatewayService({repository,adapter}).execute("cancel", "m3", payload);
    expect(adapter.cancel).toHaveBeenCalledTimes(2);
    expect(adapter.cancel).toHaveBeenLastCalledWith({...payload,redeliver:true});
  });
  it("allows recovery controls only for the active transfer mission", async () => {
    const {service,adapter}=setup();
    await service.execute("submit","transfer-1",{type:"transfer_object",commandId:"transfer-1"});
    await service.execute("update","resume-1",{type:"resume_transfer",missionId:"transfer-1"});
    expect(adapter.update).toHaveBeenCalledWith(expect.objectContaining({missionId:"transfer-1"}));
    await expect(service.execute("update","resume-other",{type:"resume_transfer",missionId:"other"}))
      .rejects.toMatchObject({statusCode:409});
  });
});
