#include "controller_mapping_survey_contour_service.h"

#include "controller_survey_contour_adapter.h"

typedef struct {
  const ControllerMappingSurveyContourService *service;
  int room_zone_index;
} ControllerMappingSurveyContourContext;

static int contour_point_is_safe(void *context, SurveyPoint point) {
  const ControllerMappingSurveyContourContext *contour = static_cast<const ControllerMappingSurveyContourContext *>(context);
  return contour && contour->service && contour->service->point_safe &&
         contour->service->point_safe(
             contour->service->point_safe_context,
             point.x,
             point.y,
             contour->room_zone_index,
             contour->service->contour_offset * contour->service->safety_clearance_factor);
}

int controller_mapping_survey_contour_service_append(
    const ControllerMappingSurveyContourService *service,
    SurveyPoint *route,
    int *route_count,
    int room_zone_index,
    double robot_x,
    double robot_y) {
  if (!service || !service->zones || !route || !route_count || !service->point_safe ||
      room_zone_index < 0 || room_zone_index >= service->zones->count) {
    return 0;
  }
  const ControllerMappingSurveyContourContext context = {service, room_zone_index};
  return controller_survey_contour_adapter_append(
      &service->zones->zones[room_zone_index],
      route,
      route_count,
      MAX_WAYPOINTS,
      service->route_spacing,
      service->max_contour_step,
      service->contour_offset,
      robot_x,
      robot_y,
      contour_point_is_safe,
      (void *)&context);
}
