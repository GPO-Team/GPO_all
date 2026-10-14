import { expect, it, vi } from "vitest";
import services from "./planning-service.cjs";
import scenes from "../protocol/scene-validation.cjs";

it("does not let the native permutation change numbered visit order",async()=>{
  const nativeSolver={run:vi.fn(async()=>({route:[{x:2,y:0},{x:8,y:0}],order:[1,0],length:6,closed:false}))};
  const result=await services.createPlanningService({nativeSolver}).solve({points:[{x:8,y:0},{x:2,y:0}],visitOrder:["ordered","ordered"],anchor:{x:0,y:0},task:"hamiltonian_chain",scene:scenes.normalizeScene({})});
  expect(result.order).toEqual([0,1]);
  expect(result.seedRoute).toEqual([{x:0,y:0},{x:8,y:0},{x:2,y:0}]);
  expect(nativeSolver.run).not.toHaveBeenCalled();
});
it("explains the exact forbidden target and zone rather than a generic planning failure",async()=>{
  const nativeSolver={run:vi.fn(async()=>({route:[{x:0,y:0},{x:3,y:0}],order:[0,1],length:3,closed:false}))};
  const scene=scenes.normalizeScene({polygons:[{id:"shelf",name:"Стеллаж А",points:[{x:2,y:-1},{x:4,y:-1},{x:4,y:1},{x:2,y:1}]}]});
  const service=services.createPlanningService({nativeSolver});
  await expect(service.solve({points:[{x:3,y:0},{x:5,y:0}],visitOrder:["ordered","free"],anchor:{x:0,y:0},scene,task:"hamiltonian_chain"})).rejects.toThrow(/Стеллаж А/);
});
it("rejects an invalid visit policy instead of silently dropping constraints",async()=>{
  const service=services.createPlanningService({nativeSolver:{run:vi.fn()}});
  await expect(service.solve({points:[{x:1,y:0},{x:2,y:0}],visitOrder:["ordered"]})).rejects.toMatchObject({statusCode:400});
});
