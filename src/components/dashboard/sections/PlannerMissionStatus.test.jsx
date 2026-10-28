import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import PlannerMissionStatus from "./PlannerMissionStatus";
it("shows released platform cargo and allows transfer recovery", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"platform",operationType:"object_transfer",status:"holding_for_recovery",stage:"transporting",attached:false,onPlatform:true,manipulator:{attachmentEvidence:false}}} onResume={()=>{}}/>);
 expect(html).toContain("Объект на платформе");
 expect(html).toContain("Перевозка на платформе");
 expect(html).toContain("Продолжить перенос");
 expect(html).not.toContain("disabled=\"\"");
 expect(html).not.toContain("Объект в захвате");
});
it("offers safe unloading for a held pick mission without treating it as navigation", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"pick-held",operationType:"pick_place",status:"holding_for_recovery",attached:true}} onCancel={()=>{}}/>);
 expect(html).toContain("Перенос объекта");
 expect(html).toContain("Безопасно выгрузить");
});
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
it("shows measured contacts independently for both fingers", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"contacts",operationType:"object_transfer",status:"running",manipulator:{fingerContacts:[1,0],gripEvidence:false}}}/>);
 expect(html).toContain("Контакты пальцев");
 expect(html).toContain("1.000, 0.000");
 expect(html).toContain("Контакт захвата: нет");
});
it("disables resume after measured loss of attachment", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"lost",operationType:"object_transfer",status:"holding_for_recovery",attached:true,manipulator:{attachmentEvidence:false}}} onResume={()=>{}}/>);
 expect(html).toMatch(/disabled=""[^>]*>Продолжить перенос/);
 expect(html).toContain("Продолжение доступно после восстановления захвата");
 expect(html).not.toContain("Объект в захвате");
 expect(html).not.toContain("Удержание объекта:");
 expect(html).toContain("Робот остановлен: захват потерян");
});
it("offers arm return for held recovery without cargo", () => {
 const html=renderToStaticMarkup(<PlannerMissionStatus mission={{missionId:"park",operationType:"object_transfer",status:"holding_for_recovery",attached:false,manipulator:{attachmentEvidence:false}}} onResume={()=>{}}/>);
 expect(html).toContain("Вернуть манипулятор");
 expect(html).not.toContain("disabled=\"\"");
 expect(html).not.toContain("Продолжение доступно после восстановления захвата");
});
