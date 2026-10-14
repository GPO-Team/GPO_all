// Real Webots physics test. Starts an isolated world and independent services.
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {mkdtemp,mkdir,cp,copyFile,readFile,writeFile,rm} from "node:fs/promises";
import {once} from "node:events";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import {createRouteCommand} from "../shared/contracts/index.js";
const root=path.resolve(import.meta.dirname,"..");
const directory=await mkdtemp(path.join(os.tmpdir(),"gpo-physics-"));
const children=[];
let socket;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=async()=>{const s=createServer();s.listen(0,"127.0.0.1");await once(s,"listening");const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const [gatewayPort,missionPort,planningPort,telemetryPort,webotsPort]=await Promise.all(Array.from({length:5},freePort));
const stateDir=path.join(directory,"state");
const env={...process.env,BRIDGE_BIND_HOST:"127.0.0.1",ROUTE_BIND_HOST:"127.0.0.1",TELEMETRY_BIND_HOST:"127.0.0.1",SOLVER_BIND_HOST:"127.0.0.1",GATEWAY_BIND_HOST:"127.0.0.1",GATEWAY_PORT:String(gatewayPort),GATEWAY_URL:`http://127.0.0.1:${gatewayPort}`,GATEWAY_TOKEN:"physics-test",ROUTE_PORT:String(missionPort),SOLVER_PORT:String(planningPort),TELEMETRY_PORT:String(telemetryPort),MISSION_STATE_DIR:path.join(directory,"missions"),WEB_STATE_DIR:stateDir,MOCK_TELEMETRY:"0"};
const launch=(exe,args)=>{const p=spawn(exe,args,{cwd:root,env,stdio:["ignore","pipe","pipe"],windowsHide:true});p.logs="";p.stdout.on("data",d=>p.logs+=d);p.stderr.on("data",d=>p.logs+=d);children.push(p);return p;};
const until=async(condition,label,timeout=90000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await condition())return;await delay(200);}throw new Error(`Timeout: ${label}`);};
const getMission=async id=>(await fetch(`http://127.0.0.1:${missionPort}/api/missions/${id}`)).json();
const send=command=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("ACK timeout")),15000);const receive=data=>{const ack=JSON.parse(data);if(ack.requestId===command.requestId){clearTimeout(timer);socket.off("message",receive);resolve(ack);}};socket.on("message",receive);socket.send(JSON.stringify(command));});
try {
  await mkdir(path.join(directory,"worlds"),{recursive:true});
  await mkdir(path.join(directory,"controllers","youbot_web"),{recursive:true});
  await mkdir(stateDir,{recursive:true});
  await copyFile(path.join(root,"webots/worlds/youbot_only.wbt"),path.join(directory,"worlds/test.wbt"));
  await cp(path.join(root,"webots/protos"),path.join(directory,"protos"),{recursive:true});
  await copyFile(path.join(root,"webots/controllers/youbot_web/youbot_web.exe"),path.join(directory,"controllers/youbot_web/youbot_web.exe"));
  for(const name of ["gateway","route","planning","telemetry"])launch(process.execPath,[`bridge/processes/run-${name}-service.cjs`]);
  for(const port of [missionPort,planningPort,telemetryPort])await until(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/ready`)).ok;}catch{return false;}},`service ${port}`,15000);
  const webotsHome=process.env.WEBOTS_HOME || "C:/Program Files/Webots";
  const simulator=launch(path.join(webotsHome,"msys64/mingw64/bin/webots.exe"),["--batch","--minimize","--no-rendering","--mode=fast","--stdout","--stderr",`--port=${webotsPort}`,path.join(directory,"worlds/test.wbt")]);
  await until(async()=>{if(simulator.exitCode!==null)throw new Error(simulator.logs);try{const state=JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));return Boolean(state.pose);}catch{return false;}},"controller telemetry");
  socket=new WebSocket(`ws://127.0.0.1:${missionPort}/ui`);await once(socket,"open");
  const scene={polygons:[],surfaceZones:[],chargingStations:[],motion:{cruiseSpeedMps:0.22,payloadKg:0,batteryRange:100}};
  const planResponse=await fetch(`http://127.0.0.1:${planningPort}/api/solve-route`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({points:[{x:0,y:0},{x:1,y:0}],scene,task:"tsp"})});
  const plan=await planResponse.json();assert.equal(plan.ok,true);
  const route=plan.route;
  const ack=await send(createRouteCommand({source:"physics-test",requestId:"physics-complete",payload:{type:"route",route,seedRoute:plan.seedRoute,scene}}));assert.equal(ack.ok,true,JSON.stringify(ack));
  await until(async()=>{const m=await getMission("physics-complete");if(m.status==="failed")throw new Error(JSON.stringify(m));return m.status==="completed";},"physical route completion",120000);
  console.log("Real Webots route completed.");
  const longRoute=[{x:0,y:0},{x:18,y:0}];
  const second=await send(createRouteCommand({source:"physics-test",requestId:"physics-cancel",payload:{type:"route",route:longRoute,scene}}));assert.equal(second.ok,true,JSON.stringify(second));
  await until(async()=>(await getMission("physics-cancel")).status==="running","physical movement",30000);
  const cancel=await fetch(`http://127.0.0.1:${missionPort}/api/missions/physics-cancel/cancel`,{method:"POST"});assert.equal(cancel.status,202);
  await until(async()=>(await getMission("physics-cancel")).status==="cancelled","physical cancellation",30000);
  const first=JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));await delay(1000);
  const last=JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));
  assert.equal(last.navigation.status,"mission_cancelled");
  const distance=Math.hypot(last.pose.x-first.pose.x,last.pose.y-first.pose.y);
  assert.ok(distance<0.05,`Robot continued moving after cancel: ${distance}`);
  await mkdir(path.join(root,"output"),{recursive:true});
  await writeFile(path.join(root,"output/physics-smoke-result.json"),JSON.stringify({completed:true,cancelled:true,postCancelDistance:distance,lastState:last},null,2));
  console.log(`Real Webots cancellation confirmed; movement after stop ${distance.toFixed(6)} m.`);
} catch(error) {
  for(const child of children)console.error(child.logs.slice(-8000));
  throw error;
} finally {
  socket?.terminate();
  for(const child of children.reverse()){
    if(child.exitCode!==null || child.signalCode)continue;
    if(process.platform==="win32") {const killer=spawn("taskkill",["/PID",String(child.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});await once(killer,"exit");}
    else child.kill("SIGTERM");
  }
  await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
