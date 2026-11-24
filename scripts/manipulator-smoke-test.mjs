// Real Webots physics test. Starts an isolated world and independent services.
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {mkdtemp,mkdir,chmod,cp,copyFile,readFile,writeFile,rm} from "node:fs/promises";
import {once} from "node:events";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import sceneContract from "../bridge/protocol/scene-validation.cjs";
const root=path.resolve(import.meta.dirname,"..");
const afterDemo=process.argv.includes("--after-demo");
const visionEmpty=process.argv.includes("--vision-empty");
const visionAmbiguous=process.argv.includes("--vision-ambiguous");
const visionHidden=process.argv.includes("--vision-hidden");
const visionReject=visionEmpty || visionAmbiguous || visionHidden;
const warehouseRejection = process.argv.includes("--warehouse-wrong-cargo") ? "vision_wrong_cargo"
  : process.argv.includes("--warehouse-outside-receiving") ? "cargo_outside_receiving" : null;
const warehouseDelivery = process.argv.includes("--warehouse-delivery") || Boolean(warehouseRejection);
const vision=process.argv.includes("--vision") || visionReject || warehouseDelivery;
const visionDef = warehouseDelivery ? "PICK_BOX" : "VISION_TEST_BOX";
const mobile=process.argv.includes("--mobile") || afterDemo || vision;
const nearObject=process.argv.includes("--near-object");
const obstacle=process.argv.includes("--obstacle");
const nestedBlocked=process.argv.includes("--nested-blocked");
const blocked=process.argv.includes("--blocked") || nestedBlocked;
const unsupportedHeight=process.argv.includes("--unsupported-height");
const destination={x:mobile ? (obstacle ? 4 : nearObject ? 1 : 2) : 0.4,y:afterDemo ? 3 : mobile ? 1 : 0.1,z:unsupportedHeight ? 0.12 : 0.04};
const directory=await mkdtemp(path.join(os.tmpdir(),"gpo-manipulator-"));
const webotsImage = process.env.GPO_WEBOTS_TEST_IMAGE;
const containerName = `gpo-${path.basename(directory).toLowerCase()}`;
const worldPath = path.join(directory, "worlds", "test.wbt");
const children=[];
const armSamples=[];
let socket;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=async()=>{const s=createServer();s.listen(0,"127.0.0.1");await once(s,"listening");const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const [gatewayPort,missionPort,webotsPort]=await Promise.all(Array.from({length:3},freePort));
const stateDir=path.join(directory,"state");
const env={...process.env,BRIDGE_BIND_HOST:"127.0.0.1",ROUTE_BIND_HOST:"127.0.0.1",GATEWAY_BIND_HOST:"127.0.0.1",GATEWAY_PORT:String(gatewayPort),GATEWAY_URL:`http://127.0.0.1:${gatewayPort}`,GATEWAY_TOKEN:"physics-test",ROUTE_PORT:String(missionPort),MISSION_STATE_DIR:path.join(directory,"missions"),WEB_STATE_DIR:stateDir};
const launch=(exe,args)=>{const p=spawn(exe,args,{cwd:root,env,stdio:["ignore","pipe","pipe"],windowsHide:true});p.logs="";p.on("error",error=>{p.launchError=error;});p.stdout.on("data",d=>p.logs+=d);p.stderr.on("data",d=>p.logs+=d);children.push(p);return p;};
const until=async(condition,label,timeout=90000,interval=200)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await condition())return;await delay(interval);}throw new Error(`Timeout: ${label}`);};
const readState=async()=>{
  for(let attempt=0;;++attempt)try{return JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));}
  catch(error){if(attempt>=10 || (error.code!=="ENOENT" && !(error instanceof SyntaxError)))throw error;await delay(5);}
};
const getMission=async id=>(await fetch(`http://127.0.0.1:${missionPort}/api/missions/${id}`)).json();
const warehouse = async (endpoint = "", body) => {
  const response = await fetch(`http://127.0.0.1:${missionPort}/api/warehouse${endpoint}`, body
    ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}
    : {});
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result));
  return result;
};
const send=command=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("ACK timeout")),15000);const receive=data=>{const ack=JSON.parse(data);if(ack.requestId===command.requestId){clearTimeout(timer);socket.off("message",receive);resolve(ack);}};socket.on("message",receive);socket.send(JSON.stringify(command));});
try {
  await mkdir(path.join(directory,"worlds"),{recursive:true});
  await mkdir(stateDir,{recursive:true});
  let world = await readFile(path.join(root,"webots/worlds/youbot_only.wbt"),"utf8");
  if(mobile && !nearObject && !afterDemo)world=world.replace(/(DEF PICK_BOX Solid\s*\{\s*translation\s+)[^\r\n]+/,(_line,prefix)=>`${prefix}${obstacle ? 3.4 : 1.4} -0.1 0.04`);
  if(vision) {
    world=world.replace(/(DEF DEMO_BOX Solid\s*\{\s*translation\s+)[^\r\n]+/,
      (_line,prefix)=>`${prefix}1.4 3 0.075`);
    world=world.replace(/DEF PICK_BOX Solid\s*\{\s*translation\s+[^\r\n]+/,
      `DEF ${visionDef} Solid {\n  translation 1.45 ${visionEmpty || visionHidden ? 3 : -.18} 0.04`);
    for(const y of warehouseDelivery ? [] : [-1.25, 2.25]) {
      world+=`\nSolid { translation 1.4 ${y} 0.45
        children [ Shape {
          appearance PBRAppearance { baseColor 0.3 0.35 0.4 metalness 0 roughness 1 }
          geometry Box { size 1.8 0.45 0.9 }
        } ]
        boundingObject Box { size 1.8 0.45 0.9 }
      }\n`;
    }
    if(visionAmbiguous) world+=`\nDEF SECOND_VISION_BOX Solid {
      translation 1.45 0.25 0.04
      children [ Shape {
        appearance PBRAppearance { baseColor 0.1 0.45 0.75 roughness 0.7 }
        geometry Box { size 0.03 0.03 0.08 }
      } ]
      boundingObject Box { size 0.03 0.03 0.08 }
      physics Physics { density -1 mass 0.04 }
    }\n`;
    if(visionHidden) world+=`\nDEF VISIBLE_DECOY Solid {
      name "visible decoy"
      translation 1.45 -0.18 0.04
      children [ Shape {
        appearance PBRAppearance { baseColor 0.1 0.45 0.75 roughness 0.7 }
        geometry Box { size 0.03 0.03 0.08 }
      } ]
      boundingObject Box { size 0.03 0.03 0.08 }
    }
    DEF HIDDEN_BOX Solid {
      name "hidden cargo"
      translation 1.45 -0.10 0.04
      boundingObject Box { size 0.03 0.03 0.08 }
      physics Physics { density -1 mass 0.04 }
    }\n`;
  }
  if(obstacle)world+='\nDEF DELIVERY_OBSTACLE Solid { translation 1.5 0 0.2 children [ Shape { geometry Box { size 0.1 0.4 0.4 } } ] boundingObject Box { size 0.1 0.4 0.4 } }\n';
  if(blocked) {
    const obstacle = `DEF BLOCKED_DESTINATION Solid { translation 0 0 0.2
      children [ Shape { geometry Box { size 0.3 0.3 0.4 } } ]
      boundingObject Box { size 0.3 0.3 0.4 }
    }`;
    world+=nestedBlocked
      ? `\nGroup { children [ Pose { translation ${destination.x} ${destination.y} 0 children [ ${obstacle} ] } ] }\n`
      : "\n"+obstacle.replace("translation 0 0", `translation ${destination.x} ${destination.y}`)+"\n";
  }
  await writeFile(worldPath, world);
  if (webotsImage) {
    // The host bridge and the simulator user share only this disposable state directory.
    await chmod(stateDir, 0o777);
  } else {
    await cp(path.join(root,"webots/protos"),path.join(directory,"protos"),{recursive:true});
    await mkdir(path.join(directory,"controllers","youbot_web"),{recursive:true});
    await copyFile(path.join(root,"webots/controllers/youbot_web/youbot_web.exe"),path.join(directory,"controllers/youbot_web/youbot_web.exe"));
  }
  for(const name of ["gateway","route"])launch(process.execPath,[`bridge/processes/run-${name}-service.cjs`]);
  await until(async()=>{try{return (await fetch(`http://127.0.0.1:${missionPort}/ready`)).ok;}catch{return false;}},"route and gateway readiness",15000);
  const webotsHome=process.env.WEBOTS_HOME || "C:/Program Files/Webots";
  const webotsArgs = ["--batch", "--no-rendering", "--mode=fast", "--stdout", "--stderr"];
  const simulator = webotsImage
    ? launch("docker", ["run", "--rm", "--init", "--name", containerName, "--shm-size=256m",
      "--env", "LIBGL_ALWAYS_SOFTWARE=1",
      "--mount", `type=bind,source=${stateDir},target=/data/webots`,
      "--mount", `type=bind,source=${worldPath},target=/project/worlds/test.wbt,readonly`,
      "--entrypoint", "xvfb-run", webotsImage, "--auto-servernum",
      "--server-args=-screen 0 1280x720x24", "webots", ...webotsArgs, "/project/worlds/test.wbt"])
    : launch(path.join(webotsHome,"msys64/mingw64/bin/webots.exe"),
      ["--minimize", ...webotsArgs, `--port=${webotsPort}`, worldPath]);
  await until(async()=>{if(simulator.launchError)throw simulator.launchError;if(simulator.exitCode!==null)throw new Error(simulator.logs);try{const state=JSON.parse(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));return Boolean(state.pose);}catch{return false;}},"controller telemetry");
  socket=new WebSocket(`ws://127.0.0.1:${missionPort}/ui`);await once(socket,"open");
  await until(async () => (await readState()).simulationTime > 2, "settling");
  let before=await readState();
  await until(async()=>{
    const current=await readState();
    if(current.simulationTime-before.simulationTime<.25) return false;
    const stationary=current.manipulator.joints.every((angle,i)=>
      Math.abs(angle-before.manipulator.joints[i])<.003 &&
      Math.abs(angle-current.manipulator.targetJoints[i])<.015);
    before=current;
    return stationary;
  },"arm settled before mission");
  assert.ok(Math.hypot(before.pose.x,before.pose.y)<0.015,
    `Robot started moving without a mission: ${JSON.stringify(before.pose)} at ${before.simulationTime}s`);
  runScenario: {
  if(process.argv.includes("--cancel-held")) {
    const ack=await send({requestId:"cancel-held",type:"pick_place",objectDef:"PICK_BOX",destination:{x:.4,y:.1,z:.04}});
    assert.equal(ack.ok,true,JSON.stringify(ack));
    await until(async()=>{
      const arm=(await readState()).manipulator;
      if(arm.missionId!=="cancel-held")return false;
      if(["failed","holding_for_recovery","completed"].includes(arm.stage))throw new Error(`Cancellation window missed: ${arm.stage} ${arm.error}`);
      return arm.stage==="lifting" && arm.objectPosition.z>.055;
    },"held object before cancellation",90000,5);
    const response=await fetch(`http://127.0.0.1:${missionPort}/api/missions/cancel-held/cancel`,{method:"POST"});
    assert.equal(response.status,202);
    await until(async()=>{
      const mission=await getMission("cancel-held");
      if(["failed","holding_for_recovery"].includes(mission.status))throw new Error(JSON.stringify(mission));
      return mission.status==="cancelled";
    },"safe unloading on cancellation",90000,25);
    const arm=(await readState()).manipulator;
    assert.equal(arm.loadHeld,false);
    assert.ok(Math.abs(arm.objectPosition.z-.04)<.006,"Cargo is not on the floor after cancellation");
    assert.ok(arm.fingers.every(q=>q>.024),"Gripper did not release the supported cargo");
    console.log("Held cargo safely unloaded on cancellation.");
    break runScenario;
  }
  if(process.argv.includes("--cancel-stowing-platform")) {
    const ack=await send({requestId:"cancel-stowing",type:"pick_place",objectDef:"PICK_BOX",destination:{x:1,y:1,z:.04}});
    assert.equal(ack.ok,true,JSON.stringify(ack));
    await until(async()=>{
      const arm=(await readState()).manipulator;
      if(arm.missionId!=="cancel-stowing")return false;
      if(["failed","holding_for_recovery","completed"].includes(arm.stage))throw new Error(`Cancellation window missed: ${arm.stage} ${arm.error}`);
      return arm.stage==="carrying" && arm.onPlatform && Math.abs(arm.joints[0])>.1;
    },"platform cargo while arm is stowing",90000,5);
    const response=await fetch(`http://127.0.0.1:${missionPort}/api/missions/cancel-stowing/cancel`,{method:"POST"});
    assert.equal(response.status,202);
    await until(async()=>(await getMission("cancel-stowing")).status==="holding_for_recovery","safe platform stop",90000,25);
    const stopped=await readState();await delay(500);const after=await readState();
    assert.equal(after.manipulator.onPlatform,true);
    assert.equal(after.manipulator.loadHeld,false);
    assert.ok(Math.hypot(after.pose.x-stopped.pose.x,after.pose.y-stopped.pose.y)<.01,"Base moved after cancellation");
    assert.ok(Math.abs(after.manipulator.objectPosition.z-.1905)<.006,"Cargo left the platform");
    console.log("Platform cargo retained safely after cancelling during arm stow.");
    break runScenario;
  }
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
  let missionId = "arm-physics";
  const taskId = "warehouse-demo";
  const cargoId = "demo-cargo";
  let slotId;
  if (warehouseDelivery) {
    let store = await warehouse();
    store = await warehouse("/stations", {expectedRevision:store.warehouse.revision,
      stations:store.warehouse.stations.map((station) => station.id === "receiving"
        ? {...station,x:warehouseRejection === "cargo_outside_receiving" ? .8 : 1.45,y:-.18} : station)});
    store = await warehouse("/racks", {expectedRevision:store.warehouse.revision, rack:{
      id:"floor",code:"A",name:"Floor",x:destination.x,y:destination.y,yaw:0,
      bays:1,placesPerBay:1,bayWidth:.25,depth:.25,levels:[{supportZ:0,clearHeight:.25,maxLoadKg:1}],
    }});
    slotId = store.slots[0].id;
    store = await warehouse("/cargo", {expectedRevision:store.warehouse.revision, cargo:{
      id:cargoId,label:"Vision box",width:.03,depth:.03,height:.08,massKg:.04,
      objectDef:warehouseRejection === "vision_wrong_cargo" ? "OTHER_BOX" : visionDef,
    }});
    store = await warehouse("/tasks", {expectedRevision:store.warehouse.revision,
      id:taskId,cargoId,destinationId:slotId});
    store = await warehouse("/tasks/warehouse-demo/start", {expectedRevision:store.warehouse.revision});
    missionId = store.warehouse.tasks[0].missionId;
    assert.ok(missionId);
    assert.equal(store.slots[0].reservedBy,taskId);
    assert.equal(store.warehouse.cargo[0].locationId,"receiving");
    if (warehouseRejection) {
      await until(async () => (await warehouse()).warehouse.tasks[0].status === "attention", warehouseRejection);
      const rejected = await warehouse();
      const state = await readState();
      assert.equal(rejected.warehouse.tasks[0].failureReason,warehouseRejection);
      assert.equal(rejected.warehouse.cargo[0].locationId,"receiving");
      assert.equal(rejected.slots[0].reservedBy,taskId);
      assert.ok(Math.hypot(state.pose.x-before.pose.x,state.pose.y-before.pose.y)<.015);
      assert.ok(state.manipulator.joints.every((angle,i)=>Math.abs(angle-before.manipulator.joints[i])<.01));
      console.log("Warehouse retained its reservation without motion:",warehouseRejection);
      break runScenario;
    }
  } else {
    const source = vision ? {source:"vision"} : {objectDef:"PICK_BOX"};
    const ack = await send({requestId:missionId,type:"pick_place",...source,destination});
    assert.equal(ack.ok,true,JSON.stringify(ack));
  }
  if(visionReject) {
    const expectedError=visionAmbiguous ? "vision_ambiguous" : "vision_no_cargo";
    await until(async()=>{
      const mission=await getMission(missionId);
      assert.ok(!["running","completed","holding_for_recovery"].includes(mission.status), JSON.stringify(mission));
      return mission.status==="failed";
    },expectedError);
    const mission=await getMission(missionId);
    const state=await readState();
    assert.equal(mission.failureReason,expectedError);
    assert.ok(Math.hypot(state.pose.x-before.pose.x,state.pose.y-before.pose.y)<.015);
    assert.ok(state.manipulator.joints.every((angle,i)=>Math.abs(angle-before.manipulator.joints[i])<.01));
    console.log(`Vision pickup reported ${expectedError} without moving the base or arm.`);
    break runScenario;
  }
  if(blocked || unsupportedHeight) {
    await until(async()=>{
      const mission=await getMission(missionId);
      assert.ok(!["running","completed","holding_for_recovery"].includes(mission.status), JSON.stringify(mission));
      return mission.status==="failed";
    },"unsafe destination rejection");
    const mission=await getMission(missionId),state=await readState();
    assert.equal(mission.failureReason,unsupportedHeight ? "unsupported_destination" : "delivery_path_blocked");
    assert.ok(Math.hypot(state.pose.x-before.pose.x,state.pose.y-before.pose.y)<0.01);
    assert.ok(Math.abs(state.manipulator.objectPosition.z-0.04)<0.005,"Picked up cargo despite blocked destination");
    await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
    await writeFile(path.join(root,"output/manipulator-smoke/mobile-delivery-blocked.json"),JSON.stringify({mission,state},null,2));
    console.log(`Unsafe destination rejected before pickup: ${mission.failureReason}.`);
    break runScenario;
  }
  const observations=[];
  const baseTrace=[];
  let lastStage;
  let injectedRoute = false;
  let injectedRuntime = false;
  await until(async()=>{
    const state=await readState();
    if(state.manipulator?.stage==="closing") armSamples.push(state.manipulator);
    baseTrace.push({x:state.pose.x,y:state.pose.y,yaw:state.pose.yaw,time:state.simulationTime,
      stage:state.manipulator?.stage,onPlatform:state.manipulator?.onPlatform,joints:state.manipulator?.joints,distance:state.navigation.distanceToTarget,
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
    if(state.manipulator?.missionId===missionId && state.manipulator.stage!==lastStage){ lastStage=state.manipulator.stage; observations.push(state); console.log(lastStage,JSON.stringify(state.manipulator)); }
    const m=await getMission(missionId);
    if(["failed","holding_for_recovery"].includes(m.status))throw new Error(JSON.stringify({mission:m,state}));
    return m.status==="completed";
  },"physical pick-place",mobile ? 180000 : 90000);
  const final=await readState();
  let naturalDrivingChecks=0;
  let peakCruiseSpeed=0;
  let concurrentStowChecks=0;
  for(let i=1;i<baseTrace.length;++i) {
    const previous=baseTrace[i-1],current=baseTrace[i];
    const dx=current.x-previous.x,dy=current.y-previous.y;
    const turn=Math.atan2(Math.sin(current.yaw-previous.yaw),Math.cos(current.yaw-previous.yaw));
    if(previous.onPlatform && current.onPlatform && previous.stage==="carrying" && current.stage==="carrying" &&
      (Math.hypot(dx,dy)>.001 || Math.abs(turn)>.002) && current.joints?.some((q,index)=>Math.abs(q-previous.joints[index])>.002))
      ++concurrentStowChecks;
    if(previous.stage!=="carrying" || current.stage!=="carrying" || current.waypoint!==previous.waypoint ||
        Math.min(previous.distance,current.distance)<.2 || Math.abs(turn)>.05 || Math.hypot(dx,dy)<.005)continue;
    const heading=previous.yaw+turn*.5;
    const error=Math.atan2(Math.sin(Math.atan2(dy,dx)-heading),Math.cos(Math.atan2(dy,dx)-heading));
    assert.ok(Math.abs(error)<.45,`Cargo moved sideways during cruise: heading error ${error}`);
    if(current.time>previous.time)peakCruiseSpeed=Math.max(peakCruiseSpeed,Math.hypot(dx,dy)/(current.time-previous.time));
    ++naturalDrivingChecks;
  }
  if(mobile)assert.ok(naturalDrivingChecks>0,"No measured forward cargo travel");
  if(mobile) {
    assert.ok(concurrentStowChecks>0,"Base did not move while the empty arm was stowing");
    const platformCruise=observations.filter(s=>s.manipulator.stage==="carrying");
    assert.ok(platformCruise.length>0 && platformCruise.every(s=>s.manipulator.onPlatform &&
      !s.manipulator.loadHeld && s.manipulator.fingers.every(q=>q>.024)),
    "Long delivery must drive with cargo on the platform and the gripper open");
    assert.ok(peakCruiseSpeed>.12,`Platform cruise remains too slow: ${peakCruiseSpeed} m/s`);
  } else assert.ok(observations.every(s=>!s.manipulator.onPlatform),"Short transfer unnecessarily uses the platform");
  if(obstacle) {
    assert.ok(baseTrace.some(p=>Math.abs(p.y)>0.6),"Robot did not detour around the obstacle");
    assert.ok(baseTrace.every(p=>Math.hypot(Math.max(0,Math.abs(p.x-1.5)-0.05),Math.max(0,Math.abs(p.y)-0.2))>0.30),"Base collided with the obstacle");
  }
  if (process.argv.includes("--inject-route")) assert.ok(injectedRoute, "Route interlock was not exercised");
  assert.ok(Math.hypot(final.manipulator.objectPosition.x-destination.x,final.manipulator.objectPosition.y-destination.y)<0.035);
  assert.ok(Math.abs(final.manipulator.objectPosition.z-destination.z)<.006,"Delivered cargo is not upright on the floor");
  assert.ok(observations.some(s=>s.manipulator.objectPosition.z>0.08),"Object never lifted");
  if(mobile) {
    if(!nearObject)assert.ok(observations.some(s=>s.manipulator.stage==="driving_to_object"),"Base never fetched the distant object");
    if(!nearObject && !afterDemo) {
      const pickup=observations.find(s=>s.manipulator.stage==="opening");
      assert.ok(pickup,"Pickup did not start");
      const dx=pickup.manipulator.objectPosition.x-pickup.pose.x,dy=pickup.manipulator.objectPosition.y-pickup.pose.y;
      const c=Math.cos(pickup.pose.yaw),s=Math.sin(pickup.pose.yaw);
      assert.ok(Math.hypot(c*dx+s*dy-.4,-s*dx+c*dy+.1)>.015,"Pickup waited for the exact dock pose");
    }
    assert.ok(observations.some(s=>s.manipulator.stage==="carrying"),"Base never carried the load");
    assert.ok(Math.hypot(final.pose.x,final.pose.y)>0.5,"Base never moved to the destination");
  } else assert.ok(Math.hypot(final.pose.x,final.pose.y)<0.015,"Base moved");
  if(vision) {
    assert.equal(final.manipulator.objectDef,visionDef);
    if (warehouseDelivery) {
      await until(async () => {
        const {warehouse:inventory,slots} = await warehouse();
        if (inventory.tasks[0].status === "attention") throw new Error(JSON.stringify(inventory.tasks[0]));
        if (inventory.tasks[0].status !== "completed") return false;
        assert.equal(inventory.cargo[0].locationId,slotId);
        assert.equal(slots[0].occupiedBy,cargoId);
        assert.equal(slots[0].reservedBy,null);
        return true;
      }, "warehouse inventory confirmed delivery", 15000);
      console.log("Warehouse confirmed the physical delivery and recorded the cargo in its slot.");
    }
    console.log("Vision selected the box, carried it on the platform and delivered it.");
    break runScenario;
  }
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
  let reverseStage;
  await until(async()=>{
    const snapshot=await readState(),arm=snapshot.manipulator;
    if(arm.stage==="closing")armSamples.push(arm);
    if(arm.stage!==reverseStage) {reverseStage=arm.stage;console.log("reverse",JSON.stringify(arm));}
    const mission=await getMission("arm-reverse");
    if(["failed","holding_for_recovery"].includes(mission.status)) throw new Error(await readFile(path.join(stateDir,"robot_state.json"),"utf8"));
    return mission.status==="completed";
  },"repeat transfer",mobile ? 180000 : 90000);
  const reverse=await readState();
  assert.ok(Math.hypot(reverse.manipulator.objectPosition.x-0.4,reverse.manipulator.objectPosition.y+0.1)<0.035);
  const badAck=await send({requestId:"arm-unreachable",type:"pick_place",objectDef:"PICK_BOX",destination:{x:4,y:0,z:0.9}});
  assert.equal(badAck.ok,true);
  await until(async()=>(await getMission("arm-unreachable")).status==="failed","unreachable target rejection");
  const failedMission = await getMission("arm-unreachable");
  assert.equal(failedMission.failureReason, "unsupported_destination");
  const failed=await readState();
  assert.equal(failed.manipulator.error,"unsupported_destination");
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
  let cancellationStableSince=0;
  let cancellationStage;
  await until(async()=>{
    const mission=await getMission("arm-cancel"),arm=(await readState()).manipulator;
    const terminal=arm.missionId==="arm-cancel" && ["cancelled","holding_for_recovery"].includes(arm.stage) &&
      ["cancelled","holding_for_recovery"].includes(mission.status);
    if(!terminal || arm.stage!==cancellationStage) cancellationStableSince=0;
    cancellationStage=arm.stage;
    if(terminal && !cancellationStableSince) cancellationStableSince=Date.now();
    return terminal && Date.now()-cancellationStableSince>=750;
  },"arm cancellation or safe hold");
  const stopped=await readState();
  await delay(500);
  const afterStop=await readState();
  const holding=afterStop.manipulator.stage==="holding_for_recovery";
  assert.ok(holding || afterStop.manipulator.stage==="cancelled","Cancellation did not stop the arm");
  assert.equal(afterStop.navigation.status,holding ? "manipulator_holding" : "mission_cancelled");
  assert.ok(Math.hypot(afterStop.pose.x-stopped.pose.x,afterStop.pose.y-stopped.pose.y)<0.01,"Base moved after cancellation");
  assert.ok(afterStop.manipulator.joints.every((q,i)=>Math.abs(q-stopped.manipulator.joints[i])<0.02),"Arm moved after cancellation");
  const heldObject = afterStop.manipulator.objectPosition;
  const stoppedObject = stopped.manipulator.objectPosition;
  assert.equal(afterStop.manipulator.loadHeld || afterStop.manipulator.onPlatform,holding,"Cancellation lost load ownership");
  assert.equal(afterStop.manipulator.active,holding,"Cancellation released arm ownership during recovery");
  if(afterStop.manipulator.onPlatform) {
    assert.ok(holding && !afterStop.manipulator.loadHeld,"Platform cargo must retain recovery ownership");
    assert.ok(afterStop.manipulator.fingers.every(q=>q>.024),"Platform cancellation unexpectedly closed the gripper");
    assert.ok(Math.abs(heldObject.z-.1905)<.006,"Cargo left the platform after cancellation");
  } else if(holding) {
    assert.ok(afterStop.manipulator.fingers.reduce((sum,q)=>sum+q,0)>0.002,"Recovery hold lost the grasp");
    assert.ok(heldObject.z>=0.034,"Cargo fell onto its side during recovery");
  } else {
    assert.ok(afterStop.manipulator.fingers.every(q=>q>0.024),"Gripper did not open after safe unloading");
    assert.ok(Math.abs(heldObject.z-0.04)<0.006,"Cargo was not placed on the floor");
  }
  assert.ok(Math.abs(heldObject.z-stoppedObject.z)<0.015,"Cargo did not settle after cancellation");
  assert.ok(Math.hypot(heldObject.x-stoppedObject.x,heldObject.y-stoppedObject.y,heldObject.z-stoppedObject.z)<(mobile ? 0.03 : 0.02),"Object moved out of the grasp after cancellation");
  await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
  const reportName = afterDemo ? "pick-after-demo.json" : mobile ? obstacle ? "mobile-delivery-obstacle.json" : nearObject ? "mobile-delivery-near.json" : "mobile-delivery.json" : injectedRoute ? "manipulator-route-interlock.json" : "manipulator-physics.json";
  await writeFile(path.join(root,"output/manipulator-smoke",reportName),JSON.stringify({injectedRoute,injectedRuntime,naturalDrivingChecks,concurrentStowChecks,peakCruiseSpeed,baseTrace,observations,final,reverse,failed,failedMission,stopped,afterStop},null,2));
  console.log("Physical pick-place, repeat, unreachable/missing object, and cancellation passed.");
  }
} catch(error) {
  await mkdir(path.join(root,"output/manipulator-smoke"),{recursive:true});
  const lastState = await readFile(path.join(stateDir,"robot_state.json"),"utf8").catch(()=>null);
  await writeFile(path.join(root,"output/manipulator-smoke/manipulator-failure.json"),JSON.stringify({error:error.message,lastState,armSamples},null,2));
  for(const child of children)console.error(child.logs.slice(-8000));
  throw error;
} finally {
  socket?.terminate();
  if (webotsImage) {
    const cleanup = spawn("docker", ["rm", "-f", containerName], { windowsHide: true, stdio: "ignore" });
    await once(cleanup, "exit").catch(() => {});
  }
  for(const child of children.reverse()){
    if(!child.pid || child.exitCode!==null || child.signalCode)continue;
    if(process.platform==="win32") {const killer=spawn("taskkill",["/PID",String(child.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});await once(killer,"exit");}
    else child.kill("SIGTERM");
  }
  const cleanupPath = path.resolve(directory);
  assert.equal(path.dirname(cleanupPath), path.resolve(os.tmpdir()));
  assert.ok(path.basename(cleanupPath).startsWith("gpo-manipulator-"));
  await rm(cleanupPath,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
