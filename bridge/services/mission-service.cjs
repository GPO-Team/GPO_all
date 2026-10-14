const { randomUUID } = require("crypto");
const { validateMissionId, terminalStates } = require("../protocol/mission-contract.cjs");
const { fingerprint, serviceError } = require("../protocol/service-contract.cjs");
const { validatePoints } = require("../protocol/route-validation.cjs");
const { prepareRoute } = require("./route-planning.cjs");
const { validatePickPlace } = require("../protocol/manipulator-validation.cjs");
const createMissionService = ({repository, adapter, now = () => new Date().toISOString()}) => {
  let pending = Promise.resolve();
  const serial = action => {const result=pending.then(action);pending=result.catch(()=>{});return result;};
  const all = () => repository.list();
  const save = async record => {await repository.save(record);return record;};
  const deliver = async record => {
    await adapter.submit(record.command);
    return save({...record,status:"persisted",updatedAt:now(),connectionError:null});
  };
  const refresh = async record => {
    if(!record || terminalStates.has(record.status)) return record;
    if(record.status==="prepared") record=await deliver(record);
    if(record.status==="cancelling") {
      // Submission may have reached the gateway before its reply was lost.
      // Ensure the same command exists before sending its durable cancellation.
      await adapter.submit(record.command);
      await adapter.cancel(record.missionId);
    }
    const feedback=await adapter.getFeedback(record.missionId);
    const matching=feedback?.missionId===record.missionId;
    const rank={persisted:0,accepted:1,running:2,cancelling:3,completed:4,failed:4,cancelled:4};
    const status=matching && feedback.status in rank && rank[feedback.status]>=rank[record.status] ? feedback.status : record.status;
    const updated={...record,status,feedbackFresh:Boolean(matching && !feedback.cached),connectionError:null,
      ...(matching && status === "failed" && typeof feedback.error === "string" ? {failureReason:feedback.error.slice(0,128)} : {}),
      ...(matching ? {lastFeedbackAt:feedback.observedAt || now()} : {}),
      updatedAt:status!==record.status ? now() : record.updatedAt};
    // Do not rewrite SQLite on every idle poll without a changed observation.
    return JSON.stringify(updated)===JSON.stringify(record) ? record : save(updated);
  };
  const submit = (payload,{requestId=randomUUID()}={}) => serial(async()=>{
    if (!["route", "start_mapping_survey", "pick_place"].includes(payload?.type)) throw serviceError(400,"unsupported_command","Unsupported mission command.");
    const missionId=validateMissionId(requestId || randomUUID());
    const hash=fingerprint(payload);
    let record=await repository.get(missionId);
    if(record && record.fingerprint!==hash) throw serviceError(409,"id_conflict","Mission ID belongs to another command.");
    if(record && record.status!=="prepared") return record;
    if(!record) {
      const active=(await all()).find(item=>!terminalStates.has(item.status));
      if(active) throw serviceError(409,"mission_active",`Mission ${active.missionId} is active. Cancel it and wait for confirmation before replacing it.`);
      const survey = payload.type === "start_mapping_survey";
      const manipulation = payload.type === "pick_place";
      let command=manipulation ? {...validatePickPlace(payload),commandId:missionId} : survey ? {...payload,commandId:missionId} : {...payload,route:validatePoints(payload.route),commandId:missionId};
      if(!survey && !manipulation && payload.scene) {
        const result=await prepareRoute({seedRoute:payload.seedRoute || payload.route,scene:payload.scene});
        command={...command,route:result.route,scene:result.scene,motion:result.scene.motion,sceneRevision:result.sceneRevision,planning:result.planning};
      }
      if(!survey && !manipulation && command.route.length<2) throw serviceError(400,"invalid_route","At least two route points are required.");
      record={missionId,fingerprint:hash,status:"prepared",createdAt:now(),updatedAt:now(),command};
      await save(record);
    }
    return deliver(record);
  });
  const cancel = missionId => serial(async()=>{
    let record=await repository.get(validateMissionId(missionId));
    if(!record) throw serviceError(404,"not_found","Mission not found.");
    if(terminalStates.has(record.status)) return record;
    record=await save({...record,status:"cancelling",updatedAt:now()});
    // Intent stays durable even when the gateway is unavailable.
    try {return await refresh(record);} catch(error) {return save({...record,feedbackFresh:false,connectionError:error.message});}
  });
  const get = missionId => serial(async()=>{
    const record=await repository.get(validateMissionId(missionId));
    try {return await refresh(record);} catch(error) {
      if(!record) throw error;
      return {...record,feedbackFresh:false,connectionError:error.message};
    }
  });
  const reconcile = () => serial(async()=>{
    for(const record of await all()) {
      if(terminalStates.has(record.status)) continue;
      try {await refresh(record);} catch(error) {await save({...record,feedbackFresh:false,connectionError:error.message});}
    }
  });
  const update = (payload,{requestId=randomUUID()}={}) => serial(async()=>{
    if(["start_mapping_survey", "pick_place"].includes(payload?.type)) throw serviceError(400,"mission_required","Movement commands must be submitted as missions.");
    if((await all()).some(record=>!terminalStates.has(record.status))) throw serviceError(409,"mission_active","Scene changes are blocked while a mission is active.");
    return adapter.update(payload,requestId || randomUUID());
  });
  return {submit,cancel,get,reconcile,update,list:()=>serial(all),drain:()=>pending};
};
module.exports={createMissionService};
