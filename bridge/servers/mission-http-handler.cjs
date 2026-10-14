const {isAllowedOrigin}=require("../protocol/origin-policy.cjs");
const {sendJson,sendError}=require("./service-http.cjs");
const publicMission = mission => ({ok:true,missionId:mission.missionId,status:mission.status,
  failureReason:mission.failureReason || null,
  sceneRevision:mission.command.sceneRevision,createdAt:mission.createdAt,updatedAt:mission.updatedAt,
  feedbackFresh:mission.feedbackFresh,lastFeedbackAt:mission.lastFeedbackAt,connectionError:mission.connectionError});
const createMissionHttpHandler = ({missionService,getStatus,ready=async()=>true}) => async(request,response)=>{
  if(!isAllowedOrigin(request.headers.origin))return sendJson(response,403,{ok:false,error:"Origin is not allowed."});
  if(request.headers.origin){response.setHeader("Access-Control-Allow-Origin",request.headers.origin);response.setHeader("Vary","Origin");}
  if(request.method==="OPTIONS"){
    response.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers","Content-Type");response.writeHead(204);response.end();return;
  }
  try {
    const pathname=new URL(request.url,"http://localhost").pathname;
    if(request.method==="GET" && pathname==="/health")return sendJson(response,200,{ok:true,service:"missions",...getStatus()});
    if(request.method==="GET" && pathname==="/ready"){await ready();return sendJson(response,200,{ok:true,service:"missions"});}
    if(request.method==="GET" && pathname==="/api/missions")return sendJson(response,200,{ok:true,missions:(await missionService.list()).map(publicMission)});
    const match=pathname.match(/^\/api\/missions\/([^/]+)(\/cancel)?$/);
    if(match && missionService){
      const id=decodeURIComponent(match[1]);
      if(request.method==="POST" && match[2])return sendJson(response,202,publicMission(await missionService.cancel(id)));
      if(request.method==="GET" && !match[2]){
        const mission=await missionService.get(id);
        return mission ? sendJson(response,200,publicMission(mission)) : sendJson(response,404,{ok:false,error:"Mission not found."});
      }
    }
    sendJson(response,404,{ok:false,error:"Not found."});
  } catch(error){sendError(response,error);}
};
module.exports={createMissionHttpHandler};
