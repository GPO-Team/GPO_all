import {spawn} from "node:child_process";
import {once} from "node:events";
import assert from "node:assert/strict";
import WebSocket from "ws";
import {createRequire} from "node:module";
import {createRouteCommand} from "../shared/contracts/index.js";

const require = createRequire(import.meta.url);
const {normalizeScene, sceneRevision} = require("../bridge/protocol/scene-validation.cjs");
const project=`gpo-full-test-${Date.now()}`;
const root=new URL("../",import.meta.url);
const sockets=[];
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
async function connect(url) {
  const socket=new WebSocket(url);sockets.push(socket);await once(socket,"open");return socket;
}
async function send(socket,id,route,transfer = false) {
  const scene = normalizeScene({polygons:[],surfaceZones:[],chargingStations:[],motion:{cruiseSpeedMps:0.22,payloadKg:0,batteryRange:100}});
  const payload = transfer ? {type:"transfer_object",objectId:"demo-box",destination:{x:2,y:0.6},scene,sceneRevision:sceneRevision(scene)} : {type:"route",route,scene};
  const command=createRouteCommand({source:"full-container-test",requestId:id,payload});
  const reply=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off("message",receive);reject(new Error("ACK timeout"));},15000);
    function receive(data){const ack=JSON.parse(data);if(ack.requestId===id){clearTimeout(timer);socket.off("message",receive);resolve(ack);}}
    socket.on("message",receive);
  });
  socket.send(JSON.stringify(command));assert.equal((await reply).ok,true);
}
try {
  await compose("up","-d","--no-build","--wait","--wait-timeout","180");
  const plan=await (await fetch("http://127.0.0.1:9003/api/solve-route",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({points:[{x:0,y:0},{x:1,y:0}],task:"tsp"}),
  })).json();
  assert.equal(plan.ok,true,JSON.stringify(plan));
  let telemetry;
  const telemetrySocket=await connect("ws://127.0.0.1:9001");
  telemetrySocket.on("message",data=>{const event=JSON.parse(data);if(event.type==="telemetry.event")telemetry=event.payload;});
  await until(()=>telemetry?.perception?.camera?.frameDataUrl,"robot camera");
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
  await send(socket,"complete",[{x:0,y:0},{x:1,y:0}]);
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
  const nextSocket=await connect("ws://127.0.0.1:9002/ui");
  await compose("stop","simulator");
  await send(nextSocket,"restart-cancel",[{x:0,y:0},{x:2,y:0}]);
  await fetch("http://127.0.0.1:9002/api/missions/restart-cancel/cancel",{method:"POST"});
  await compose("up","-d","--wait","simulator");
  await until(async()=>(await mission("restart-cancel")).status==="cancelled","cancel after simulator restart");
  await send(nextSocket,"after-restart",[{x:0,y:0},{x:1,y:0}]);
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
  console.log("PASS: six containers, camera, W3D through nginx, local WASM, speed controls, physical arm contact grasp/lift/transfer/release, physical missions, route crash and simulator cancellation recovery");
} finally {
  for(const socket of sockets)socket.terminate();
  // The unique project above is owned solely by this test; its volumes are disposable.
  await compose("down","-v","--timeout","15");
}
