import {afterEach,describe,expect,it,vi} from "vitest";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import scenes from "../protocol/scene-validation.cjs";
import adapterModule from "./webots-file-adapter.cjs";

let directory;
afterEach(async()=>{if(directory)await rm(directory,{recursive:true,force:true});directory=null;});

describe("Webots file adapter transfer feedback",()=>{
  it("uses matching object transfer feedback before navigation feedback",async()=>{
    directory=await mkdtemp(path.join(os.tmpdir(),"gpo-transfer-feedback-"));
    await writeFile(path.join(directory,"robot_state.json"),JSON.stringify({
      navigation:{missionId:"route-old",finished:true},
      objectTransfer:{missionId:"transfer-1",status:"running",stage:"transporting",progress:62,attached:true,controllerBootId:"boot-1",position:{x:2,y:3,z:0.43}},
    }));
    const adapter=adapterModule.createWebotsFileAdapter({artifactStore:{},stateDir:directory});
    expect(await adapter.getFeedback("transfer-1")).toMatchObject({missionId:"transfer-1",status:"running",stage:"transporting",progress:62,attached:true,objectPose:{x:2,y:3,z:0.43}});
  });

  it("writes transfer submissions through the transfer artifact boundary",async()=>{
    const artifactStore={writeTransfer:vi.fn(async()=>{})};
    const adapter=adapterModule.createWebotsFileAdapter({artifactStore,stateDir:""});
    const scene=scenes.normalizeScene({});
    const command={type:"transfer_object",commandId:"transfer-1",objectId:"demo-box",destination:{x:2,y:1},scene,sceneRevision:scenes.sceneRevision(scene)};
    await adapter.submit(command);
    expect(artifactStore.writeTransfer).toHaveBeenCalledWith(command);
  });
});
