const { fingerprint, serviceError } = require("../protocol/service-contract.cjs");
const { validateMissionId } = require("../protocol/mission-contract.cjs");
const createGatewayService = ({repository, adapter}) => {
  let pending = Promise.resolve();
  const terminal = status => ["completed", "failed", "cancelled"].includes(status);
  const observe = async missionId => adapter.observeMission
    ? adapter.observeMission(missionId)
    : { controllerBootId: null, feedback: await adapter.getFeedback(missionId) };
  const getControllerSession = async () => adapter.observeMission
    ? (await adapter.observeMission()).controllerBootId
    : null;
  const feedbackFor = async missionId => {
    const { controllerBootId, feedback } = await observe(missionId);
    const active = await repository.get("gateway-active");
    if (active?.commandId !== missionId) return feedback;
    if (active.feedback) {
      return feedback?.status === active.feedback.status && feedback.errorCode === active.feedback.errorCode
        ? feedback : { ...active.feedback, cached: true };
    }

    let terminalFeedback = feedback && terminal(feedback.status) ? feedback : null;
    if (!terminalFeedback && controllerBootId && active.controllerBootId && controllerBootId !== active.controllerBootId) {
      terminalFeedback = { missionId, status: "failed", errorCode: "controller_restarted",
        error: "Webots restarted before the mission finished.", controllerBootId };
    }
    if (terminalFeedback) {
      await repository.save({ ...active, status: terminalFeedback.status, feedback: terminalFeedback });
      return terminalFeedback;
    }
    if (controllerBootId && !active.controllerBootId) await repository.save({ ...active, controllerBootId });
    return feedback;
  };
  const execute = (operation, requestId, payload, expectedControllerBootId) => {
    const task = pending.then(async () => {
      validateMissionId(requestId);
      if (!["submit", "update", "cancel"].includes(operation)) throw serviceError(400, "invalid_operation", "Unknown operation.");
      if (operation === "submit" && payload?.commandId !== requestId) throw serviceError(400, "command_id_mismatch", "Submitted command ID must match the request ID.");
      if (operation === "update" && ["start_mapping_survey", "pick_place"].includes(payload?.type)) throw serviceError(400,"mission_required","Movement commands must be submitted as missions.");
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
      const sameMissionControl=operation==="update" && ["recover_transfer","resume_transfer"].includes(payload?.type) && payload.missionId===active?.commandId;
      if (active && !terminal(active.status) && (!sameMissionControl && (operation === "update" || (operation === "submit" && active.commandId !== requestId)))) {
        const feedback=await feedbackFor(active.commandId);
        if (!feedback || !terminal(feedback.status)) throw serviceError(409,"robot_busy","Robot has an active command.");
      }
      let controllerBootId;
      if (operation === "submit") {
        await adapter.validateSubmit?.(payload);
        if (adapter.observeMission) {
          controllerBootId = await getControllerSession();
          if (!controllerBootId) throw serviceError(503, "controller_unavailable", "Webots controller telemetry is unavailable.");
          if (record && !record.controllerBootId) {
            throw serviceError(409, "controller_session_unknown", "The prepared command has no recorded Webots session.");
          }
          const expected = record?.controllerBootId || expectedControllerBootId;
          if (expected && expected !== controllerBootId) {
            throw serviceError(409, "controller_restarted", "Webots restarted before the mission could be delivered.");
          }
        }
      }
      if (!record) {
        record = { missionId: key, fingerprint: hash, status: "prepared", operation, payload,
          ...(controllerBootId ? { controllerBootId } : {}) };
        await repository.save(record);
      }
      if (operation === "submit" && active?.commandId !== requestId) {
        await repository.save({ missionId: "gateway-active", commandId: requestId,
          ...(controllerBootId ? { controllerBootId } : {}) });
      }
      const result = operation === "submit" && controllerBootId
        ? await adapter.submit(payload, controllerBootId)
        : await adapter[operation](operation === "update" ? { ...payload, requestKey: requestId } : payload);
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
  return {execute,getFeedback,getControllerSession,collect,drain:() => pending};
};
module.exports = {createGatewayService};
