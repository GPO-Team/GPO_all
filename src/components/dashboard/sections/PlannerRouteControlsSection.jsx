import HelpHint from "../HelpHint";
import {
  ROUTE_CLEARANCE_MARGIN,
  SAFE_POINT_MARGIN,
} from "../../../lib/zonePlanner";

const actionPaths = {
  build: "M5 5h10a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h10M3 3h4v4H3zM17 17h4v4h-4z",
  send: "m3 3 18 9-18 9 4-9-4-9Zm4 9h14",
  stop: "M6 6h12v12H6z",
  obstacle: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
};
const RouteActionIcon = ({ kind }) => <svg className="route-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={actionPaths[kind]} /></svg>;

const missionStatusText = (mission) => {
  if (!mission) return null;
  if (mission.connectionError) return `Не удалось получить статус миссии: ${mission.connectionError}`;
  if (mission.status === "cancelling") return "Ожидаем подтверждения остановки от контроллера…";
  if (mission.feedbackFresh === false && !["completed", "cancelled", "failed"].includes(mission.status)) {
    return "Нет подтверждения от контроллера. Если Webots перезапускался, нажмите «Остановить маршрут», дождитесь остановки и отправьте маршрут снова.";
  }
  return {
    prepared: "Подготавливаем маршрут к отправке…",
    persisted: "Маршрут сохранён. Ожидаем подтверждения контроллера…",
    accepted: "Контроллер принял маршрут. Ожидаем начала движения…",
    running: "Робот выполняет маршрут.",
    cancelled: "Маршрут остановлен. Можно отправить новый.",
    completed: "Робот завершил маршрут.",
    failed: "Не удалось выполнить маршрут.",
  }[mission.status] || null;
};

export default function PlannerRouteControlsSection({
  showObstacle = true,
  hasRoute,
  isOptimizing,
  onAddRandomObstacle,
  onCancelMission,
  mission,
  onOptimizeRoute,
  onSendRoute,
  routeLength,
}) {
  const missionStatus = missionStatusText(mission);
  return (
    <div className="route-controls">
      <div className="route-controls-title">Управление маршрутом <HelpHint label="Безопасный маршрут">
        Маршрут строится с зазором {ROUTE_CLEARANCE_MARGIN.toFixed(2)} м от контура,
        а целевые точки держатся минимум на {SAFE_POINT_MARGIN.toFixed(2)} м от запретной зоны.
      </HelpHint></div>
      <div className="route-actions"><button type="button" onClick={onOptimizeRoute} disabled={isOptimizing}
        className="route-action route-action-primary" aria-busy={isOptimizing}>
        <RouteActionIcon kind="build" /><span>{isOptimizing ? "Строим маршрут..." : "Построить маршрут"}</span>
      </button>
      <button type="button" onClick={onSendRoute} disabled={isOptimizing || !hasRoute}
        className="route-action route-action-accent">
        <RouteActionIcon kind="send" /><span>Отправить маршрут</span>
      </button>
      <button type="button" onClick={onCancelMission} disabled={!mission || ["completed", "cancelled", "failed", "cancelling"].includes(mission.status)}
        className={`route-action route-action-danger ${showObstacle ? "" : "route-action-wide"}`}>
        <RouteActionIcon kind="stop" /><span>{mission?.status === "cancelling" ? "Останавливаем…" : "Остановить маршрут"}</span>
      </button>
      {showObstacle && <button type="button" onClick={onAddRandomObstacle} disabled={isOptimizing}
        className="route-action">
        <RouteActionIcon kind="obstacle" /><span>+ Препятствие</span>
      </button>}
      </div>
      {missionStatus && <p role="status" className="mt-2 text-xs leading-relaxed text-stone-700">{missionStatus}</p>}
      {hasRoute && <p className="mt-3 text-sm">Длина маршрута: <b>{routeLength.toFixed(2)} м</b></p>}
    </div>
  );
}
