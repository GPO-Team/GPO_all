const cardCls = "rounded-[18px] border border-sky-100 bg-white p-3";
const formatNumber = (value, unit = "", digits = 2) =>
  Number.isFinite(value) ? `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}` : "—";
const navigationLabels = {
  idle: "Ожидание", tracking_path: "Следование маршруту", completed: "Маршрут завершён",
  finished: "Маршрут завершён", stopped: "Остановлен", cancelled: "Отменён",
  avoiding: "Объезд препятствия", charging: "Зарядка", blocked: "Путь заблокирован",
  aligning_final_heading: "Выравнивание курса у цели", turning_to_path: "Поворот к маршруту",
  turning_lidar_priority: "Поворот по данным лидара", tracking_lidar_priority: "Движение по данным лидара",
  tracking_planned_zone_bypass: "Обход запретной зоны",
  waiting_for_route: "Ожидание маршрута", route_reloaded: "Маршрут обновлён",
  mission_cancelled: "Миссия отменена", blocked_by_dynamic_zone: "Путь перекрыт запретной зоной",
  mapping_survey_started: "Обследование карты", survey_route_generated: "Маршрут обследования готов",
  mapping_survey_circle_scan_started: "Круговое сканирование карты",
  mapping_survey_resumed_route: "Возврат к маршруту обследования",
  mapping_survey_rejoined_route: "Продолжение обследования",
  mapping_survey_skipped_looped_obstacle: "Обход сложного препятствия",
  reacquired_free_space: "Свободный путь найден", runtime_obstacle_spawned: "Препятствие добавлено",
  error: "Ошибка движения",
};

function Reading({ label, children }) {
  return <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="min-w-0 break-words text-right font-medium text-slate-800">{children}</span>
  </div>;
}

export default function PlannerTelemetrySection({ telemetry, telemetryWsUp, routeWsUp, solverApiUp }) {
  const camera = telemetry.perception?.camera;
  const lidar = telemetry.perception?.lidar;
  const navigation = telemetry.navigation || {};
  const motion = telemetry.motionProfile || {};
  const cameraCellCount = (telemetry.cameraMap?.cells?.length || 0) + (telemetry.cameraMap?.freeCells?.length || 0);
  const hasPose = Number.isFinite(telemetry.simulationTime);
  const navigationStatus = navigation.finished ? "Маршрут завершён"
    : navigationLabels[navigation.status] || navigation.status || "Нет данных";

  return <section className={cardCls}>
    <h3 className="mb-2 text-sm font-semibold">Телеметрия робота</h3>
    {!telemetryWsUp && <p role="status" className="mb-2 text-xs text-amber-700">Нет соединения с телеметрией. Показаны последние полученные данные.</p>}
    <details className="planner-disclosure rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="disclosure-trigger flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="flex-1">Показания датчиков</span><span className="disclosure-hint text-xs font-normal text-sky-700">Раскрыть</span></summary>
      <div className="mt-3 space-y-3 text-xs tabular-nums">
        <div>
          <h4 className="mb-1 font-semibold text-sky-800">Положение робота</h4>
          <Reading label="X">{hasPose ? formatNumber(telemetry.x, "м") : "—"}</Reading>
          <Reading label="Y">{hasPose ? formatNumber(telemetry.y, "м") : "—"}</Reading>
          <Reading label="Z">{hasPose ? formatNumber(telemetry.z, "м") : "—"}</Reading>
          <Reading label="Курс (yaw)">{hasPose ? formatNumber(telemetry.yaw, "рад") : "—"}</Reading>
          <Reading label="Время симуляции">{formatNumber(telemetry.simulationTime, "с", 1)}</Reading>
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-sky-800">Навигация</h4>
          <Reading label="Состояние">{navigationStatus}</Reading>
          <Reading label="Индекс маршрутной точки">{navigation.status && Number.isFinite(navigation.currentWaypointIndex) ? navigation.currentWaypointIndex : "—"}</Reading>
          <Reading label="Расстояние до цели">{formatNumber(navigation.distanceToTarget, "м")}</Reading>
          <Reading label="Цель X / Y">{navigation.target ? `${formatNumber(navigation.target.x)} / ${formatNumber(navigation.target.y)} м` : "—"}</Reading>
          <Reading label="Курс цели">{formatNumber(navigation.target?.headingDeg, "°")}</Reading>
          <Reading label="Объезд препятствия">{typeof navigation.avoidanceActive === "boolean" ? navigation.avoidanceActive ? "Активен" : "Не активен" : "—"}</Reading>
          <Reading label="Вне маршрута">{typeof navigation.offRouteActive === "boolean" ? navigation.offRouteActive ? "Да" : "Нет" : "—"}</Reading>
          <Reading label="Время объезда вне маршрута">{formatNumber(navigation.avoidanceTimeSec, "с", 1)}</Reading>
          {navigation.error && <p role="alert" className="mt-2 text-rose-700">{navigation.error}</p>}
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-sky-800">Профиль движения контроллера</h4>
          <Reading label="Заданная скорость">{formatNumber(motion.cruiseSpeedMps, "м/с")}</Reading>
          <Reading label="Масса груза">{formatNumber(motion.payloadKg, "кг")}</Reading>
          <Reading label="Запас хода">{formatNumber(motion.batteryRange, "энерго-ед.", 1)}</Reading>
          <Reading label="Коэффициент скорости по батарее">{formatNumber(motion.batterySpeedFactor)}</Reading>
          <Reading label="Лимит линейной скорости">{formatNumber(motion.runtimeLinearLimitMps, "м/с")}</Reading>
          <Reading label="Лимит угловой скорости">{formatNumber(motion.runtimeAngularLimitRad, "рад/с")}</Reading>
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-sky-800">Лидар</h4>
          <Reading label="Состояние лидара">{lidar ? lidar.enabled ? "Включён" : "Выключен" : "Нет данных"}</Reading>
          <Reading label="Дальность">{formatNumber(lidar?.maxRange, "м")}</Reading>
          <Reading label="Спереди">{formatNumber(lidar?.frontMinRange, "м")}</Reading>
          <Reading label="Слева">{formatNumber(lidar?.leftMinRange, "м")}</Reading>
          <Reading label="Справа">{formatNumber(lidar?.rightMinRange, "м")}</Reading>
          <Reading label="Попаданий за скан">{lidar?.lastHitCount ?? "—"}</Reading>
          <Reading label="Точек препятствий">{telemetry.obstacleTrace?.length || 0}</Reading>
          <Reading label="Ячеек карты лидара">{telemetry.obstacleMap?.cellCount || telemetry.obstacleMap?.cells?.length || 0}</Reading>
          <Reading label="Размер ячейки">{formatNumber(telemetry.obstacleMap?.cellSize, "м")}</Reading>
        </div>
        <div>
          <h4 className="mb-1 font-semibold text-violet-800">Камера</h4>
          <Reading label="Состояние камеры">{camera ? camera.enabled ? camera.mode === "virtual_lidar" ? "Виртуальная" : "Включена" : "Выключена" : "Нет данных"}</Reading>
          <Reading label="Обнаружений">{camera?.detectionCount ?? "—"}</Reading>
          <Reading label="Расстояние до объекта">{camera?.obstacleVisible ? formatNumber(camera.obstacleRange, "м") : "—"}</Reading>
          <Reading label="Ячеек карты камеры">{telemetry.cameraMap?.cellCount || cameraCellCount}</Reading>
          <Reading label="Занятых ячеек">{telemetry.cameraMap?.obstacleCellCount || telemetry.cameraMap?.cells?.length || 0}</Reading>
          <Reading label="Свободных ячеек">{telemetry.cameraMap?.freeCellCount || telemetry.cameraMap?.freeCells?.length || 0}</Reading>
        </div>
      </div>
    </details>
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs text-slate-200">
        <span className="font-semibold">Камера робота</span>
        <span>{camera?.obstacleVisible ? `объект ${Math.round((camera.obstacleScore || 0) * 100)}%` : `${camera?.width || 320}×${camera?.height || 180}`}</span>
      </div>
      <div className="aspect-video bg-slate-900">
        {camera?.frameDataUrl ? <img src={camera.frameDataUrl} alt="Кадр с камеры робота" className="h-full w-full object-contain" />
          : <div className="flex h-full items-center justify-center text-xs text-slate-400">Ожидание изображения из симуляции</div>}
      </div>
    </div>
    <div className="mt-3 space-y-1 text-xs text-slate-600">
      {[["Телеметрия", telemetryWsUp], ["Канал маршрута", routeWsUp], ["Решатель маршрута", solverApiUp]].map(([label, connected]) =>
        <div key={label} className="flex justify-between gap-2"><span>{label}</span><span className={connected ? "text-emerald-700" : "text-rose-600"}>{connected ? "Подключено" : "Нет соединения"}</span></div>
      )}
    </div>
  </section>;
}
