import {afterEach, expect, it} from "vitest";
import {mkdtemp, readFile, writeFile, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import missions from "./mission-service.cjs";
import gateways from "./gateway-service.cjs";
import routes from "./route-service.cjs";
import repositories from "../repositories/mission-repository.cjs";
import stores from "../artifacts/web-state-store.cjs";
import adapters from "../adapters/webots-file-adapter.cjs";
import coordinateContract from "../../shared/coordinate-contract.json";

const directories = [];
afterEach(async () => {for (const directory of directories.splice(0)) await rm(directory,{recursive:true,force:true});});

it("delivers one survey across retries, tracks feedback and cancellation, then allows a route", async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "gpo-survey-"));
  directories.push(stateDir);
  const repository = repositories.createMissionRepository({directory:path.join(stateDir,"missions")});
  const gatewayRepository = repositories.createMissionRepository({directory:path.join(stateDir,"gateway")});
  const artifactStore = stores.createWebStateStore({coordinateContract,stateDir});
  const fileAdapter = adapters.createWebotsFileAdapter({artifactStore,stateDir});
  let gateway = gateways.createGatewayService({repository:gatewayRepository,adapter:fileAdapter});
  const adapter = {
    submit: command => gateway.execute("submit",command.commandId,command),
    cancel: missionId => gateway.execute("cancel",missionId,{missionId}),
    getFeedback: missionId => gateway.getFeedback(missionId),
  };
  let missionService = missions.createMissionService({repository,adapter});
  let routeService = routes.createRouteService({missionService});
  const requestId = "s".repeat(63);
  const survey = {type:"start_mapping_survey",mode:"double",clearMap:true};
  expect(await routeService.handle(survey,{requestId})).toMatchObject({missionId:requestId,status:"persisted"});
  gateway = gateways.createGatewayService({repository:gatewayRepository,adapter:fileAdapter});
  missionService = missions.createMissionService({repository,adapter});
  routeService = routes.createRouteService({missionService});
  await routeService.handle(survey,{requestId});
  // An uncertain adapter write may be retried even without the gateway journal.
  await fileAdapter.submit({...survey,commandId:requestId});
  const text = await readFile(artifactStore.paths.runtimeCommand,"utf8");
  expect(text.match(/type start_mapping_survey/g)).toHaveLength(1);
  expect(text).toContain(`mission_id ${requestId}\n`);
  expect((await gatewayRepository.get("gateway-active")).commandId).toBe(requestId);
  const route = {type:"route",route:[{x:0,y:0},{x:1,y:0}]};
  await expect(routeService.handle(route,{requestId:"next"})).rejects.toMatchObject({statusCode:409});
  await expect(gateway.execute("submit","other",{...route,commandId:"other"})).rejects.toMatchObject({statusCode:409});
  const feedback = navigation => writeFile(path.join(stateDir,"robot_state.json"),JSON.stringify({navigation:{missionId:requestId,...navigation}}));
  await feedback({status:"mapping_survey_started",finished:false});
  expect((await missionService.get(requestId)).status).toBe("running");
  expect((await missionService.cancel(requestId)).status).toBe("cancelling");
  expect(await readFile(artifactStore.paths.runtimeCommand,"utf8")).toContain(`type cancel_mission\nmission_id ${requestId}`);
  await feedback({status:"mission_cancelled",finished:true});
  await missionService.reconcile();
  expect((await missionService.get(requestId)).status).toBe("cancelled");
  expect(await routeService.handle(route,{requestId:"next"})).toMatchObject({missionId:"next",status:"persisted"});
});
