#ifndef YOUBOT_WEB_CONTROLLER_TYPES_H
#define YOUBOT_WEB_CONTROLLER_TYPES_H

#define MAX_WAYPOINTS 768
#define MAX_ZONES 32
#define MAX_ZONE_POINTS 48
#define MAPPING_SURVEY_MAX_GRID_CELLS 36000

typedef struct {
  double x;
  /* Legacy field name: this stores the world-plane Y coordinate. */
  double z;
  double heading_rad;
  int has_heading;
} Waypoint;

typedef struct {
  Waypoint waypoints[MAX_WAYPOINTS];
  int count;
  long long last_modified;
  char command_id[64];
} RouteData;

typedef enum {
  NAV_MODE_IDLE = 0,
  NAV_MODE_TURN = 1,
  NAV_MODE_TRACK = 2,
  NAV_MODE_FINAL_ALIGN = 3,
} NavigationMode;

typedef enum {
  AVOID_MODE_NONE = 0,
  AVOID_MODE_FACE_CLEAR = 1,
  AVOID_MODE_FOLLOW_EDGE = 2,
  AVOID_MODE_SEARCH_EDGE = 3,
  AVOID_MODE_RECOVER_TARGET = 4,
  AVOID_MODE_ESCAPE = 5,
} AvoidanceMode;

typedef enum {
  MAPPING_SURVEY_MODE_SNAKE = 0,
  MAPPING_SURVEY_MODE_DOUBLE = 1,
} MappingSurveyMode;

typedef struct {
  char id[64];
  int point_count;
  struct {
    double x;
    double y;
  } points[MAX_ZONE_POINTS];
} LimitZone;

typedef struct {
  LimitZone zones[MAX_ZONES];
  int count;
} ZoneData;

typedef struct {
  char id[64];
  char surface_key[32];
  int point_count;
  struct {
    double x;
    double y;
  } points[MAX_ZONE_POINTS];
} SurfaceZone;

typedef struct {
  SurfaceZone zones[MAX_ZONES];
  int count;
} SurfaceZoneData;

typedef struct {
  double x;
  double y;
  double last_seen_time;
  int hit_count;
} ObstacleTracePoint;

typedef struct {
  long long id;
  int has_spawn_obstacle;
  int has_start_mapping_survey;
  int has_cancel_mission;
  int has_pick_place;
  char object_def[64];
  double target_x, target_y, target_z;
  int target_fields;
  int has_transfer_object;
  int has_recover_transfer;
  int has_resume_transfer;
  char mission_id[64];
  char object_id[32];
  char scene_revision[96];
  double destination_x;
  double destination_y;
  int has_field_bounds;
  int clear_map;
  MappingSurveyMode survey_mode;
  double survey_speed_mps;
  double field_min_x;
  double field_max_x;
  double field_min_y;
  double field_max_y;
  double x;
  double y;
  double size_x;
  double size_y;
  double height;
} RuntimeCommand;

typedef struct {
  double x;
  double y;
  int confidence;
} MapCell;

typedef struct {
  double x;
  double y;
} SurveyPoint;

typedef struct {
  double start;
  double end;
} SurveyInterval;

typedef struct {
  double min_x;
  double min_y;
  double cell;
  int width;
  int height;
  int count;
  unsigned char free_cell[MAPPING_SURVEY_MAX_GRID_CELLS];
  unsigned char component_cell[MAPPING_SURVEY_MAX_GRID_CELLS];
  unsigned char visited_cell[MAPPING_SURVEY_MAX_GRID_CELLS];
  int parent[MAPPING_SURVEY_MAX_GRID_CELLS];
  int queue[MAPPING_SURVEY_MAX_GRID_CELLS];
} SurveyGrid;

typedef struct {
  double expected_front_min_range;
  double unexpected_front_min_range;
  double unexpected_center_min_range;
  double unexpected_left_front_min_range;
  double unexpected_right_front_min_range;
  double unexpected_left_min_range;
  double unexpected_right_min_range;
  double expected_front_score;
  double unexpected_front_score;
  double unexpected_left_score;
  double unexpected_right_score;
  double best_gap_beam_angle;
  double best_gap_range;
  double best_gap_score;
  double closest_unexpected_range;
  double closest_unexpected_beam_angle;
  int has_best_gap;
  int has_closest_unexpected;
  int unexpected_front_hit_count;
} LidarObstacleContext;

MappingSurveyMode controller_parse_mapping_survey_mode(const char *mode);
const char *controller_mapping_survey_mode_to_string(MappingSurveyMode mode);

#endif
