import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import PlannerManipulatorSection from "./PlannerManipulatorSection";
it.each([
  ["manipulator_path_blocked","Траектория руки пересекает препятствие или запретную зону"],
  ["unsafe_release","Безопасно опустить груз сейчас невозможно"],
  ["navigation_stalled","База перестала продвигаться по маршруту"],
])("explains safety stop %s", (error,description) => {
  const html=renderToStaticMarkup(<PlannerManipulatorSection connected
    mission={{missionId:"safety-stop",status:"failed",failureReason:error}}/>);
  expect(html).toContain(description);
});
it.each([["driving_to_object","База подъезжает к объекту"],["carrying","База перевозит груз"],["stowing","Рука возвращается в транспортное положение"]])("shows active delivery phase %s and its stop button", (stage,label) => {
  const html=renderToStaticMarkup(<PlannerManipulatorSection connected onCancel={()=>{}}
    mission={{missionId:"delivery",status:"running"}} telemetry={{manipulator:{missionId:"delivery",stage,active:true}}} />);
  expect(html).toContain(label);
  expect(html).toContain("Остановить миссию");
  expect(html).toContain("fieldset disabled");
});

it("shows the persisted failure reason without controller telemetry", () => {
  const html = renderToStaticMarkup(<PlannerManipulatorSection connected
    mission={{missionId:"arm-failure",status:"failed",failureReason:"invalid_sensor"}} />);
  expect(html).toContain("Нет корректных показаний датчиков.");
});

it("does not attribute an old controller error to a new mission", () => {
  const html = renderToStaticMarkup(<PlannerManipulatorSection connected
    mission={{missionId:"new-arm",status:"persisted"}}
    telemetry={{manipulator:{missionId:"old-arm",stage:"failed",error:"object_missing"}}} />);
  expect(html).not.toContain("Объект не найден в мире Webots.");
});
it("explains an unreachable placement and shows the observed object position", () => {
  const html = renderToStaticMarkup(<PlannerManipulatorSection connected
    mission={{missionId:"far-target",status:"failed",failureReason:"target_unreachable"}}
    telemetry={{manipulator:{missionId:"far-target",objectDef:"PICK_BOX",stage:"failed",error:"target_unreachable",objectPosition:{x:0.397144,y:0.104708,z:0.039992}}}} />);
  expect(html).toContain("Точка назначения недостижима даже после подъезда базы.");
  expect(html).toContain("Проверьте высоту центра объекта");
  expect(html).toContain("X=0.397");
  expect(html).toContain("Y=0.105");
  expect(html).toContain("не смещение объекта");
});
it("distinguishes an unreachable object from an unreachable destination", () => {
  const html = renderToStaticMarkup(<PlannerManipulatorSection connected
    mission={{missionId:"far-object",status:"failed",failureReason:"source_unreachable"}} />);
  expect(html).toContain("Сам объект находится вне досягаемости руки.");
  expect(html).not.toContain("Точка назначения вне досягаемости руки.");
});
