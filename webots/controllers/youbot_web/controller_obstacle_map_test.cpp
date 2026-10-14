#include "controller_obstacle_map.h"

#include <stdio.h>
#include <string.h>

static int file_equals(const char *path, const char *expected) {
  FILE *file = fopen(path, "rb");
  if (!file) return 0;
  char buffer[512] = {0};
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
  const char *json_path = "controller_obstacle_map_test.json";
  const char *json_temp_path = "controller_obstacle_map_test.json.tmp";
  const char *csv_path = "controller_obstacle_map_test.csv";
  const char *csv_temp_path = "controller_obstacle_map_test.csv.tmp";
  const MapCell cells[2] = {
      {1.25, -2.5, 3},
      {0.0, 4.125, 7},
  };

  if (!controller_obstacle_map_write(
          json_path, json_temp_path, csv_path, csv_temp_path, 0.06, cells, 2)) {
    return 1;
  }
  if (!file_equals(
          json_path,
          "{\n"
          "  \"cellSize\": 0.0600,\n"
          "  \"totalCells\": 2,\n"
          "  \"cells\": [\n"
          "    {\"x\": 1.2500, \"y\": -2.5000, \"confidence\": 3},\n"
          "    {\"x\": 0.0000, \"y\": 4.1250, \"confidence\": 7}\n"
          "  ]\n"
          "}\n")) {
    return 2;
  }
  if (!file_equals(
          csv_path,
          "x,y,confidence\n"
          "1.2500,-2.5000,3\n"
          "0.0000,4.1250,7\n")) {
    return 3;
  }

  controller_obstacle_map_clear_files(json_path, json_temp_path, csv_path, csv_temp_path);
  FILE *file = fopen(json_path, "rb");
  if (file) {
    fclose(file);
    return 4;
  }
  file = fopen(csv_path, "rb");
  if (file) {
    fclose(file);
    return 5;
  }

  return 0;
}
