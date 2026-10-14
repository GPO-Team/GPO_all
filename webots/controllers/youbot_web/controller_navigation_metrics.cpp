#include "controller_navigation_metrics.h"
#include <string.h>
int controller_navigation_metrics_off_route(int finished,int count,int active,const char *s){if(finished||count<=0)return 0;if(active)return 1;return s&&(strncmp(s,"avoiding_",9)==0||strcmp(s,"passing_lidar_gap")==0||strcmp(s,"tracking_lidar_priority")==0||strcmp(s,"turning_lidar_priority")==0||strcmp(s,"reacquired_free_space")==0);}
void controller_navigation_metrics_tick(int active,double dt,double *t,int *n){if(active){if(t)*t+=dt;if(n)++*n;}}
