import { expect, it } from "vitest";
import { buildObstacleAwareRoute, sanitizeRouteForController } from "./zonePlannerRouting.js";
it("preserves intermediate mandatory visits even when they lie on a straight line",()=>{
  const visits=[{x:0,y:0},{x:1,y:0},{x:2,y:0}];
  const polygons=[{points:[{x:10,y:10},{x:11,y:10},{x:11,y:11},{x:10,y:11}]}];
  expect(buildObstacleAwareRoute(visits,polygons)).toEqual(visits);
});
it("does not smooth away closely spaced mandatory points",()=>{
  const visits=[{x:0,y:0},{x:0.1,y:0},{x:1,y:0}];
  expect(sanitizeRouteForController(visits,visits)).toEqual(visits);
});
