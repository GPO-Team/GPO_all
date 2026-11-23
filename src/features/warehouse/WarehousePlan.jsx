import { useEffect, useRef, useState } from "react";
import { rackCorners } from "../../../shared/warehouse/layout";
import { MAP_WORLD_WIDTH, MAP_WORLD_HEIGHT } from "../../../shared/planning/worldBounds";
import { Button } from "./ui";

export default function WarehousePlan({
  racks,
  stations,
  selectedId,
  onSelect,
  draft,
  placement,
  onPlace,
}) {
  const [full, setFull] = useState(false);
  const svgRef = useRef(null);
  useEffect(() => {
    if (placement) svgRef.current?.scrollIntoView?.({ block: "center" });
  }, [placement]);
  const scale = 30;
  const width = MAP_WORLD_WIDTH * scale;
  const height = MAP_WORLD_HEIGHT * scale;
  const polygon = (rack) =>
    rackCorners(rack)
      .map(({ x, y }) => `${x * scale},${-y * scale}`)
      .join(" ");
  const draftRack = draft && {
    ...draft,
    x: Number(draft.x),
    y: Number(draft.y),
    yaw: (Number(draft.yaw) * Math.PI) / 180,
  };
  const points = [...racks.flatMap(rackCorners), ...stations];
  const minX = Math.max(-MAP_WORLD_WIDTH / 2, Math.min(-5, ...points.map((point) => point.x)) - 2);
  const maxX = Math.min(MAP_WORLD_WIDTH / 2, Math.max(5, ...points.map((point) => point.x)) + 2);
  const minY = Math.max(-MAP_WORLD_HEIGHT / 2, Math.min(-5, ...points.map((point) => point.y)) - 2);
  const maxY = Math.min(MAP_WORLD_HEIGHT / 2, Math.max(5, ...points.map((point) => point.y)) + 2);
  const viewBox =
    full || placement
      ? `${-width / 2 - 20} ${-height / 2 - 20} ${width + 40} ${height + 40}`
      : `${minX * scale - 20} ${-maxY * scale - 20} ${(maxX - minX) * scale + 40} ${(maxY - minY) * scale + 40}`;
  const handlePlace = (event) => {
    if (!placement) return;
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    onPlace(Number((local.x / scale).toFixed(2)), Number((-local.y / scale).toFixed(2)));
  };
  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        <Button aria-pressed={!full} disabled={placement} onClick={() => setFull(false)}>
          По объектам
        </Button>
        <Button aria-pressed={full} disabled={placement} onClick={() => setFull(true)}>
          Весь склад
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        <svg
          ref={svgRef}
          aria-label="План склада, вид сверху"
          role="group"
          viewBox={viewBox}
          className={`block max-h-[520px] min-h-[250px] w-full ${placement ? "cursor-crosshair" : ""}`}
          onClick={handlePlace}
        >
          <defs>
            <pattern id="warehouse-grid" width={scale} height={scale} patternUnits="userSpaceOnUse">
              <path
                d={`M ${scale} 0 L 0 0 0 ${scale}`}
                fill="none"
                stroke="#e7e5e4"
                strokeWidth="0.7"
              />
            </pattern>
          </defs>
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            fill="url(#warehouse-grid)"
            stroke="#d6d3d1"
          />
          <path
            d={`M ${-width / 2} 0 H ${width / 2} M 0 ${-height / 2} V ${height / 2}`}
            stroke="#cbd5e1"
            strokeDasharray="4 5"
          />
          <text x={width / 2 - 22} y={-6} fontSize="10" fill="#78716c">
            X →
          </text>
          <text x="6" y={-height / 2 + 14} fontSize="10" fill="#78716c">
            Y ↑
          </text>
          {racks.map((rack) => (
            <g
              key={rack.id}
              role="button"
              tabIndex={placement ? -1 : 0}
              aria-label={`Выбрать стеллаж ${rack.code}`}
              onClick={(event) => {
                if (!placement) {
                  event.stopPropagation();
                  onSelect(rack.id);
                }
              }}
              onKeyDown={(event) => {
                if (!placement && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelect(rack.id);
                }
              }}
              className="cursor-pointer"
            >
              <polygon
                points={polygon(rack)}
                fill={rack.id === selectedId ? "#fed7aa" : "#e2e8f0"}
                stroke={rack.id === selectedId ? "#ea580c" : "#64748b"}
                strokeWidth="2"
              />
              <text
                x={rack.x * scale}
                y={-rack.y * scale + 4}
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                fill="#334155"
              >
                {rack.code}
              </text>
            </g>
          ))}
          {stations.map((station) => (
            <g key={station.id} transform={`translate(${station.x * scale} ${-station.y * scale})`}>
              <circle
                r="7"
                fill={station.id === "receiving" ? "#0f766e" : "#6366f1"}
                stroke="white"
                strokeWidth="2"
              />
              <text y="-12" textAnchor="middle" fontSize="10" fill="#57534e">
                {station.name}
              </text>
            </g>
          ))}
          {draftRack && Number.isFinite(draftRack.x) && Number.isFinite(draftRack.y) && (
            <polygon
              points={polygon(draftRack)}
              fill="#fb923c"
              fillOpacity="0.15"
              stroke="#ea580c"
              strokeWidth="2"
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span>
          Сетка 1 м · {MAP_WORLD_WIDTH} × {MAP_WORLD_HEIGHT} м · центр стеллажа = X, Y
        </span>
        <span className="flex gap-4">
          <span>● Приёмка</span>
          <span>● Отгрузка</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {placement
          ? "Режим размещения: выберите центр стеллажа на плане."
          : "Нажмите на стеллаж, чтобы увидеть его ячейки. План показывает геометрию, доступ робота не проверен."}
      </p>
    </div>
  );
}
