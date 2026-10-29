import {expect,it,vi} from "vitest";
import path from "node:path";
import module from "./route-process.cjs";
it("composes missions with private storage and a network simulator port", async()=>{
  const adapter={ready:vi.fn(),close:vi.fn()};
  const repository={ready:vi.fn(),close:vi.fn()};
  const createSimulatorAdapter=vi.fn(()=>adapter);
  const createMissionRepository=vi.fn(()=>repository);
  const warehouseStorage={ready:vi.fn(),close:vi.fn(),get:vi.fn(async()=>null),save:vi.fn()};
  const createWarehouseStorage=vi.fn(()=>warehouseStorage);
  const close=vi.fn(async()=>{});
  const createRouteServer=vi.fn(()=>({close}));
  const server=module.startRouteProcess({config:{GATEWAY_URL:"http://robot:9004",GATEWAY_TOKEN:"test",MISSION_STATE_DIR:"/missions",BRIDGE_HOST:"127.0.0.1",ROUTE_PORT:9002},createSimulatorAdapter,createMissionRepository,createWarehouseStorage,createRouteServer});
  expect(createSimulatorAdapter).toHaveBeenCalledWith({baseUrl:"http://robot:9004",token:"test"});
  expect(createMissionRepository).toHaveBeenCalledWith({directory:"/missions"});
  expect(createWarehouseStorage).toHaveBeenCalledWith({directory:path.join("/missions","warehouse")});
  const warehouseService=createRouteServer.mock.calls[0][0].warehouseService;
  expect((await warehouseService.get()).warehouse.racks).toEqual([]);
  await createRouteServer.mock.calls[0][0].ready();
  expect(adapter.ready).toHaveBeenCalledOnce();
  await server.close();expect(repository.close).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
  expect(warehouseStorage.close).toHaveBeenCalledOnce();expect(adapter.close).toHaveBeenCalledOnce();
});

it("closes all process resources even if server shutdown fails",async()=>{
  const adapter={close:vi.fn()};
  const repository={close:vi.fn()};
  const warehouseStorage={close:vi.fn()};
  const server=module.startRouteProcess({config:{MISSION_STATE_DIR:"/missions"},
    createSimulatorAdapter:()=>adapter,createMissionRepository:()=>repository,createWarehouseStorage:()=>warehouseStorage,
    createRouteServer:()=>({close:async()=>{throw new Error("shutdown failed");}})});
  await expect(server.close()).rejects.toThrow("shutdown failed");
  expect(adapter.close).toHaveBeenCalledOnce();expect(repository.close).toHaveBeenCalledOnce();expect(warehouseStorage.close).toHaveBeenCalledOnce();
});
