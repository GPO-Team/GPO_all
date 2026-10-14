#include "controller_lidar_trace.h"

#include <cmath>

static int finite_number(double value) {
  return std::isfinite(value);
}

void controller_lidar_trace_prune(
    ObstacleTracePoint *trace, int *trace_count, double now_time, double ttl_seconds) {
  if (!trace || !trace_count || *trace_count <= 0) return;

  int write_index = 0;
  for (int read_index = 0; read_index < *trace_count; ++read_index) {
    const ObstacleTracePoint point = trace[read_index];
    if (now_time - point.last_seen_time > ttl_seconds) continue;
    trace[write_index++] = point;
  }
  *trace_count = write_index;
}

void controller_lidar_trace_append(
    ObstacleTracePoint *trace,
    int *trace_count,
    int trace_capacity,
    double spacing,
    double x,
    double y,
    double now_time) {
  if (!trace || !trace_count || trace_capacity <= 0 || !finite_number(x) || !finite_number(y)) {
    return;
  }

  int nearest_index = -1;
  double nearest_distance = 1e9;
  for (int i = 0; i < *trace_count; ++i) {
    const double dx = trace[i].x - x;
    const double dy = trace[i].y - y;
    const double distance = sqrt(dx * dx + dy * dy);
    if (distance <= spacing && distance < nearest_distance) {
      nearest_distance = distance;
      nearest_index = i;
    }
  }

  if (nearest_index >= 0) {
    ObstacleTracePoint *point = &trace[nearest_index];
    point->x = point->x * 0.68 + x * 0.32;
    point->y = point->y * 0.68 + y * 0.32;
    point->last_seen_time = now_time;
    if (point->hit_count < 255) point->hit_count += 1;
    return;
  }

  if (*trace_count >= trace_capacity) {
    int oldest_index = 0;
    double oldest_time = trace[0].last_seen_time;
    for (int i = 1; i < *trace_count; ++i) {
      if (trace[i].last_seen_time < oldest_time) {
        oldest_time = trace[i].last_seen_time;
        oldest_index = i;
      }
    }
    trace[oldest_index] = ObstacleTracePoint{x, y, now_time, 1};
    return;
  }

  trace[*trace_count] = ObstacleTracePoint{x, y, now_time, 1};
  *trace_count += 1;
}

void controller_lidar_trace_merge_into_map(
    const ObstacleTracePoint *trace,
    int trace_count,
    double now_time,
    double max_age_seconds,
    int min_hit_count,
    MapCell *map,
    int *map_count,
    int map_capacity,
    double cell_size,
    double epsilon,
    int *map_dirty) {
  if (!trace || !map || !map_count || !map_dirty || cell_size <= 0.0) return;

  for (int i = 0; i < trace_count; ++i) {
    const ObstacleTracePoint *point = &trace[i];
    if (now_time - point->last_seen_time > max_age_seconds) continue;
    if (point->hit_count < min_hit_count) continue;

    const double cell_x = round(point->x / cell_size) * cell_size;
    const double cell_y = round(point->y / cell_size) * cell_size;
    const double half_cell = cell_size * 0.5 + epsilon;
    int found_index = -1;
    for (int j = 0; j < *map_count; ++j) {
      if (fabs(map[j].x - cell_x) < half_cell && fabs(map[j].y - cell_y) < half_cell) {
        found_index = j;
        break;
      }
    }

    if (found_index >= 0) {
      if (map[found_index].confidence < 255) {
        map[found_index].confidence += 1;
        *map_dirty = 1;
      }
      continue;
    }

    if (*map_count >= map_capacity) continue;
    map[*map_count] = MapCell{cell_x, cell_y, 1};
    *map_count += 1;
    *map_dirty = 1;
  }
}
