const labels = {prepared:"Подготовлена, отправка не подтверждена",persisted:"Сохранена, ожидается контроллер",accepted:"Принята контроллером",running:"Выполняется",cancelling:"Отмена запрошена, ожидается остановка",completed:"Завершена",failed:"Ошибка исполнения",cancelled:"Отменена"};
const measurement = value => Number.isFinite(value) ? value.toFixed(3) : "—";
const vector = values => Array.isArray(values) ? values.map(measurement).join(", ") : null;
const evidence = value => value === true ? "да" : value === false ? "нет" : "нет измерения";
export default function PlannerMissionStatus({mission,onCancel,onResume}) {
  if (!mission) return null;
  const manipulator = mission.manipulator;
  const parkingRecovery = mission.attached === false;
  const attachmentLost = !parkingRecovery && manipulator?.attachmentEvidence === false;
  const stages={approaching_object:"Подъезд к объекту",aligning:"Выравнивание",lowering_arm:"Опускание манипулятора",grasping:"Захват",lifting:"Подъём",transporting:"Перевозка",placing:"Размещение",releasing:"Отпускание",returning_arm:"Возврат манипулятора"};
  return <section className="rounded-xl border border-slate-200 bg-white p-3 text-sm" aria-label="Состояние миссии">
    <div className="font-semibold">{mission.operationType === "object_transfer" ? "Перенос объекта" : "Исполнение маршрута"}</div>
    <div role="status" className="mt-1">{mission.status === "holding_for_recovery" ? parkingRecovery ? "Манипулятор остановлен: требуется возврат" : "Удержание объекта: требуется восстановление" : labels[mission.status] || "Состояние неизвестно"}</div>
    {mission.operationType === "object_transfer" && <>
      <div className="mt-1 text-xs text-slate-600">{stages[mission.stage] || "Подготовка"} · {Math.round(mission.progress || 0)}%</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-orange-500 transition-all" style={{width:`${Math.max(0,Math.min(100,mission.progress || 0))}%`}} /></div>
      {mission.attached && !attachmentLost && <div className="mt-1 text-xs font-medium text-emerald-700">Объект в захвате</div>}
    </>}
    <div className="mt-1 break-all text-xs text-slate-500">ID: {mission.missionId}</div>
    {mission.errorCode && <div className="mt-1 break-all text-red-700">Ошибка контроллера: {mission.errorCode}</div>}
    {mission.actionError && <div role="alert" className="mt-1 text-red-700">{mission.actionError}</div>}
    {manipulator && <details className="mt-2 text-xs text-slate-600" open={mission.status === "holding_for_recovery"}>
      <summary>Измерения манипулятора</summary>
      {Array.isArray(manipulator.jointPositions) && <div>Суставы, рад: {vector(manipulator.jointPositions)}</div>}
      {Array.isArray(manipulator.jointTargets) && <div>Цели суставов, рад: {vector(manipulator.jointTargets)}</div>}
      {Array.isArray(manipulator.fingerPositions) && <div>Пальцы, м: {vector(manipulator.fingerPositions)}</div>}
      {Array.isArray(manipulator.fingerTargets) && <div>Цели пальцев, м: {vector(manipulator.fingerTargets)}</div>}
      {Array.isArray(manipulator.motorEfforts) && <div>Усилия приводов: {vector(manipulator.motorEfforts)}</div>}
      {manipulator.tcpPose && <div>TCP, м: {vector([manipulator.tcpPose.x,manipulator.tcpPose.y,manipulator.tcpPose.z])}</div>}
      {manipulator.sensorValidity !== undefined && <div>Датчики исправны: {evidence(manipulator.sensorValidity)}</div>}
      {manipulator.gripEvidence !== undefined && <div>Контакт захвата: {evidence(manipulator.gripEvidence)}</div>}
      {manipulator.attachmentEvidence !== undefined && <div>Удержание подтверждено: {evidence(manipulator.attachmentEvidence)}</div>}
      {manipulator.releaseEvidence !== undefined && <div>Безопасное отпускание: {evidence(manipulator.releaseEvidence)}</div>}
      {manipulator.kinematicsError != null && <div>Ошибка кинематики: {String(manipulator.kinematicsError)}</div>}
    </details>}
    {mission.connectionError && <div className="mt-1 text-amber-700">Нет связи с сервисом. Показано последнее известное состояние.</div>}
    {!mission.connectionError && mission.feedbackFresh === false && !["completed","cancelled","failed"].includes(mission.status) && <div className="mt-1 text-amber-700">Нет свежего подтверждения от контроллера.</div>}
    {mission.status === "holding_for_recovery" && attachmentLost && <div className="mt-1 text-amber-700">Продолжение доступно после восстановления захвата.</div>}
    {onResume && mission.operationType === "object_transfer" && mission.status === "holding_for_recovery" && <button type="button" className="mt-2 mr-2 rounded border border-orange-300 px-3 py-1 text-orange-700 disabled:opacity-50" disabled={Boolean(mission.actionPending || mission.resumeDelivered || attachmentLost)} onClick={onResume}>{mission.resumeDelivered ? "Ожидается продолжение" : mission.actionPending === "resume" ? "Продолжение запрошено" : parkingRecovery ? "Вернуть манипулятор" : "Продолжить перенос"}</button>}
    {onCancel && !["completed","cancelled","failed"].includes(mission.status) && <button type="button" className="mt-2 rounded border border-red-300 px-3 py-1 text-red-700 disabled:opacity-50" disabled={mission.status === "cancelling" || Boolean(mission.actionPending)} onClick={onCancel}>Отменить миссию</button>}
  </section>;
}
