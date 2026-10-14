#include "controller_survey_intervals.h"

#include <cmath>

void controller_survey_sort_values(double *values, int count) {
  if (!values || count <= 1) return;
  for (int i = 1; i < count; ++i) {
    const double value = values[i];
    int j = i - 1;
    while (j >= 0 && values[j] > value) {
      values[j + 1] = values[j];
      --j;
    }
    values[j + 1] = value;
  }
}

void controller_survey_subtract_interval(
    SurveyInterval *intervals,
    int *count,
    int capacity,
    double block_start,
    double block_end) {
  if (!intervals || !count || *count <= 0 || capacity <= 0) return;
  SurveyInterval next[64];
  const int effective_capacity = capacity < 64 ? capacity : 64;
  int next_count = 0;
  if (block_end < block_start) {
    const double tmp = block_start;
    block_start = block_end;
    block_end = tmp;
  }
  for (int i = 0; i < *count && next_count < effective_capacity; ++i) {
    const SurveyInterval current = intervals[i];
    if (block_end <= current.start || block_start >= current.end) {
      next[next_count++] = current;
      continue;
    }
    if (block_start > current.start) {
      next[next_count++] = SurveyInterval{current.start, fmin(block_start, current.end)};
    }
    if (block_end < current.end && next_count < effective_capacity) {
      next[next_count++] = SurveyInterval{fmax(block_end, current.start), current.end};
    }
  }
  for (int i = 0; i < next_count; ++i) intervals[i] = next[i];
  *count = next_count;
}
