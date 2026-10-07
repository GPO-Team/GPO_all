const { randomUUID } = require("crypto");
const { validateMissionId, terminalStates } = require("../protocol/mission-contract.cjs");
const { fingerprint, serviceError } = require("../protocol/service-contract.cjs");
const { validatePoints } = require("../protocol/route-validation.cjs");
const { validateTransferCommand } = require("../protocol/transfer-validation.cjs");
const { prepareRoute } = require("./route-planning.cjs");
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
    const rank={persisted:0,accepted:1,running:2,holding_for_recovery:3,cancelling:4,completed:5,failed:5,cancelled:5};
    const resumed=record.status==="holding_for_recovery" && feedback?.status==="running" && !feedback.cached && Boolean(record.resumeRequestId);
    const safelyHeld=record.operationType==="object_transfer" && feedback?.status==="holding_for_recovery";
    const status=matching && feedback.status in rank && (rank[feedback.status]>=rank[record.status] || resumed || safelyHeld) ? feedback.status : record.status;
    const validRecoveryEpoch=matching && !feedback.cached && Number.isSafeInteger(feedback.recoveryEpoch) && feedback.recoveryEpoch>=0;
    const controllerRecoveryEpoch=validRecoveryEpoch ? Math.max(record.controllerRecoveryEpoch || 0,feedback.recoveryEpoch) : record.controllerRecoveryEpoch;
    const advancedRecovery=validRecoveryEpoch && feedback.recoveryEpoch>(record.controllerRecoveryEpoch || 0);
    const enteredRecovery=status==="holding_for_recovery" && (record.status!==status || advancedRecovery);
    const leftRecovery=record.status==="holding_for_recovery" && status!==record.status;
    const updated={...record,status,controllerRecoveryEpoch,
      ...(enteredRecovery ? {recoveryEpoch:(record.recoveryEpoch || 0)+1,resumeRequestId:null,resumeDelivered:false} : {}),
      ...(leftRecovery ? {resumeRequestId:null,resumeDelivered:false} : {}),
      feedbackFresh:Boolean(matching && !feedback.cached),connectionError:null,
      ...(matching ? {stage:feedback.stage ?? null,progress:feedback.progress ?? record.progress,
        errorCode:feedback.errorCode ?? null,attached:feedback.attached === undefined ? record.attached : Boolean(feedback.attached),
        controllerBootId:feedback.controllerBootId ?? record.controllerBootId,
        objectPose:feedback.objectPose ?? record.objectPose,manipulator:feedback.manipulator ?? record.manipulator} : {}),
      ...(matching ? {lastFeedbackAt:feedback.observedAt || now()} : {}),
      updatedAt:status!==record.status ? now() : record.updatedAt};
    // Do not rewrite SQLite on every idle poll without a changed observation.
    return JSON.stringify(updated)===JSON.stringify(record) ? record : save(updated);
  };
  const submit = (payload,{requestId=randomUUID()}={}) => serial(async()=>{
    const missionId=validateMissionId(requestId || randomUUID());
    const hash=fingerprint(payload);
    let record=await repository.get(missionId);
    if(record && record.fingerprint!==hash) throw serviceError(409,"id_conflict","Mission ID belongs to another command.");
    if(record && record.status!=="prepared") return record;
    if(!record) {
      const active=(await all()).find(item=>!terminalStates.has(item.status));
      if(active) throw serviceError(409,"mission_active",`Mission ${active.missionId} is active. Cancel it and wait for confirmation before replacing it.`);
      const operationType=payload?.type==="transfer_object" ? "object_transfer" : "route";
      let command;
      if(operationType==="object_transfer") command={...validateTransferCommand(payload),commandId:missionId};
      else command={...payload,route:validatePoints(payload.route),commandId:missionId};
      if(operationType==="route" && payload.scene) {
        const result=await prepareRoute({seedRoute:payload.seedRoute || payload.route,scene:payload.scene});
        command={...command,route:result.route,scene:result.scene,motion:result.scene.motion,sceneRevision:result.sceneRevision,planning:result.planning};
      }
      if(operationType==="route" && command.route.length<2) throw serviceError(400,"invalid_route","At least two route points are required.");
      record={missionId,operationType,fingerprint:hash,status:"prepared",createdAt:now(),updatedAt:now(),command};
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
    if((await all()).some(record=>!terminalStates.has(record.status))) throw serviceError(409,"mission_active","Scene changes are blocked while a mission is active.");
    return adapter.update(payload,requestId || randomUUID());
  });
  const resume = missionId => serial(async()=>{
    let record=await repository.get(validateMissionId(missionId));
    if(!record) throw serviceError(404,"not_found","Mission not found.");
    if(record.operationType!=="object_transfer" || record.status!=="holding_for_recovery") {
      throw serviceError(409,"not_recoverable","Only a held object transfer can be resumed.");
    }
    record=await refresh(record);
    if(record.status!=="holding_for_recovery") {
      throw serviceError(409,"not_recoverable","Only a held object transfer can be resumed.");
    }
    if(record.attached!==false && record.feedbackFresh && record.manipulator?.attachmentEvidence===false) {
      throw serviceError(409,"attachment_unconfirmed","Physical attachment is not confirmed. Restore the grip before resuming.");
    }
    if(record.resumeDelivered)return record;
    const resumeRequestId=record.resumeRequestId || randomUUID();
    if(!record.resumeRequestId)record=await save({...record,resumeRequestId,updatedAt:now()});
    await adapter.update({type:"resume_transfer",missionId:record.missionId,destination:record.command.destination},resumeRequestId);
    return save({...record,resumeDelivered:true,connectionError:null,updatedAt:now()});
  });
  return {submit,cancel,get,reconcile,update,resume,list:()=>serial(all),drain:()=>pending};
};
module.exports={createMissionService};
