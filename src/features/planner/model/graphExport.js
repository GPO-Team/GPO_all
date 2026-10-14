const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
export const buildGraphCsv = ({
  points,
  limitZones = [],
  surfaceZones = [],
}) => {
  const zones = new Map(limitZones.map((zone) => [zone.id, zone]));
  const rows = [
    [
      "x",
      "y",
      "kind",
      "task",
      "zone_id",
      "zone_name",
      "zone_closed",
      "surface_key",
    ],
  ];
  for (const point of points) {
    const zone = zones.get(point.zoneId);
    rows.push([
      point.x,
      point.y,
      point.kind,
      point.task,
      point.zoneId,
      zone?.name,
      zone ? String(zone.closed) : "",
    ]);
  }
  for (const zone of surfaceZones)
    for (const point of zone.points || [])
      rows.push([
        point.x,
        point.y,
        "surface",
        "",
        zone.id,
        zone.name,
        String(zone.closed),
        zone.surfaceKey,
      ]);
  return (
    "\uFEFF" +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
};
export const downloadGraphCsv = (graph) => {
  const url = URL.createObjectURL(
    new Blob([buildGraphCsv(graph)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "planner-graph.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
