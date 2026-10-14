#include "controller_navigation_metrics.h"
#include <assert.h>
int main(void){double t=0;int n=0;assert(controller_navigation_metrics_off_route(0,1,0,"avoiding_gap_drive"));assert(!controller_navigation_metrics_off_route(1,1,1,"avoiding_gap_drive"));controller_navigation_metrics_tick(1,.016,&t,&n);assert(t>.015&&n==1);return 0;}
