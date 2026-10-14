#include "controller_camera_map_io.h"

#include "controller_io.h"

#include <stdio.h>

int controller_camera_map_io_write(
    const char *json_path,
    const char *json_temp_path,
    const char *csv_path,
    const char *csv_temp_path,
    double cell_size,
    const MapCell *obstacles,
    int obstacle_count,
    const MapCell *free_cells,
    int free_count) {
  if (!json_path || !json_temp_path || !csv_path || !csv_temp_path ||
      (!obstacles && obstacle_count > 0) || (!free_cells && free_count > 0) ||
      obstacle_count < 0 || free_count < 0) {
    return 0;
  }

  int json_written = 0;
  int csv_written = 0;
  FILE *json_file = fopen(json_temp_path, "w");
  if (json_file) {
    const int total_count = obstacle_count + free_count;
    fprintf(json_file, "{\n");
    fprintf(json_file, "  \"cellSize\": %.4f,\n", cell_size);
    fprintf(json_file, "  \"cellCount\": %d,\n", total_count);
    fprintf(json_file, "  \"totalCells\": %d,\n", total_count);
    fprintf(json_file, "  \"obstacleCellCount\": %d,\n", obstacle_count);
    fprintf(json_file, "  \"freeCellCount\": %d,\n", free_count);
    fprintf(json_file, "  \"source\": \"camera\",\n");
    fprintf(json_file, "  \"cells\": [\n");
    for (int i = 0; i < obstacle_count; ++i) {
      fprintf(
          json_file,
          "    {\"x\": %.4f, \"y\": %.4f, \"confidence\": %d}%s\n",
          obstacles[i].x,
          obstacles[i].y,
          obstacles[i].confidence,
          i + 1 < obstacle_count ? "," : "");
    }
    fprintf(json_file, "  ],\n");
    fprintf(json_file, "  \"freeCells\": [\n");
    for (int i = 0; i < free_count; ++i) {
      fprintf(
          json_file,
          "    {\"x\": %.4f, \"y\": %.4f, \"confidence\": %d}%s\n",
          free_cells[i].x,
          free_cells[i].y,
          free_cells[i].confidence,
          i + 1 < free_count ? "," : "");
    }
    fprintf(json_file, "  ]\n");
    fprintf(json_file, "}\n");
    fclose(json_file);
    json_written = replace_file(json_temp_path, json_path) == 0;
  }

  FILE *csv_file = fopen(csv_temp_path, "w");
  if (csv_file) {
    fprintf(csv_file, "type,x,y,confidence\n");
    for (int i = 0; i < obstacle_count; ++i) {
      fprintf(
          csv_file,
          "obstacle,%.4f,%.4f,%d\n",
          obstacles[i].x,
          obstacles[i].y,
          obstacles[i].confidence);
    }
    for (int i = 0; i < free_count; ++i) {
      fprintf(
          csv_file,
          "free,%.4f,%.4f,%d\n",
          free_cells[i].x,
          free_cells[i].y,
          free_cells[i].confidence);
    }
    fclose(csv_file);
    csv_written = replace_file(csv_temp_path, csv_path) == 0;
  }

  return json_written && csv_written;
}

void controller_camera_map_io_clear_files(
    const char *json_path,
    const char *json_temp_path,
    const char *csv_path,
    const char *csv_temp_path) {
  if (json_path) remove(json_path);
  if (json_temp_path) remove(json_temp_path);
  if (csv_path) remove(csv_path);
  if (csv_temp_path) remove(csv_temp_path);
}
