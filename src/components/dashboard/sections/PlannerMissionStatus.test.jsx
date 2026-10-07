import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import PlannerMissionStatus from "./PlannerMissionStatus";
it("renders recovery, errors, and measured manipulator diagnostics", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"held",operationType:"object_transfer",status:"holding_for_recovery",errorCode:"unsafe_release",actionError:"Resume rejected",manipulator:{jointPositions:[0.1,0.2,0.3,0.4,0.5],sensorValidity:false,tcpPose:{x:1,y:2,z:3},gripEvidence:true}}} onResume={()=>{}} onCancel={()=>{}}/>);
 expect(html).toContain("Удержание");
 expect(html).toContain("Продолжить перенос");
 expect(html).toContain("unsafe_release");
 expect(html).toContain("Resume rejected");
 expect(html).toContain("0.100");
 expect(html).toContain("TCP");
 expect(html).toContain("Датчики");
});
it("disables resume after measured loss of attachment", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"lost",operationType:"object_transfer",status:"holding_for_recovery",attached:true,manipulator:{attachmentEvidence:false}}} onResume={()=>{}}/>);
 expect(html).toMatch(/disabled=""[^>]*>Продолжить перенос/);
 expect(html).toContain("Продолжение доступно после восстановления захвата");
 expect(html).not.toContain("Объект в захвате");
});
it("offers arm return for held recovery without cargo", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"park",operationType:"object_transfer",status:"holding_for_recovery",attached:false,manipulator:{attachmentEvidence:false}}} onResume={()=>{}}/>);
 expect(html).toContain("Вернуть манипулятор");
 expect(html).not.toContain("disabled=\"\"");
 expect(html).not.toContain("Продолжение доступно после восстановления захвата");
});
