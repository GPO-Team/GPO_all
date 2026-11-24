const { randomUUID } = require("crypto");
const { validateMissionId, terminalStates } = require("../protocol/mission-contract.cjs");
const { fingerprint, serviceError } = require("../protocol/service-contract.cjs");
const { validatePoints } = require("../protocol/route-validation.cjs");
const { validateTransferCommand } = require("../protocol/transfer-validation.cjs");
const { validatePickPlace } = require("../protocol/manipulator-validation.cjs");
const { prepareRoute } = require("./route-planning.cjs");
const createMissionService = ({repository, adapter, now = () => new Date().toISOString()}) => {
  let pending = Promise.resolve();
  const serial = action => {const result=pending.then(action);pending=result.catch(()=>{});return result;};
  const all = () => repository.list();
  const save = async record => {await repository.save(record);return record;};
  const interrupted = (record, controllerBootId) => save({
    ...record, status: "failed", errorCode: "controller_restarted",
    failureReason: "Webots restarted before the mission finished.",
    controllerBootId, feedbackFresh: false, connectionError: null, updatedAt: now(),
  });
  const deliver = async record => {
    const bootId = record.controllerBootId;
    try {
      if (bootId) await adapter.submit(record.command, bootId);
      else await adapter.submit(record.command);
    } catch (error) {
      if (error.code === "controller_restarted") {
        const currentBootId = await adapter.getControllerSession?.();
        if (bootId && currentBootId && bootId !== currentBootId) return interrupted(record, currentBootId);
      }
      throw error;
    }
    return save({...record,status:"persisted",updatedAt:now(),connectionError:null});
  };
  const refresh = async record => {
    if (!record || terminalStates.has(record.status)) return record;
    let feedback = adapter.getControllerSession ? await adapter.getFeedback(record.missionId) : null;
    const matched = feedback?.missionId === record.missionId;
    if (adapter.getControllerSession && !(matched && terminalStates.has(feedback.status))) {
      const currentBootId = matched && !feedback.cached && feedback.controllerBootId
        ? feedback.controllerBootId : await adapter.getControllerSession();
      const trackedBootId = record.controllerBootId || record.observedControllerBootId;
      if (trackedBootId && currentBootId && trackedBootId !== currentBootId) return interrupted(record, currentBootId);
      if (currentBootId && !trackedBootId && !matched) {
        record = await save({ ...record, observedControllerBootId: currentBootId });
      }
      if (record.status === "prepared" && !matched && (!currentBootId || !record.controllerBootId)) {
        return record;
      }
    }
    if (record.status === "prepared" && !(matched && Object.hasOwn(feedback, "status"))) {
      record = await deliver(record);
      if (terminalStates.has(record.status)) return record;
    }
    if (record.status === "cancelling" && !(matched && terminalStates.has(feedback.status))) {
      // A cancellation remains publishable without replaying an uncertain launch.
      if (!adapter.getControllerSession) await adapter.submit(record.command);
      await adapter.cancel(record.missionId);
      feedback = null;
    }
    if (!feedback) feedback = await adapter.getFeedback(record.missionId);
    const matching=feedback?.missionId===record.missionId;
    const rank={prepared:-1,persisted:0,accepted:1,running:2,holding_for_recovery:3,cancelling:4,completed:5,failed:5,cancelled:5};
    const resumeResult = feedback?.resumeResult;
    const matchedResume = matching && !feedback.cached && record.resumeRequestId &&
      resumeResult?.requestId === record.resumeRequestId &&
      resumeResult.recoveryEpoch === (record.controllerRecoveryEpoch ?? 0);
    const resumed = record.status === "holding_for_recovery" && feedback?.status === "running" &&
      matchedResume && resumeResult.errorCode === null;
    const safelyHeld=["object_transfer","pick_place"].includes(record.operationType) && feedback?.status==="holding_for_recovery";
    const status=matching && feedback.status in rank && (rank[feedback.status]>=rank[record.status] || resumed || safelyHeld) ? feedback.status : record.status;
    const validRecoveryEpoch=matching && !feedback.cached && Number.isSafeInteger(feedback.recoveryEpoch) && feedback.recoveryEpoch>=0;
    const controllerRecoveryEpoch=validRecoveryEpoch ? Math.max(record.controllerRecoveryEpoch || 0,feedback.recoveryEpoch) : record.controllerRecoveryEpoch;
    const advancedRecovery=validRecoveryEpoch && feedback.recoveryEpoch>(record.controllerRecoveryEpoch || 0);
    const enteredRecovery=status==="holding_for_recovery" && (record.status!==status || advancedRecovery);
    const leftRecovery=record.status==="holding_for_recovery" && status!==record.status;
    const rejectedResume = matchedResume && !enteredRecovery && !leftRecovery &&
      status === "holding_for_recovery" &&
      ["invalid_sensor", "attachment_unconfirmed", "recovery_changed"].includes(resumeResult.errorCode);
    const updated={...record,status,controllerRecoveryEpoch,
      ...(rejectedResume ? {resumeRequestId:null,resumeDelivered:false,resumeError:resumeResult.errorCode} : {}),
      ...(enteredRecovery ? {recoveryEpoch:(record.recoveryEpoch || 0)+1,resumeRequestId:null,resumeDelivered:false,resumeError:null} : {}),
      ...(leftRecovery ? {resumeRequestId:null,resumeDelivered:false,resumeError:null} : {}),
      feedbackFresh:Boolean(matching && !feedback.cached),connectionError:null,
      ...(matching ? {stage:feedback.stage ?? null,progress:feedback.progress ?? record.progress,
        errorCode:feedback.errorCode ?? null,attached:feedback.attached === undefined ? record.attached : Boolean(feedback.attached),
        onPlatform:feedback.onPlatform === undefined ? record.onPlatform : Boolean(feedback.onPlatform),
        controllerBootId:feedback.controllerBootId ?? record.controllerBootId,
        objectPose:feedback.objectPose ?? record.objectPose,manipulator:feedback.manipulator ?? record.manipulator} : {}),
      ...(matching && status === "completed" && feedback.deliveryEvidence
        ? {deliveryEvidence:feedback.deliveryEvidence} : {}),
      ...(matching && status === "failed" && typeof feedback.error === "string" ? {failureReason:feedback.error.slice(0,128)} : {}),
      ...(matching ? {lastFeedbackAt:feedback.observedAt || now()} : {}),
      updatedAt:status!==record.status ? now() : record.updatedAt};
    // Do not rewrite SQLite on every idle poll without a changed observation.
    return JSON.stringify(updated)===JSON.stringify(record) ? record : save(updated);
  };
  const submit = (payload,{requestId=randomUUID()}={}) => serial(async()=>{
    if (!["route", "start_mapping_survey", "pick_place", "transfer_object"].includes(payload?.type)) throw serviceError(400,"unsupported_command","Unsupported mission command.");
    const missionId=validateMissionId(requestId || randomUUID());
    const hash=fingerprint(payload);
    let record=await repository.get(missionId);
    if(record && record.fingerprint!==hash) throw serviceError(409,"id_conflict","Mission ID belongs to another command.");
    if(record && record.status!=="prepared") return record;
    if(!record) {
      const active=(await all()).find(item=>!terminalStates.has(item.status));
      if(active) throw serviceError(409,"mission_active",`Mission ${active.missionId} is active. Cancel it and wait for confirmation before replacing it.`);
      const survey=payload.type==="start_mapping_survey";
      const pick=payload.type==="pick_place";
      const operationType=payload?.type==="transfer_object" ? "object_transfer" : pick ? "pick_place" : survey ? "survey" : "route";
      let command;
      if(operationType==="object_transfer") command={...validateTransferCommand(payload),commandId:missionId};
      else if(pick) command={...validatePickPlace(payload),commandId:missionId};
      else if(survey) command={...payload,commandId:missionId};
      else command={...payload,route:validatePoints(payload.route),commandId:missionId};
      if(operationType==="route" && payload.scene) {
        const result=await prepareRoute({seedRoute:payload.seedRoute || payload.route,scene:payload.scene});
        command={...command,route:result.route,scene:result.scene,motion:result.scene.motion,sceneRevision:result.sceneRevision,planning:result.planning};
      }
      if(operationType==="route" && command.route.length<2) throw serviceError(400,"invalid_route","At least two route points are required.");
      const controllerBootId = await adapter.getControllerSession?.();
      if (adapter.getControllerSession && !controllerBootId) {
        throw serviceError(503, "controller_unavailable", "Webots controller telemetry is unavailable.");
      }
      record = { missionId, operationType, fingerprint: hash, status: "prepared", createdAt: now(),
        updatedAt: now(), command, ...(controllerBootId ? { controllerBootId } : {}) };
      await save(record);
      return deliver(record);
    }
    return adapter.getControllerSession ? refresh(record) : deliver(record);
  });
  const cancel = missionId => serial(async()=>{
    let record=await repository.get(validateMissionId(missionId));
    if(!record) throw serviceError(404,"not_found","Mission not found.");
    if(terminalStates.has(record.status)) return record;
    record=await save({...record,status:"cancelling",updatedAt:now()});
    // Intent stays durable even when the gateway is unavailable.
    try { return await refresh(record); } catch (error) {
      const current = await repository.get(record.missionId);
      return save({ ...current, feedbackFresh: false, connectionError: error.message });
    }
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
      try {await refresh(record);} catch (error) {
        const current = await repository.get(record.missionId);
        if (!terminalStates.has(current.status)) await save({...current,feedbackFresh:false,connectionError:error.message});
      }
    }
  });
  const update = (payload,{requestId=randomUUID()}={}) => serial(async()=>{
    if(["start_mapping_survey", "pick_place", "transfer_object"].includes(payload?.type)) throw serviceError(400,"mission_required","Movement commands must be submitted as missions.");
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
    await adapter.update({
      type:"resume_transfer",missionId:record.missionId,destination:record.command.destination,
      recoveryEpoch:record.controllerRecoveryEpoch ?? 0,controllerBootId:record.controllerBootId,
    },resumeRequestId);
    return save({...record,resumeDelivered:true,resumeError:null,connectionError:null,updatedAt:now()});
  });
  return {submit,cancel,get,reconcile,update,resume,list:()=>serial(all),drain:()=>pending};
};
module.exports={createMissionService};
