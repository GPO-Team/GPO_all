const http = require("http");
const { timingSafeEqual, randomUUID } = require("crypto");
const { sendJson, sendError, readJson } = require("./service-http.cjs");
const { envelope, validateEnvelope, serviceError } = require("../protocol/service-contract.cjs");
const { validateMissionId } = require("../protocol/mission-contract.cjs");
const createGatewayServer = ({host,port,token="",service,telemetrySource,ready,closeResources=async()=>{}}) => {
  if (!["127.0.0.1","localhost","::1"].includes(host) && !token) throw new Error("GATEWAY_TOKEN is required for a non-loopback gateway.");
  const bootId=randomUUID();
  let latest = null, revision = 0, telemetryAt = 0, polling = false, activePoll;
  const poll = () => {
    if(polling)return;
    polling=true;
    activePoll=(async()=>{
      try {
        await ready();
        const value=await telemetrySource.poll();
        await service.collect();
        if(value){latest=value;revision++;telemetryAt=telemetrySource.getObservedAt?.() || Date.now();}
      } catch(error) {console.error(JSON.stringify({service:"gateway",code:"telemetry_read_failed",error:error.message}));}
      finally {polling=false;}
    })();
  };
  const timer=setInterval(poll,120);
  const server=http.createServer(async(request,response)=>{
    try {
      if(token) {
        const actual=Buffer.from(request.headers.authorization || ""), expected=Buffer.from(`Bearer ${token}`);
        if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw serviceError(401,"unauthorized","Invalid gateway credentials.");
      }
      const pathname=new URL(request.url,"http://localhost").pathname;
      if(request.method==="GET" && pathname==="/health") return sendJson(response,200,envelope({service:"gateway"}));
      if(request.method==="GET" && pathname==="/ready") {await ready();return sendJson(response,200,envelope({service:"gateway"}));}
      if(request.method==="GET" && pathname==="/v1/telemetry") return sendJson(response,200,envelope({revision:`${bootId}:${revision}`,telemetry:latest,fresh:Date.now()-telemetryAt<5000}));
      if (request.method === "GET" && pathname === "/v1/controller-session") {
        return sendJson(response, 200, envelope(await service.getControllerSession()));
      }
      if(request.method==="GET" && pathname.startsWith("/v1/feedback/")) {
        const id=validateMissionId(decodeURIComponent(pathname.slice("/v1/feedback/".length)));
        return sendJson(response,200,envelope(await service.getFeedback(id)));
      }
      if(request.method==="POST" && pathname==="/v1/commands") {
        await ready();
        const body=validateEnvelope(await readJson(request));
        validateMissionId(body.requestId);
        if(!body.payload || typeof body.payload!=="object") throw serviceError(400,"invalid_payload","Command payload required.");
        if(body.operation==="submit" && body.payload.commandId!==body.requestId) throw serviceError(400,"id_mismatch","Command identity mismatch.");
        if(body.operation==="cancel" && body.payload.missionId!==body.requestId) throw serviceError(400,"id_mismatch","Cancellation identity mismatch.");
        return sendJson(response,200,envelope(await service.execute(body.operation,body.requestId,body.payload,body.controllerBootId)));
      }
      throw serviceError(404,"not_found","Endpoint not found.");
    } catch(error) {sendError(response,error);}
  });
  server.requestTimeout=10000;
  server.headersTimeout=10000;
  server.listen(port,host);
  return {server,async close(){clearInterval(timer);await activePoll;await service.drain();await new Promise(resolve=>server.close(resolve));await closeResources();}};
};
module.exports={createGatewayServer};
