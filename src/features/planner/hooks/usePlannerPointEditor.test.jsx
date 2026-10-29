// @vitest-environment jsdom
import { act,useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePlannerPointEditor } from "./usePlannerPointEditor";
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it("blocks adding, dragging, deleting and changing points without erasing the route",async()=>{
  let editor;
  const container=document.createElement("div");const root=createRoot(container);
  const setPoints=vi.fn(),clearRouteState=vi.fn(),setStatus=vi.fn();
  function Harness(){const value=usePlannerPointEditor({isEditingLocked:()=>true,points:[{x:0,y:0,kind:"visit"}],canvasRef:{current:document.createElement("canvas")},setPoints,clearRouteState,setStatus});useEffect(()=>{editor=value;},[value]);return null;}
  await act(async()=>root.render(<Harness/>));
  editor.addPointFromCanvas({});editor.handleCanvasMouseDown({});editor.handleCanvasMouseMove({});editor.deletePoint(0);editor.clearPoints();editor.updatePointTask(0,"inspect");
  expect(setPoints).not.toHaveBeenCalled();expect(clearRouteState).not.toHaveBeenCalled();expect(setStatus).toHaveBeenCalled();
  await act(async()=>root.unmount());
});
