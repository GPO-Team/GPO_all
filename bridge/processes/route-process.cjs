const {createGatewayClient} = require("../adapters/gateway-http-client.cjs");
const path = require("path");
const {createSqliteRepository} = require("../repositories/sqlite-repository.cjs");
const {createWarehouseRepository} = require("../repositories/warehouse-repository.cjs");
const {createWarehouseService} = require("../services/warehouse-service.cjs");
const {createMissionService} = require("../services/mission-service.cjs");
const {createRouteService} = require("../services/route-service.cjs");
const defaultConfig = require("../config/runtime-config.cjs");
const {createRouteServer:defaultCreateRouteServer} = require("../servers/route-server.cjs");
const startRouteProcess = ({config=defaultConfig,createRouteServer=defaultCreateRouteServer,
  createSimulatorAdapter=createGatewayClient,createMissionRepository=createSqliteRepository,
  createWarehouseStorage=createSqliteRepository}={}) => {
  const adapter=createSimulatorAdapter({baseUrl:config.GATEWAY_URL,token:config.GATEWAY_TOKEN});
  const repository=createMissionRepository({directory:config.MISSION_STATE_DIR});
  const warehouseStorage=createWarehouseStorage({directory:path.join(config.MISSION_STATE_DIR,"warehouse")});
  const warehouseRepository=createWarehouseRepository({repository:warehouseStorage});
  const warehouseService=createWarehouseService({repository:warehouseRepository});
  const missionService=createMissionService({repository,adapter});
  const routeService=createRouteService({missionService});
  let inFlight=false, stopped=false, tickPromise;
  const tick=async()=>{
    if(inFlight || stopped)return;
    inFlight=true;
    try {await repository.ready();await missionService.reconcile();}
    catch(error){console.error(JSON.stringify({service:"missions",code:"reconcile_failed",error:error.message}));}
    finally {inFlight=false;}
  };
  const timer=setInterval(()=>{tickPromise=tick();},1000);
  timer.unref();
  const server=createRouteServer({routeService,missionService,warehouseService,
    ready:async()=>{await repository.ready();await adapter.ready();},
    host:config.ROUTE_BIND_HOST || config.BRIDGE_HOST,port:config.ROUTE_PORT});
  const close=server.close;
  server.close=async()=>{
    stopped=true;clearInterval(timer);
    try {await tickPromise;await close();}
    finally {
      // Release each owned resource even when another cleanup step fails.
      try {await warehouseService.drain();}
      finally {
        try {await adapter.close?.();}
        finally {try {await repository.close?.();} finally {await warehouseRepository.close?.();}}
      }
    }
  };
  return server;
};
module.exports={startRouteProcess};
