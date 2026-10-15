#include "controller_delivery.h"
#include "controller_transfer_route.h"
#include <cmath>
#include <limits>
#include <string.h>
using std::isfinite;
#define GRID_WIDTH 215
#define GRID_HEIGHT 165
#define GRID_COUNT (GRID_WIDTH*GRID_HEIGHT)
#define CELL 0.2
static int parent[GRID_COUNT],queue[GRID_COUNT];
static unsigned char visited[GRID_COUNT];
static double gx(int index) { return -21.4+(index%GRID_WIDTH)*CELL; }
static double gy(int index) { return -16.4+(index/GRID_WIDTH)*CELL; }
static int cell_index(double x,double y) {
  int ix=(int)round((x+21.4)/CELL),iy=(int)round((y+16.4)/CELL);
  return ix>=0 && ix<GRID_WIDTH && iy>=0 && iy<GRID_HEIGHT ? iy*GRID_WIDTH+ix : -1;
}
int controller_delivery_segment_clear(double ax,double ay,double bx,double by,ControllerDeliverySafe safe,void *context) {
  if(!safe || !std::isfinite(ax) || !std::isfinite(ay) || !std::isfinite(bx) || !std::isfinite(by) ||
      fabs(ax)>21.5 || fabs(bx)>21.5 || fabs(ay)>16.5 || fabs(by)>16.5)return 0;
  int steps=(int)ceil(hypot(bx-ax,by-ay)/0.04);
  for(int i=0;i<=steps;++i){double t=steps ? (double)i/steps : 0;if(!safe(context,ax+(bx-ax)*t,ay+(by-ay)*t))return 0;}
  return 1;
}
static int grid_connection(double x,double y,ControllerDeliverySafe safe,void *context) {
  const int nearest=cell_index(x,y);
  if(nearest<0)return -1;
  const int cx=nearest%GRID_WIDTH,cy=nearest/GRID_WIDTH;
  for(int radius=0;radius<=4;++radius) {
    int best=-1;double distance=std::numeric_limits<double>::infinity();
    for(int dy=-radius;dy<=radius;++dy)for(int dx=-radius;dx<=radius;++dx) {
      if(abs(dx)!=radius && abs(dy)!=radius)continue;
      const int ix=cx+dx,iy=cy+dy;
      if(ix<0 || iy<0 || ix>=GRID_WIDTH || iy>=GRID_HEIGHT)continue;
      const int index=iy*GRID_WIDTH+ix;
      const double candidate=hypot(gx(index)-x,gy(index)-y);
      if(candidate<distance && controller_delivery_segment_clear(x,y,gx(index),gy(index),safe,context)) {
        distance=candidate;best=index;
      }
    }
    if(best>=0)return best;
  }
  return -1;
}
static int add_point(RouteData *route,double x,double y) {
  if(route->count>=MAX_WAYPOINTS)return 0;
  route->waypoints[route->count++]=Waypoint{.x=x,.z=y};return 1;
}
static void simplify_route(RouteData *route,ControllerDeliverySafe safe,void *context) {
  RouteData simplified=*route;simplified.count=1;
  for(int anchor=0;anchor<route->count-1;) {
    int next=route->count-1;
    const auto &a=route->waypoints[anchor];
    while(next>anchor+1 && !controller_delivery_segment_clear(a.x,a.z,
        route->waypoints[next].x,route->waypoints[next].z,safe,context))--next;
    simplified.waypoints[simplified.count++]=route->waypoints[next];
    anchor=next;
  }
  *route=simplified;
}
int controller_delivery_plan(RouteData *route,double x,double y,double tx,double ty,ControllerDeliverySafe safe,void *context) {
  if(!route)return 0;
  route->count=0;
  if(!safe || !std::isfinite(x) || !std::isfinite(y) || !std::isfinite(tx) || !std::isfinite(ty) ||
      fabs(x)>21.4 || fabs(tx)>21.4 || fabs(y)>16.4 || fabs(ty)>16.4)return 0;
  if(controller_delivery_segment_clear(x,y,tx,ty,safe,context)){
    add_point(route,x,y);return add_point(route,tx,ty);
  }
  int start=grid_connection(x,y,safe,context),end=grid_connection(tx,ty,safe,context);
  if(start<0 || end<0)return 0;
  memset(visited,0,sizeof(visited));int head=0,tail=0;
  queue[tail++]=start;visited[start]=1;parent[start]=-1;
  const int dx[4]={1,-1,0,0},dy[4]={0,0,1,-1};
  while(head<tail && !visited[end]){
    int current=queue[head++],cx=current%GRID_WIDTH,cy=current/GRID_WIDTH;
    for(int i=0;i<4;++i){int nx=cx+dx[i],ny=cy+dy[i];if(nx<0 || nx>=GRID_WIDTH || ny<0 || ny>=GRID_HEIGHT)continue;
      int next=ny*GRID_WIDTH+nx;if(visited[next] || !controller_delivery_segment_clear(gx(current),gy(current),gx(next),gy(next),safe,context))continue;
      visited[next]=1;parent[next]=current;queue[tail++]=next;
    }
  }
  if(!visited[end])return 0;
  int count=0;for(int at=end;at>=0;at=parent[at])queue[count++]=at;
  if(!add_point(route,x,y))return 0;
  for(int i=count-1;i>=0;--i){
    if(i>0 && i<count-1 && queue[i+1]-queue[i]==queue[i]-queue[i-1])continue;
    if(!add_point(route,gx(queue[i]),gy(queue[i]))){route->count=0;return 0;}
  }
  if(!add_point(route,tx,ty)){route->count=0;return 0;}
  simplify_route(route,safe,context);
  return 1;
}
void controller_delivery_velocity(double x,double y,double yaw,double tx,double ty,double desired_yaw,
    double speed,double velocity[3],int final_waypoint,int retreat,double angular_limit) {
  if(!retreat) {
    const auto command=controller_transfer_route_velocity(tx-x,ty-y,yaw,desired_yaw,
        final_waypoint,speed,angular_limit);
    velocity[0]=command.vx;velocity[1]=command.vy;velocity[2]=command.omega;
    return;
  }
  // A short departure from placed cargo holds the safe heading and backs out.
  double dx=tx-x,dy=ty-y,distance=hypot(dx,dy),scale=distance>0 ? fmin(speed,distance*1.2)/distance : 0;
  velocity[0]=(cos(yaw)*dx+sin(yaw)*dy)*scale;
  velocity[1]=(-sin(yaw)*dx+cos(yaw)*dy)*scale;
  double error=atan2(sin(desired_yaw-yaw),cos(desired_yaw-yaw));
  velocity[2]=fmax(-angular_limit,fmin(angular_limit,error*1.5));
}
