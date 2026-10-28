#include "controller_webots_object_adapter.h"
#include <cassert>
#include <cmath>

int main() {
  WbContactPoint object[]={{{1,2,.2},32},{{1,2.025,.2},32}};
  WbContactPoint robot[]={{{1,2,.2},236},{{1,2.025,.2},252}};
  assert(controller_webots_object_adapter_contact(object,2,robot,2,236));
  assert(controller_webots_object_adapter_contact(object,2,robot,2,252));
  assert(!controller_webots_object_adapter_contact(object,2,robot,2,100));
  assert(!controller_webots_object_adapter_contact(object,1,robot,2,252));
  robot[0].point[0]+=.002;
  assert(!controller_webots_object_adapter_contact(object,2,robot,2,236));
  robot[0].point[0]=NAN;
  assert(!controller_webots_object_adapter_contact(object,2,robot,2,236));
  assert(!controller_webots_object_adapter_contact(nullptr,2,robot,2,236));
  assert(!controller_webots_object_adapter_contact(object,2,nullptr,2,236));
  assert(!controller_webots_object_adapter_contact(object,2,robot,2,-1));
}
