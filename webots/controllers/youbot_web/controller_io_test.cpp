#include "controller_io.h"

#include <stdio.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#endif

int main(void) {
  const char *temp_path = "controller_io_test.tmp";
  const char *final_path = "controller_io_test.bmp";
  const unsigned char pixels[] = {
      255, 0, 0,
      0, 255, 0,
  };

  if (write_bmp24(temp_path, pixels, 2, 1) != 0) return 1;
  if (get_file_mtime(temp_path) < 0) return 2;
#ifdef _WIN32
  const long long before = get_file_mtime(temp_path);
  HANDLE handle = CreateFileA(temp_path, FILE_WRITE_ATTRIBUTES | FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
  if (handle == INVALID_HANDLE_VALUE) return 6;
  ULARGE_INTEGER ticks;
  FILETIME original;
  if (!GetFileTime(handle, NULL, NULL, &original)) return 9;
  ticks.LowPart = original.dwLowDateTime;
  ticks.HighPart = original.dwHighDateTime;
  ticks.QuadPart += 100;
  FILETIME changed = {ticks.LowPart, ticks.HighPart};
  if (!SetFileTime(handle, NULL, NULL, &changed)) return 7;
  CloseHandle(handle);
  if (get_file_mtime(temp_path) == before) return 8;
#endif
  if (replace_file(temp_path, final_path) != 0) return 3;

  FILE *file = fopen(final_path, "rb");
  if (!file) return 4;
  unsigned char signature[2] = {0};
  const size_t bytes_read = fread(signature, 1, sizeof(signature), file);
  fclose(file);
  remove(final_path);

  if (bytes_read != 2 || memcmp(signature, "BM", 2) != 0) return 5;
  return 0;
}
