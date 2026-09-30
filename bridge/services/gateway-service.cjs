const { fingerprint, serviceError } = require("../protocol/service-contract.cjs");
const { validateMissionId } = require("../protocol/mission-contract.cjs");
const createGatewayService = ({repository, adapter}) => {
  let pending = Promise.resolve();
  const feedbackFor = async missionId => {
    const feedback=await adapter.getFeedback(missionId);
    const active=await repository.get("gateway-active");
    if(feedback && ["completed","failed","cancelled"].includes(feedback.status) && active?.commandId===missionId) {
      await repository.save({...active,status:feedback.status,feedback});
    }
    if(feedback)return feedback;
    return active?.commandId===missionId && active.feedback ? {...active.feedback,cached:true} : null;
  };
  const execute = (operation, requestId, payload) => {
    const task = pending.then(async () => {
      validateMissionId(requestId);
      if (!["submit", "update", "cancel"].includes(operation)) throw serviceError(400, "invalid_operation", "Unknown operation.");
      if (operation === "update" && payload?.type === "start_mapping_survey") throw serviceError(400,"mission_required","Mapping surveys must be submitted as missions.");
      const hash = fingerprint({operation, payload});
      const key = fingerprint({operation, requestId}).slice(0, 63);
      let record = await repository.get(key);
      if (record && record.fingerprint !== hash) throw serviceError(409, "id_conflict", "Request ID belongs to another command.");
      if (record?.status === "delivered") {
        // A controller started after this journal entry deliberately ignores old
        // runtime commands. Cancellation is safe to publish again and gives the
        // new controller a fresh command id without replaying robot movement.
        if (operation === "cancel") await adapter.cancel({...payload,redeliver:true});
        return record.result;
      }
      const active=await repository.get("gateway-active");
      if (active && !["completed","failed","cancelled"].includes(active.status) && (operation === "update" || (operation === "submit" && active.commandId !== requestId))) {
        const feedback=await feedbackFor(active.commandId);
        if (!feedback || !["completed","failed","cancelled"].includes(feedback.status)) throw serviceError(409,"robot_busy","Robot has an active command.");
      }
      if(operation === "submit") await repository.save({missionId:"gateway-active",commandId:requestId});
      if (!record) {
        record = {missionId:key, fingerprint:hash, status:"prepared", operation, payload};
        await repository.save(record);
      }
      const result = await adapter[operation](operation === "update" ? {...payload,requestKey:requestId} : payload);
      if (result === false) throw serviceError(400, "unsupported_command", "Unsupported simulator command.");
      record = {...record, status:"delivered", result:{accepted:true, requestId}};
      await repository.save(record);
      return record.result;
    });
    pending = task.catch(() => {});
    return task;
  };
  const collect = () => {
    const task=pending.then(async()=>{const active=await repository.get("gateway-active");if(active && !active.feedback)await feedbackFor(active.commandId);});
    pending=task.catch(()=>{});return task;
  };
  const getFeedback = missionId => {
    const task=pending.then(()=>feedbackFor(missionId));pending=task.catch(()=>{});return task;
  };
  return {execute,getFeedback,collect,drain:() => pending};
};
module.exports = {createGatewayService};
