#include "controller_survey_contour_adapter.h"
#include "controller_survey_contour.h"
#include "controller_survey_geometry.h"

typedef struct { SurveyPoint *route; int *count; int capacity; double spacing; double max_step; ControllerSurveyContourAdapterSafe safe; void *context; } Context;
static int safe_point(void *value, SurveyPoint point) { Context *ctx=static_cast<Context *>(value); return ctx->safe(ctx->context, point); }
static void add_point(void *value, SurveyPoint point) { Context *ctx=static_cast<Context *>(value); controller_survey_route_add(ctx->route, ctx->count, ctx->capacity, ctx->spacing, point.x, point.y); }
static void add_segment(void *value, SurveyPoint from, SurveyPoint to) { Context *ctx=static_cast<Context *>(value); controller_survey_route_add_segment(ctx->route, ctx->count, ctx->capacity, ctx->spacing, ctx->max_step, from, to); }
int controller_survey_contour_adapter_append(const LimitZone *room, SurveyPoint *route, int *count, int capacity, double spacing, double max_step, double offset, double robot_x, double robot_y, ControllerSurveyContourAdapterSafe safe, void *context) { SurveyPoint contour[MAX_ZONE_POINTS]; int n=0; if(!room||!route||!count||!safe||!controller_survey_build_offset_contour(room,offset,contour,MAX_ZONE_POINTS,&n)) return 0; Context ctx={route,count,capacity,spacing,max_step,safe,context}; return controller_survey_append_contour(contour,n,robot_x,robot_y,count,safe_point,add_point,add_segment,&ctx); }
