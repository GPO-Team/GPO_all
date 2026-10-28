// @vitest-environment jsdom
import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import PlannerObjectTransferSection from "./PlannerObjectTransferSection";

it("blocks another transfer while the robot is busy", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const container=document.createElement("div"),root=createRoot(container),start=vi.fn();
  try {
    await act(async()=>root.render(<PlannerObjectTransferSection onStartTransfer={start} editingLocked/>));
    expect([...container.querySelectorAll("input,button")].every(control=>control.disabled)).toBe(true);
    await act(async()=>container.querySelector("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(start).not.toHaveBeenCalled();
  } finally {await act(async()=>root.unmount());}
});
