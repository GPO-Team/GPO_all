#include "controller_survey_coverage.h"

#include "controller_survey_geometry.h"

int controller_survey_choose_axis_start(
    double axis_min,
    double axis_max,
    double strip_spacing,
    int vertical,
    int sweep_from_high,
    SurveyPoint current,
    int interval_capacity,
    ControllerSurveyBuildIntervalsFn build_intervals,
    void *context,
    int *start_positive,
    double *best_distance) {
  if (!build_intervals || !start_positive || !best_distance || strip_spacing <= 0.0 ||
      interval_capacity <= 0) {
    return 0;
  }
  if (interval_capacity > 64) interval_capacity = 64;
  for (int scan_index = 0; scan_index < 4096; ++scan_index) {
    const double coordinate = sweep_from_high
                                  ? axis_max - (double)scan_index * strip_spacing
                                  : axis_min + (double)scan_index * strip_spacing;
    if (sweep_from_high ? coordinate < axis_min - 0.01 : coordinate > axis_max + 0.01) break;

    SurveyInterval intervals[64];
    const int count = build_intervals(context, coordinate, intervals, interval_capacity);
    if (count <= 0) continue;
    const SurveyPoint low = vertical
                                ? SurveyPoint{coordinate, intervals[0].start}
                                : SurveyPoint{intervals[0].start, coordinate};
    const SurveyPoint high = vertical
                                 ? SurveyPoint{coordinate, intervals[count - 1].end}
                                 : SurveyPoint{intervals[count - 1].end, coordinate};
    controller_survey_choose_snake_start(
        current, low, high, start_positive, best_distance);
    return 1;
  }
  return 0;
}

void controller_survey_append_axis_coverage(
    double axis_min,
    double axis_max,
    double strip_spacing,
    int vertical,
    int start_positive,
    int sweep_from_high,
    int *route_count,
    int route_capacity,
    int interval_capacity,
    ControllerSurveyBuildIntervalsFn build_intervals,
    ControllerSurveyAppendSegmentFn append_segment,
    void *context) {
  if (!route_count || !build_intervals || !append_segment || strip_spacing <= 0.0 ||
      interval_capacity <= 0) {
    return;
  }
  if (interval_capacity > 64) interval_capacity = 64;
  int positive = start_positive ? 1 : 0;

  for (int scan_index = 0; *route_count < route_capacity - 4; ++scan_index) {
    const double coordinate = sweep_from_high
                                  ? axis_max - (double)scan_index * strip_spacing
                                  : axis_min + (double)scan_index * strip_spacing;
    if (sweep_from_high ? coordinate < axis_min - 0.01 : coordinate > axis_max + 0.01) break;

    SurveyInterval intervals[64];
    int interval_count = build_intervals(context, coordinate, intervals, interval_capacity);
    if (!positive) controller_survey_reverse_intervals(intervals, interval_count);

    for (int i = 0; i < interval_count && *route_count < route_capacity - 2; ++i) {
      const double start_value = positive ? intervals[i].start : intervals[i].end;
      const double end_value = positive ? intervals[i].end : intervals[i].start;
      const SurveyPoint start = vertical
                                    ? SurveyPoint{coordinate, start_value}
                                    : SurveyPoint{start_value, coordinate};
      const SurveyPoint end = vertical
                                  ? SurveyPoint{coordinate, end_value}
                                  : SurveyPoint{end_value, coordinate};
      append_segment(context, start, end);
    }
    positive = !positive;
  }
}

void controller_survey_append_best_axis_coverage(
    double axis_min,
    double axis_max,
    double strip_spacing,
    int vertical,
    SurveyPoint current,
    int *route_count,
    int route_capacity,
    int interval_capacity,
    ControllerSurveyBuildIntervalsFn build_intervals,
    ControllerSurveyAppendSegmentFn append_segment,
    void *context) {
  int low_positive = 1;
  int high_positive = 1;
  double low_distance = 1e30;
  double high_distance = 1e30;
  const int has_low = controller_survey_choose_axis_start(
      axis_min, axis_max, strip_spacing, vertical, 0, current, interval_capacity,
      build_intervals, context, &low_positive, &low_distance);
  const int has_high = controller_survey_choose_axis_start(
      axis_min, axis_max, strip_spacing, vertical, 1, current, interval_capacity,
      build_intervals, context, &high_positive, &high_distance);
  int sweep_from_high = 0;
  int start_positive = 0;
  controller_survey_select_sweep_start(
      has_low, low_positive, low_distance,
      has_high, high_positive, high_distance,
      &sweep_from_high, &start_positive);
  controller_survey_append_axis_coverage(
      axis_min, axis_max, strip_spacing, vertical, start_positive, sweep_from_high,
      route_count, route_capacity, interval_capacity,
      build_intervals, append_segment, context);
}
