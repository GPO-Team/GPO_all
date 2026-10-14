#include "controller_camera_map_io.h"

#include <stdio.h>
#include <string.h>

static int file_equals(const char *path, const char *expected) {
  FILE *file = fopen(path, "rb");
  if (!file) return 0;
  char buffer[1024] = {0};
  const size_t size = fread(buffer, 1, sizeof(buffer) - 1, file);
  fclose(file);
  size_t write_index = 0;
  for (size_t read_index = 0; read_index < size; ++read_index) {
    if (buffer[read_index] != '\r') buffer[write_index++] = buffer[read_index];
  }
  buffer[write_index] = '\0';
  return strcmp(buffer, expected) == 0;
}

int main(void) {
  const char *json_path = "controller_camera_map_io_test.json";
  const char *json_temp_path = "controller_camera_map_io_test.json.tmp";
  const char *csv_path = "controller_camera_map_io_test.csv";
  const char *csv_temp_path = "controller_camera_map_io_test.csv.tmp";
  const MapCell obstacles[1] = {{1.0, 2.0, 4}};
  const MapCell free_cells[1] = {{-1.5, 0.25, 6}};

  if (!controller_camera_map_io_write(
          json_path,
          json_temp_path,
          csv_path,
          csv_temp_path,
          0.10,
          obstacles,
          1,
          free_cells,
          1)) {
    return 1;
  }
  if (!file_equals(
          json_path,
          "{\n"
          "  \"cellSize\": 0.1000,\n"
          "  \"cellCount\": 2,\n"
          "  \"totalCells\": 2,\n"
          "  \"obstacleCellCount\": 1,\n"
          "  \"freeCellCount\": 1,\n"
          "  \"source\": \"camera\",\n"
          "  \"cells\": [\n"
          "    {\"x\": 1.0000, \"y\": 2.0000, \"confidence\": 4}\n"
          "  ],\n"
          "  \"freeCells\": [\n"
          "    {\"x\": -1.5000, \"y\": 0.2500, \"confidence\": 6}\n"
          "  ]\n"
          "}\n")) {
    return 2;
  }
  if (!file_equals(
          csv_path,
          "type,x,y,confidence\n"
          "obstacle,1.0000,2.0000,4\n"
          "free,-1.5000,0.2500,6\n")) {
    return 3;
  }

  controller_camera_map_io_clear_files(json_path, json_temp_path, csv_path, csv_temp_path);
  FILE *file = fopen(json_path, "rb");
  if (file) {
    fclose(file);
    return 4;
  }
  return 0;
}
