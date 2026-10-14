#include "controller_types.h"

#include <string.h>

MappingSurveyMode controller_parse_mapping_survey_mode(const char *mode) {
  if (!mode) return MAPPING_SURVEY_MODE_SNAKE;
  if (strcmp(mode, "double") == 0 || strcmp(mode, "double_pass") == 0) {
    return MAPPING_SURVEY_MODE_DOUBLE;
  }
  return MAPPING_SURVEY_MODE_SNAKE;
}

const char *controller_mapping_survey_mode_to_string(MappingSurveyMode mode) {
  switch (mode) {
    case MAPPING_SURVEY_MODE_DOUBLE:
      return "double";
    case MAPPING_SURVEY_MODE_SNAKE:
    default:
      return "snake";
  }
}
