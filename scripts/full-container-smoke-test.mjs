import {spawn} from "node:child_process";
import {once} from "node:events";
import assert from "node:assert/strict";
import WebSocket from "ws";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {createRouteCommand} from "../shared/contracts/index.js";

const require = createRequire(import.meta.url);
const {normalizeScene, sceneRevision} = require("../bridge/protocol/scene-validation.cjs");
const project=`gpo-full-test-${Date.now()}`;
const root=new URL("../",import.meta.url);
const sockets=[];
let telemetry;
const simulatorFiles=process.env.SIMULATOR_GPU === "1" ? ["-f","compose.simulator.gpu-wslg.yaml"] : [];
const compose=(...args)=>new Promise((resolve,reject)=>{
  const child=spawn("docker",["compose","-p",project,"-f","compose.yaml","-f","compose.simulator.yaml",...simulatorFiles,...args],{cwd:root,windowsHide:true,stdio:"inherit"});
  child.on("error",reject);child.on("exit",code=>code===0 ? resolve() : reject(new Error(`Compose exit ${code}`)));
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(condition,label,timeout=120000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){if(await condition())return;await delay(250);}
  throw new Error(`Timeout: ${label}`);
}
const mission=async id=>(await fetch(`http://127.0.0.1:9002/api/missions/${id}`)).json();
const warehouse=async(path="",body)=>{
  const response=await fetch(`http://127.0.0.1:9002/api/warehouse${path}`,{
    ...(body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {}),
    signal:AbortSignal.timeout(15000),
  });
  const result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  assert.equal(result.ok,true,JSON.stringify(result));
  return result;
};
async function connect(url) {
  const socket=new WebSocket(url);sockets.push(socket);await once(socket,"open");return socket;
}
async function send(socket,id,route,transfer = false) {
  const scene = normalizeScene({polygons:[],surfaceZones:[],chargingStations:[],motion:{cruiseSpeedMps:0.22,payloadKg:0,batteryRange:100}});
  const payload = transfer === true ? {type:"transfer_object",objectId:"demo-box",destination:{x:2,y:0.6},scene,sceneRevision:sceneRevision(scene)} : transfer || {type:"route",route,scene};
  const command=payload.type === "pick_place" ? {...payload,requestId:id}
    : createRouteCommand({source:"full-container-test",requestId:id,payload});
  const reply=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off("message",receive);reject(new Error("ACK timeout"));},15000);
    function receive(data){const ack=JSON.parse(data);if(ack.requestId===id){clearTimeout(timer);socket.off("message",receive);resolve(ack);}}
    socket.on("message",receive);
  });
  socket.send(JSON.stringify(command));const ack=await reply;assert.equal(ack.ok,true,JSON.stringify(ack));
}
try {
  await compose("up","-d","--no-build","--wait","--wait-timeout","180");
  const plan=await (await fetch("http://127.0.0.1:9003/api/solve-route",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({points:[{x:0,y:0},{x:1,y:0}],task:"tsp"}),
  })).json();
  assert.equal(plan.ok,true,JSON.stringify(plan));
  const mixed = await (await fetch("http://127.0.0.1:9003/api/solve-route", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({points:[{x:4,y:0},{x:9,y:0},{x:7,y:0},{x:2,y:0}],
      visitOrder:["ordered","ordered","free","free"],anchor:{x:0,y:0},task:"hamiltonian_chain"}),
  })).json();
  assert.equal(mixed.ok,true,JSON.stringify(mixed));
  assert.deepEqual(mixed.order,[3,0,2,1],"current mixed-visit policy must run inside the planning image");
  const telemetrySocket=await connect("ws://127.0.0.1:9001");
  telemetrySocket.on("message",data=>{const event=JSON.parse(data);if(event.type==="telemetry.event")telemetry=event.payload;});
  await until(()=>telemetry?.perception?.camera?.frameDataUrl,"robot camera");
  const warehousePage=await fetch("http://127.0.0.1:8080/warehouse");
  assert.equal(warehousePage.status,200,"warehouse frontend route must be served by nginx");
  assert.match(await warehousePage.text(),/<div id="root">/);
  let stored=await warehouse();
  assert.equal(stored.warehouse.cargo.length,0,"test volume must start empty");
  stored=await warehouse("/racks",{expectedRevision:stored.warehouse.revision,rack:{
    id:"container-rack",code:"DOCKER",name:"Контейнерный стеллаж",x:-4,y:-4,yaw:0,
    bays:1,placesPerBay:1,bayWidth:0.5,depth:0.5,
    levels:[{supportZ:0.1,clearHeight:0.5,maxLoadKg:2}],
  }});
  stored=await warehouse("/cargo",{expectedRevision:stored.warehouse.revision,cargo:{
    id:"container-box",label:"Коробка для проверки учёта",width:0.1,depth:0.1,height:0.1,massKg:1,
  }});
  stored=await warehouse("/tasks",{expectedRevision:stored.warehouse.revision,
    id:"container-putaway",cargoId:"container-box",destinationId:"container-rack:1:1:1"});
  assert.equal(stored.slots[0].reservedBy,"container-putaway");
  assert.equal(stored.warehouse.cargo[0].locationId,"receiving","preparing must not move inventory");
  const warehouseRevision=stored.warehouse.revision;
  assert.equal(telemetry.perception.camera.obstacleVisible,false,"the empty floor must not be classified as an obstacle");
  assert.equal(telemetry.navigation.status,"waiting_for_route","fresh stack must not move before a mission");
  const streaming=await connect("ws://127.0.0.1:8080/simulation/");
  let sceneLoaded=false, model="", updates=0, simulationMode;
  streaming.on("message",data=>{
    const message=data.toString();
    if(message === "real-time" || message === "fast")simulationMode=message;
    if(message.startsWith("model:"))model=message.slice(6);
    if(message.startsWith("application/json:"))updates++;
    if(message==="scene load completed")sceneLoaded=true;
  });
  streaming.send("w3d;broadcast");
  await until(()=>sceneLoaded && model.includes("<") && updates>0,"W3D scene and updates",30000);
  const response=await fetch("http://127.0.0.1:8080/webots/wwi/wrenjs.wasm",{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()).subarray(0,4),Buffer.from([0,97,115,109]));
  const socket=await connect("ws://127.0.0.1:9002/ui");
  // Keep navigation clear of PICK_BOX at (0.4,-0.1). A straight +X route
  // physically pushes that small fixture into the later grasp approach.
  await send(socket,"complete",[{x:0,y:0},{x:0,y:1}]);
  streaming.send("fast:-1");
  await until(()=>simulationMode === "fast","fast mode acknowledgement",10000);
  streaming.send("real-time:-1");
  await until(()=>simulationMode === "real-time","realtime mode acknowledgement",10000);
  streaming.send("fast:-1");
  await until(()=>simulationMode === "fast","fast mode during mission",10000);
  await until(async()=>(await mission("complete")).status==="completed","physical route completion");
  await compose("kill","-s","SIGKILL","route");
  await compose("up","-d","--wait","route");
  assert.equal((await mission("complete")).status,"completed");
  stored=await warehouse();
  assert.equal(stored.warehouse.revision,warehouseRevision,"warehouse revision must survive route crash");
  assert.equal(stored.slots[0].reservedBy,"container-putaway","warehouse reservation must survive route crash");
  assert.equal(stored.warehouse.cargo[0].locationId,"receiving");
  stored=await warehouse("/tasks/container-putaway/cancel",{expectedRevision:stored.warehouse.revision});
  assert.equal(stored.slots[0].reservedBy,null);
  assert.equal(stored.warehouse.tasks[0].status,"cancelled");
  console.log("PASS: warehouse frontend, private SQLite, reservation and cancellation after route crash");
  const nextSocket=await connect("ws://127.0.0.1:9002/ui");
  await compose("stop","simulator");
  await send(nextSocket,"restart-cancel",[{x:0,y:0},{x:0,y:2}]);
  await fetch("http://127.0.0.1:9002/api/missions/restart-cancel/cancel",{method:"POST"});
  await compose("up","-d","--wait","simulator");
  await until(async()=>(await mission("restart-cancel")).status==="cancelled","cancel after simulator restart");
  await send(nextSocket,"after-restart",[{x:0,y:0},{x:0,y:1}]);
  await until(async()=>(await mission("after-restart")).status==="completed","route after simulator restart");
  const initialHeight = telemetry.objectTransfer.objectPose.z;
  const initialJoints = telemetry.objectTransfer.manipulator.jointPositions;
  let peakHeight = initialHeight, jointMotion = 0, gripSeen = false;
  const observeTransfer = data => {
    const event = JSON.parse(data);
    const transfer = event.payload?.objectTransfer;
    if (transfer?.missionId !== "physical-transfer") return;
    peakHeight = Math.max(peakHeight, transfer.objectPose.z);
    transfer.manipulator.jointPositions.forEach((joint, index) => {
      jointMotion = Math.max(jointMotion, Math.abs(joint - initialJoints[index]));
    });
    gripSeen ||= transfer.manipulator.gripEvidence === true;
  };
  telemetrySocket.on("message", observeTransfer);
  console.log(JSON.stringify({beforeLargeTransfer:telemetry.pose}));
  await send(nextSocket,"physical-transfer",null,true);
  await until(async () => {
    const state = await mission("physical-transfer");
    assert.ok(!["failed","holding_for_recovery"].includes(state.status), JSON.stringify(state));
    return state.status === "completed";
  }, "physical manipulator transfer", 240000);
  await until(() => telemetry.objectTransfer?.status === "completed", "transfer telemetry");
  const delivered = telemetry.objectTransfer;
  assert.ok(gripSeen, "contact grip must be observed");
  assert.ok(jointMotion > 0.5, "arm must physically move");
  assert.ok(peakHeight > initialHeight + 0.04, "object must physically lift");
  assert.ok(Math.hypot(delivered.objectPose.x - 2, delivered.objectPose.y - 0.6) < 0.035, "delivery position");
  assert.equal(delivered.manipulator.releaseEvidence, true);
  console.log(JSON.stringify({jointMotion, lift:peakHeight-initialHeight, delivered:delivered.objectPose}));
  const trace=[];
  const observeSmall = data => {
    const event=JSON.parse(data), state=event.payload;
    if (state?.manipulator?.missionId === "pick-after-demo") trace.push({
      pose:state.pose,manipulator:{stage:state.manipulator.stage},
      navigation:{currentWaypointIndex:state.navigation.currentWaypointIndex,distanceToTarget:state.navigation.distanceToTarget},
    });
  };
  telemetrySocket.on("message",observeSmall);
  await send(nextSocket,"pick-after-demo",null,{type:"pick_place",objectDef:"PICK_BOX",destination:{x:2,y:2,z:0.04}});
  await until(async()=>{
    const state=await mission("pick-after-demo");
    assert.ok(!["failed","holding_for_recovery"].includes(state.status),JSON.stringify(state));
    return state.status === "completed";
  },"PICK_BOX after large cargo",300000);
  await until(()=>telemetry.manipulator?.stage === "completed","small cargo telemetry");
  const small=telemetry.manipulator.objectPosition;
  assert.ok(Math.hypot(small.x-2,small.y-2)<0.035,JSON.stringify(small));
  let forwardSamples=0;
  for(let i=1;i<trace.length;i++) {
    const a=trace[i-1],b=trace[i],dx=b.pose.x-a.pose.x,dy=b.pose.y-a.pose.y;
    const turn=Math.atan2(Math.sin(b.pose.yaw-a.pose.yaw),Math.cos(b.pose.yaw-a.pose.yaw));
    if(a.manipulator.stage!=="carrying" || b.manipulator.stage!=="carrying" ||
      a.navigation.currentWaypointIndex!==b.navigation.currentWaypointIndex ||
      Math.min(a.navigation.distanceToTarget,b.navigation.distanceToTarget)<0.2 ||
      Math.abs(turn)>0.05 || Math.hypot(dx,dy)<0.005)continue;
    const heading=a.pose.yaw+turn/2;
    const error=Math.atan2(Math.sin(Math.atan2(dy,dx)-heading),Math.cos(Math.atan2(dy,dx)-heading));
    assert.ok(Math.abs(error)<0.45,`Cargo cruise went sideways: ${error}`);
    forwardSamples++;
  }
  assert.ok(forwardSamples>0,"must observe forward motion while carrying PICK_BOX");
  console.log(JSON.stringify({smallDelivered:small,forwardSamples}));
  console.log("PASS: six containers, mixed visit order, camera, W3D through nginx, local WASM, speed controls, physical large and small cargo delivery, forward cargo motion, physical missions, route crash and simulator cancellation recovery");
} catch(error) {
  await mkdir(new URL("../output/",import.meta.url),{recursive:true});
  await writeFile(new URL("../output/container-smoke-failure.json",import.meta.url),JSON.stringify({error:error.message,telemetry},null,2));
  await compose("logs","--tail","50");
  throw error;
} finally {
  for(const socket of sockets)socket.terminate();
  // The unique project above is owned solely by this test; its volumes are disposable.
  await compose("down","-v","--timeout","15");
}
