import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {mkdtemp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {once} from "node:events";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import {createRouteCommand} from "../shared/contracts/index.js";

const root = path.resolve(import.meta.dirname,"..");
const directory = await mkdtemp(path.join(os.tmpdir(),"gpo-services-"));
const children = [];
let socket, telemetrySocket;
const port = async () => {
  const server = createServer();server.listen(0,"127.0.0.1");await once(server,"listening");
  const value = server.address().port;await new Promise(resolve => server.close(resolve));return value;
};
const [planningPort,routePort,telemetryPort,gatewayPort] = await Promise.all([port(),port(),port(),port()]);
const env = {...process.env,BRIDGE_BIND_HOST:"127.0.0.1",SOLVER_PORT:String(planningPort),ROUTE_PORT:String(routePort),TELEMETRY_PORT:String(telemetryPort),GATEWAY_PORT:String(gatewayPort),GATEWAY_BIND_HOST:"127.0.0.1",GATEWAY_URL:`http://127.0.0.1:${gatewayPort}`,GATEWAY_TOKEN:"smoke-secret",WEB_STATE_DIR:path.join(directory,"simulator"),MISSION_STATE_DIR:path.join(directory,"missions")};
for (const name of ["gateway","route","planning","telemetry"]) await mkdir(path.join(directory,name),{recursive:true});
const start = name => {
  const child = spawn(process.execPath,[path.join(root,`bridge/processes/run-${name}-service.cjs`)],{cwd:path.join(directory,name),env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  child.logs="";child.stdout.on("data",data => child.logs+=data);child.stderr.on("data",data => child.logs+=data);children.push(child);return child;
};
const stop = async child => {if(child.exitCode !== null || child.signalCode) return;const exited=once(child,"exit");child.kill();const [code]=await exited;if(process.platform!=="win32")assert.equal(code,0,child.logs);};
const waitReady = async (portNumber,child) => {
  for(let i=0;i<100;i++) {
    if(child.exitCode !== null) throw new Error(child.logs);
    try {const response=await fetch(`http://127.0.0.1:${portNumber}/ready`,{signal:AbortSignal.timeout(1000),headers:{Authorization:"Bearer smoke-secret"}});if(response.ok)return;} catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve,100));
  }
  throw new Error(`Service not ready: ${child.logs}`);
};
const send = command => new Promise((resolve,reject) => {
  const timer=setTimeout(() => {socket.off("message",receive);reject(new Error("ACK timeout"));},10000);
  const receive=data => {const response=JSON.parse(data.toString());if(response.requestId!==command.requestId)return;clearTimeout(timer);socket.off("message",receive);resolve(response);};
  socket.on("message",receive);socket.send(JSON.stringify(command));
});
const getMission = async () => (await fetch(`http://127.0.0.1:${routePort}/api/missions/smoke-mission`)).json();
try {
  let gateway=start("gateway");
  const planning=start("planning"), telemetry=start("telemetry");let missions=start("route");
  await Promise.all([waitReady(planningPort,planning),waitReady(routePort,missions),waitReady(telemetryPort,telemetry),waitReady(gatewayPort,gateway)]);
  const scene={polygons:[],surfaceZones:[],chargingStations:[],motion:{cruiseSpeedMps:0.22,payloadKg:0,batteryRange:100}};
  const response=await fetch(`http://127.0.0.1:${planningPort}/api/solve-route`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({points:[{x:0,y:0},{x:1,y:0}],scene,task:"tsp"})});
  const plan=await response.json();assert.equal(plan.ok,true,JSON.stringify(plan));assert.ok(plan.planning.routeEnergy>0);
  socket=new WebSocket(`ws://127.0.0.1:${routePort}/ui`);await once(socket,"open");
  const command=createRouteCommand({source:"services-smoke",requestId:"smoke-mission",payload:{type:"route",route:plan.route,seedRoute:plan.seedRoute,scene}});
  const ack=await send(command);assert.equal(ack.ok,true,JSON.stringify(ack));assert.equal(ack.missionId,"smoke-mission");
  const csv=await readFile(path.join(directory,"simulator","route.csv"),"utf8");assert.match(csv,/# command smoke-mission/);
  assert.equal((await send(command)).ok,true);assert.equal(await readFile(path.join(directory,"simulator","route.csv"),"utf8"),csv);
  // Synthetic controller feedback: this is a transport test, not a physics simulation.
  await writeFile(path.join(directory,"simulator","robot_state.json"),JSON.stringify({navigation:{missionId:"another-mission",finished:true}}));
  assert.equal((await getMission()).status,"persisted");
  await writeFile(path.join(directory,"simulator","robot_state.json"),JSON.stringify({navigation:{missionId:"smoke-mission",finished:true}}));
  assert.equal((await getMission()).status,"completed");
  socket.terminate();socket=null;await stop(missions);missions=start("route");await waitReady(routePort,missions);
  assert.equal((await getMission()).status,"completed");
  socket=new WebSocket(`ws://127.0.0.1:${routePort}/ui`);await once(socket,"open");
  assert.equal((await send(command)).status,"completed");assert.equal(await readFile(path.join(directory,"simulator","route.csv"),"utf8"),csv);
  // Gateway restart retains its delivery journal and does not replay a route.
  await stop(gateway);gateway=start("gateway");await waitReady(gatewayPort,gateway);
  assert.equal((await send(command)).status,"completed");
  assert.equal(await readFile(path.join(directory,"simulator","route.csv"),"utf8"),csv);
  // Wrong versions and credentials are rejected before side effects.
  const badVersion=await fetch(`http://127.0.0.1:${gatewayPort}/v1/commands`,{method:"POST",headers:{Authorization:"Bearer smoke-secret","Content-Type":"application/json"},body:JSON.stringify({version:99})});
  assert.equal(badVersion.status,400);
  assert.equal((await fetch(`http://127.0.0.1:${gatewayPort}/ready`)).status,401);
  // Submission while gateway is down remains prepared and recovers in background.
  await stop(gateway);
  const recovered=createRouteCommand({source:"services-smoke",requestId:"recover-mission",payload:command.payload});
  const offlineAck=await send(recovered);assert.equal(offlineAck.ok,false);
  gateway=start("gateway");await waitReady(gatewayPort,gateway);
  const waitStatus=async(id,status)=>{
    for(let i=0;i<100;i++){
      const r=await fetch(`http://127.0.0.1:${routePort}/api/missions`);const body=await r.json();
      if(body.missions?.some(m=>m.missionId===id && m.status===status))return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }throw new Error(`Missing status ${id}: ${status}`);
  };
  await waitStatus("recover-mission","persisted");
  assert.match(await readFile(path.join(directory,"simulator","route.csv"),"utf8"),/# command recover-mission/);
  const conflict=await send(createRouteCommand({source:"services-smoke",requestId:"cannot-replace",payload:command.payload}));
  assert.equal(conflict.statusCode,409);
  const cancelled=await fetch(`http://127.0.0.1:${routePort}/api/missions/recover-mission/cancel`,{method:"POST"});
  assert.equal((await cancelled.json()).status,"cancelling");
  await writeFile(path.join(directory,"simulator","robot_state.json"),JSON.stringify({navigation:{missionId:"recover-mission",status:"mission_cancelled",finished:true}}));
  // List endpoint doesn't reconcile; this asserts background collection with no mission GET.
  await waitStatus("recover-mission","cancelled");
  telemetrySocket=new WebSocket(`ws://127.0.0.1:${telemetryPort}`);await once(telemetrySocket,"open");
  const telemetryReceived=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("Telemetry forwarding timeout")),5000);
    telemetrySocket.on("message",data=>{const event=JSON.parse(data);if(event.payload?.pose?.x===3.25){clearTimeout(timeout);resolve(event);}});
  });
  await writeFile(path.join(directory,"simulator","robot_state.json"),JSON.stringify({pose:{x:3.25,y:1,z:0,yaw:0},navigation:{missionId:"recover-mission",status:"mission_cancelled",finished:true}}));
  assert.equal((await telemetryReceived).type,"telemetry.event");
  const survey={type:"start_mapping_survey",requestId:"smoke-survey",mode:"snake",clearMap:true};
  const surveyAck=await send(survey);
  assert.equal(surveyAck.ok,true,JSON.stringify(surveyAck));
  assert.equal(surveyAck.missionId,"smoke-survey");
  assert.equal((await send(survey)).missionId,"smoke-survey");
  const journal=await readFile(path.join(directory,"simulator","runtime_command.txt"),"utf8");
  assert.equal(journal.match(/type start_mapping_survey/g)?.length,1);
  assert.match(journal,/mission_id smoke-survey/);
  const busy=await send(createRouteCommand({source:"services-smoke",requestId:"during-survey",payload:command.payload}));
  assert.equal(busy.statusCode,409);
  await writeFile(path.join(directory,"simulator","robot_state.json"),JSON.stringify({navigation:{missionId:"smoke-survey",status:"mapping_survey_started",finished:false}}));
  await waitStatus("smoke-survey","running");
  const cancelSurvey=await fetch(`http://127.0.0.1:${routePort}/api/missions/smoke-survey/cancel`,{method:"POST"});
  assert.equal((await cancelSurvey.json()).status,"cancelling");
  await writeFile(path.join(directory,"simulator","robot_state.json"),JSON.stringify({navigation:{missionId:"smoke-survey",status:"mission_cancelled",finished:true}}));
  await waitStatus("smoke-survey","cancelled");
  console.log("services smoke passed: independent processes, planning, route and survey missions, ACK, idempotency, exclusion, cancellation, matched feedback, restart");
} finally {
  telemetrySocket?.terminate();socket?.terminate();await Promise.all(children.map(stop));
  await rm(directory,{recursive:true,force:true});
}
