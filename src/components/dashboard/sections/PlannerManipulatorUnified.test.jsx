// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PlannerManipulatorSection from "./PlannerManipulatorSection";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("uses one form to select and dispatch either supported object", async () => {
  const node = document.createElement("div"),
    root = createRoot(node);
  const small = vi.fn(async () => {}),
    large = vi.fn(async () => {});
  await act(async () =>
    root.render(
      <PlannerManipulatorSection
        connected
        onStart={small}
        onStartTransfer={large}
      />,
    ),
  );
  expect(node.querySelectorAll("form")).toHaveLength(1);
  const selector = node.querySelector("select");
  await act(async () => {
    selector.value = "DEMO_BOX";
    selector.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    node
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(large).toHaveBeenCalledWith({ x: 2, y: 0.6 });
  expect(small).not.toHaveBeenCalled();
  await act(async () => {
    selector.value = "PICK_BOX";
    selector.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    node
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(small).toHaveBeenCalledWith({
    objectDef: "PICK_BOX",
    destination: { x: 0.4, y: 0.1, z: 0.04 },
  });
  await act(async () => root.unmount());
});
