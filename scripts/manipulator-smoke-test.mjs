// Real Webots physics test. Starts an isolated world and independent services.
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {mkdtemp,mkdir,cp,copyFile,readFile,writeFile,rm} from "node:fs/promises";
import {once} from "node:events";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import sceneContract from "../bridge/protocol/scene-validation.cjs";
const root=path.resolve(import.meta.dirname,"..");
const afterDemo=process.argv.includes("--after-demo");
const mobile=process.argv.includes("--mobile") || afterDemo;
const nearObject=process.argv.includes("--near-object");
const obstacle=process.argv.includes("--obstacle");
const blocked=process.argv.includes("--blocked");
const destination={x:mobile ? (obstacle ? 4 : nearObject ? 1 : 2) : 0.4,y:afterDemo ? 3 : mobile ? 1 : 0.1,z:0.04};
const directory=await mkdtemp(path.join(os.tmpdir(),"gpo-manipulator-"));
await cp(path.join(root,"webots/protos"),path.join(directory,"protos"),{recursive:true});
const children=[];
let socket;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=async()=>{const s=createServer();s.listen(0,"127.0.0.1");await once(s,"listening");const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const [gatewayPort,missionPort,planningPort,telemetryPort,webotsPort]=await Promise.all(Array.from({length:5},freePort));
const stateDir=path.join(directory,"state");
const env={...process.env,BRIDGE_BIND_HOST:"127.0.0.1",ROUTE_BIND_HOST:"127.0.0.1",TELEMETRY_BIND_HOST:"127.0.0.1",SOLVER_BIND_HOST:"127.0.0.1",GATEWAY_BIND_HOST:"127.0.0.1",GATEWAY_PORT:String(gatewayPort),GATEWAY_URL:`http://127.0.0.1:${gatewayPort}`,GATEWAY_TOKEN:"physics-test",ROUTE_PORT:String(missionPort),SOLVER_PORT:String(planningPort),TELEMETRY_PORT:String(telemetryPort),MISSION_STATE_DIR:path.join(directory,"missions"),WEB_STATE_DIR:stateDir,MOCK_TELEMETRY:"0"};
const launch=(exe,args)=>{const p=spawn(exe,args,{cwd:root,env,stdio:["ignore","pipe","pipe"],windowsHide:true});p.logs="";p.stdout.on("data",d=>p.logs+=d);p.stderr.on("data",d=>p.logs+=d);children.push(p);return p;};
const until=async(condition,label,timeout=90000,interval=200)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await condition())return;await delay(interval);}throw new Error(`Timeout: ${label}`);};
const readState=async()=>{
  for(let attempt=0;;++attempt)try{return JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));}
  catch(error){if(attempt>=10 || (error.code!=="ENOENT" && !(error instanceof SyntaxError)))throw error;await delay(5);}
};
const getMission=async id=>(await fetch(`http://127.0.0.1:${missionPort}/api/missions/${id}`)).json();
const send=command=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("ACK timeout")),15000);const receive=data=>{const ack=JSON.parse(data);if(ack.requestId===command.requestId){clearTimeout(timer);socket.off("message",receive);resolve(ack);}};socket.on("message",receive);socket.send(JSON.stringify(command));});
try {
  await mkdir(path.join(directory,"worlds"),{recursive:true});
  await mkdir(path.join(directory,"controllers","youbot_web"),{recursive:true});
  await mkdir(stateDir,{recursive:true});
  let world = await readFile(path.join(root,"webots/worlds/youbot_only.wbt"),"utf8");
  if(mobile && !nearObject && !afterDemo)world=world.replace(/(DEF PICK_BOX Solid\s*\{\s*translation\s+)[^\r\n]+/,(_line,prefix)=>`${prefix}${obstacle ? 3.4 : 1.4} -0.1 0.04`);
  if(obstacle)world+='\nDEF DELIVERY_OBSTACLE Solid { translation 1.5 0 0.2 children [ Shape { geometry Box { size 0.1 0.4 0.4 } } ] boundingObject Box { size 0.1 0.4 0.4 } }\n';
  if(blocked)world+=`\nDEF BLOCKED_DESTINATION Solid { translation ${destination.x} ${destination.y} 0.2 children [ Shape { geometry Box { size 0.3 0.3 0.4 } } ] boundingObject Box { size 0.3 0.3 0.4 } }\n`;
  await writeFile(path.join(directory,"worlds/test.wbt"), world);
  await copyFile(path.join(root,"webots/controllers/youbot_web/youbot_web.exe"),path.join(directory,"controllers/youbot_web/youbot_web.exe"));
  for(const name of ["gateway","route","planning","telemetry"])launch(process.execPath,[`bridge/processes/run-${name}-service.cjs`]);
  for(const port of [missionPort,planningPort,telemetryPort])await until(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/ready`)).ok;}catch{return false;}},`service ${port}`,15000);
  const webotsHome=process.env.WEBOTS_HOME || "C:/Program Files/Webots";
  const simulator=launch(path.join(webotsHome,"msys64/mingw64/bin/webots.exe"),["--batch","--minimize","--no-rendering","--mode=fast","--stdout","--stderr",`--port=${webotsPort}`,path.join(directory,"worlds/test.wbt")]);
  await until(async()=>{if(simulator.exitCode!==null)throw new Error(simulator.logs);try{const state=JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));return Boolean(state.pose);}catch{return false;}},"controller telemetry");
  socket=new WebSocket(`ws://127.0.0.1:${missionPort}/ui`);await once(socket,"open");
  await until(async () => (await readState()).simulationTime > 2, "settling");
  let before=await readState();
  assert.ok(Math.hypot(before.pose.x,before.pose.y)<0.015,"Robot started moving without a mission");
  if(afterDemo) {
    const scene=sceneContract.normalizeScene({});
    const demoAck=await send({requestId:"demo-before-pick",type:"transfer_object",objectId:"demo-box",
      destination:{x:2,y:2},scene,sceneRevision:sceneContract.sceneRevision(scene)});
    assert.equal(demoAck.ok,true,JSON.stringify(demoAck));
    await until(async()=>{
      const mission=await getMission("demo-before-pick");
      if(["failed","holding_for_recovery"].includes(mission.status))throw new Error(JSON.stringify(mission));
      return mission.status==="completed";
    },"demo delivery before PICK_BOX",180000);
    before=await readState();
    console.log(`DEMO_BOX placed; fetching PICK_BOX from ${JSON.stringify(before.pose)}`);
  }
  runScenario: {
  const ack = await send({requestId:"arm-physics",type:"pick_place",objectDef:"PICK_BOX",destination});
  assert.equal(ack.ok,true,JSON.stringify(ack));
  if(blocked) {
    await until(async()=>(await getMission("arm-physics")).status==="failed","blocked destination rejection");
    const mission=await getMission("arm-physics"),state=await readState();
    assert.equal(mission.failureReason,"delivery_path_blocked");
    assert.ok(Math.hypot(state.pose.x-before.pose.x,state.pose.y-before.pose.y)<0.01);
    assert.ok(Math.abs(state.manipulator.objectPosition.z-0.04)<0.005,"Picked up cargo despite blocked destination");
    await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
    await writeFile(path.join(root,"output/manipulator-smoke/mobile-delivery-blocked.json"),JSON.stringify({mission,state},null,2));
    console.log("Blocked delivery rejected before driving or pickup.");
    break runScenario;
  }
  const observations=[];
  const baseTrace=[];
  let lastStage;
  let injectedRoute = false;
  let injectedRuntime = false;
  await until(async()=>{
    const state=await readState();
    baseTrace.push({x:state.pose.x,y:state.pose.y,yaw:state.pose.yaw,time:state.simulationTime,
      stage:state.manipulator?.stage,distance:state.navigation.distanceToTarget,
      waypoint:state.navigation.currentWaypointIndex});
    if (process.argv.includes("--inject-route") && !injectedRoute && state.manipulator?.active) {
      await writeFile(path.join(stateDir,"route.csv"), "x,y,heading_deg\n# command foreign-route\n0,0,0\n1,0,0\n");
      const runtimePath = path.join(stateDir,"runtime_command.txt");
      const commands = await readFile(runtimePath,"utf8");
      const lastId = [...commands.matchAll(/^id (\d+)$/gm)].reduce((max,match)=>Math.max(max,Number(match[1])),0);
      await writeFile(runtimePath,`${commands}\nid ${lastId+1}\ntype start_mapping_survey\nmission_id foreign-survey\nid ${lastId+2}\ntype pick_place\nmission_id foreign-arm\nobject_def PICK_BOX\ntarget_x 0.4\ntarget_y -0.1\ntarget_z 0.04\n`);
      injectedRuntime = true;
      injectedRoute = true;
    }
    assert.ok(!injectedRoute || state.navigation.missionId !== "foreign-route", "A route update preempted an active manipulator mission");
    assert.ok(!injectedRuntime || !["foreign-survey","foreign-arm"].includes(state.navigation.missionId), "A runtime command preempted an active manipulator mission");
    if(state.manipulator?.stage!==lastStage){ lastStage=state.manipulator?.stage; observations.push(state); console.log(lastStage,JSON.stringify(state.manipulator)); }
    const m=await getMission("arm-physics");
    if(m.status==="failed")throw new Error(JSON.stringify(state));
    return m.status==="completed";
  },"physical pick-place",mobile ? 180000 : 90000);
  const final=await readState();
  let naturalDrivingChecks=0;
  for(let i=1;i<baseTrace.length;++i) {
    const previous=baseTrace[i-1],current=baseTrace[i];
    const dx=current.x-previous.x,dy=current.y-previous.y;
    const turn=Math.atan2(Math.sin(current.yaw-previous.yaw),Math.cos(current.yaw-previous.yaw));
    if(previous.stage!=="carrying" || current.stage!=="carrying" || current.waypoint!==previous.waypoint ||
        Math.min(previous.distance,current.distance)<.2 || Math.abs(turn)>.05 || Math.hypot(dx,dy)<.005)continue;
    const heading=previous.yaw+turn*.5;
    const error=Math.atan2(Math.sin(Math.atan2(dy,dx)-heading),Math.cos(Math.atan2(dy,dx)-heading));
    assert.ok(Math.abs(error)<.45,`Cargo moved sideways during cruise: heading error ${error}`);
    ++naturalDrivingChecks;
  }
  if(mobile)assert.ok(naturalDrivingChecks>0,"No measured forward cargo travel");
  if(obstacle) {
    assert.ok(baseTrace.some(p=>Math.abs(p.y)>0.6),"Robot did not detour around the obstacle");
    assert.ok(baseTrace.every(p=>Math.hypot(Math.max(0,Math.abs(p.x-1.5)-0.05),Math.max(0,Math.abs(p.y)-0.2))>0.30),"Base collided with the obstacle");
  }
  if (process.argv.includes("--inject-route")) assert.ok(injectedRoute, "Route interlock was not exercised");
  assert.ok(Math.hypot(final.manipulator.objectPosition.x-destination.x,final.manipulator.objectPosition.y-destination.y)<0.035);
  assert.ok(observations.some(s=>s.manipulator.objectPosition.z>0.08),"Object never lifted");
  if(mobile) {
    if(!nearObject)assert.ok(observations.some(s=>s.manipulator.stage==="driving_to_object"),"Base never fetched the distant object");
    assert.ok(observations.some(s=>s.manipulator.stage==="carrying"),"Base never carried the load");
    assert.ok(Math.hypot(final.pose.x,final.pose.y)>0.5,"Base never moved to the destination");
  } else assert.ok(Math.hypot(final.pose.x,final.pose.y)<0.015,"Base moved");
  if(process.argv.includes("--route-after-delivery")) {
    const route=Array.from({length:100},(_value,index)=>{
      const angle=Math.PI+index*2*Math.PI/99;
      return {x:final.pose.x+1+Math.cos(angle),y:final.pose.y+Math.sin(angle)};
    });
    route[99].headingDeg=final.pose.yaw*180/Math.PI;
    const routeAck=await send({requestId:"route-after-arm",type:"route",route});
    assert.equal(routeAck.ok,true,JSON.stringify(routeAck));
    let furthest=0;
    await until(async()=>{
      const state=await readState();
      if(state.navigation.missionId!=="route-after-arm")return false;
      furthest=Math.max(furthest,state.navigation.currentWaypointIndex);
      if(furthest<5 && state.simulationTime-final.simulationTime>60)throw new Error(`Route spins after delivery: waypoint ${furthest}, ${state.navigation.status}, lidar ${state.perception.lidar.frontMinRange}`);
      const mission=await getMission("route-after-arm");
      if(mission.status==="failed")throw new Error(JSON.stringify(mission));
      return mission.status==="completed";
    },"route after delivery",240000);
    assert.ok(furthest>=route.length-5,"Route completed without visiting its waypoints");
    const result={pointCount:route.length,furthest,afterDelivery:final,afterRoute:await readState()};
    await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
    await writeFile(path.join(root,"output/manipulator-smoke/route-after-delivery-100.json"),JSON.stringify(result,null,2));
    console.log(`${route.length}-point physical route completed after delivery.`);
    break runScenario;
  }
  const reverseAck = await send({requestId:"arm-reverse",type:"pick_place",objectDef:"PICK_BOX",destination:{x:0.4,y:-0.1,z:0.04}});
  assert.equal(reverseAck.ok,true,JSON.stringify(reverseAck));
  await until(async()=>{
    const mission=await getMission("arm-reverse");
    if(mission.status==="failed") throw new Error(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));
    return mission.status==="completed";
  },"repeat transfer",mobile ? 180000 : 90000);
  const reverse=await readState();
  assert.ok(Math.hypot(reverse.manipulator.objectPosition.x-0.4,reverse.manipulator.objectPosition.y+0.1)<0.035);
  const badAck=await send({requestId:"arm-unreachable",type:"pick_place",objectDef:"PICK_BOX",destination:{x:4,y:0,z:0.9}});
  assert.equal(badAck.ok,true);
  await until(async()=>(await getMission("arm-unreachable")).status==="failed","unreachable target rejection");
  const failedMission = await getMission("arm-unreachable");
  assert.equal(failedMission.failureReason, "target_unreachable");
  const failed=await readState();
  assert.equal(failed.manipulator.error,"target_unreachable");
  const missingAck=await send({requestId:"arm-missing",type:"pick_place",objectDef:"MISSING_BOX",destination:{x:0.4,y:0.1,z:0.04}});
  assert.equal(missingAck.ok,true);
  await until(async()=>(await getMission("arm-missing")).status==="failed","missing object rejection");
  const cancelAck=await send({requestId:"arm-cancel",type:"pick_place",objectDef:"PICK_BOX",destination:mobile ? destination : {x:0.4,y:0.1,z:0.04}});
  assert.equal(cancelAck.ok,true);
  let carryStartPose;
  // Fast-mode physics can pass a short stage between 200 ms samples.
  await until(async()=>{
    const snapshot=await readState();
    const arm=snapshot.manipulator;
    if(arm?.missionId!=="arm-cancel")return false;
    assert.ok(!["completed","failed","cancelled"].includes(arm.stage), `Cancellation window missed: ${arm.stage} (${arm.error})`);
    if(!mobile)return arm.stage==="lifting" && arm.objectPosition.z>0.08;
    if(arm.stage!=="carrying")return false;
    carryStartPose ||= snapshot.pose;
    return Math.hypot(snapshot.pose.x-carryStartPose.x,snapshot.pose.y-carryStartPose.y)>0.15;
  },"lifting before cancel",mobile ? 90000 : 30000,5);
  const cancel=await fetch(`http://127.0.0.1:${missionPort}/api/missions/arm-cancel/cancel`,{method:"POST"});
  assert.equal(cancel.status,202);
  await until(async()=>(await getMission("arm-cancel")).status==="cancelled","arm cancellation");
  const stopped=await readState();
  await delay(500);
  const afterStop=await readState();
  assert.equal(afterStop.manipulator.stage,"cancelled");
  assert.equal(afterStop.navigation.status,"mission_cancelled");
  assert.ok(Math.hypot(afterStop.pose.x-stopped.pose.x,afterStop.pose.y-stopped.pose.y)<0.01,"Base moved after cancellation");
  assert.ok(afterStop.manipulator.joints.every((q,i)=>Math.abs(q-stopped.manipulator.joints[i])<0.02),"Arm moved after cancellation");
  const heldObject = afterStop.manipulator.objectPosition;
  const stoppedObject = stopped.manipulator.objectPosition;
  // Loaded cancellation maintains closing force; asymmetric contacts can redistribute.
  assert.ok(afterStop.manipulator.fingers.reduce((sum,q)=>sum+q,0)>0.002,"Gripper became empty after cancellation");
  assert.ok(heldObject.z>(mobile ? 0.08 : 0.06) && Math.abs(heldObject.z-stoppedObject.z)<0.015,"Cargo dropped after cancellation");
  assert.ok(Math.hypot(heldObject.x-stoppedObject.x,heldObject.y-stoppedObject.y,heldObject.z-stoppedObject.z)<(mobile ? 0.03 : 0.02),"Object moved out of the grasp after cancellation");
  await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
  const reportName = afterDemo ? "pick-after-demo.json" : mobile ? obstacle ? "mobile-delivery-obstacle.json" : nearObject ? "mobile-delivery-near.json" : "mobile-delivery.json" : injectedRoute ? "manipulator-route-interlock.json" : "manipulator-physics.json";
  await writeFile(path.join(root,"output/manipulator-smoke",reportName),JSON.stringify({injectedRoute,injectedRuntime,naturalDrivingChecks,baseTrace,observations,final,reverse,failed,failedMission,stopped,afterStop},null,2));
  console.log("Physical pick-place, repeat, unreachable/missing object, and cancellation passed.");
  }
} catch(error) {
  await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
  const lastState = await readFile(path.join(stateDir,"robot_state.json"),"utf8").catch(()=>null);
  await writeFile(path.join(root,"output/manipulator-smoke/manipulator-failure.json"),JSON.stringify({error:error.message,lastState},null,2));
  for(const child of children)console.error(child.logs.slice(-8000));
  throw error;
} finally {
  socket?.terminate();
  for(const child of children.reverse()){
    if(child.exitCode!==null || child.signalCode)continue;
    if(process.platform==="win32") {const killer=spawn("taskkill",["/PID",String(child.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});await once(killer,"exit");}
    else child.kill("SIGTERM");
  }
  const cleanupPath = path.resolve(directory);
  assert.equal(path.dirname(cleanupPath), path.resolve(os.tmpdir()));
  assert.ok(path.basename(cleanupPath).startsWith("gpo-manipulator-"));
  await rm(cleanupPath,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
