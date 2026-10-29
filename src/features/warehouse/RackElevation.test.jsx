// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { buildSlots } from "../../../shared/warehouse/layout";
import RackElevation from "./RackElevation";

const rack = {
  id: "rack",
  code: "A",
  name: "A",
  x: 0,
  y: 0,
  yaw: 0,
  bays: 2,
  placesPerBay: 1,
  bayWidth: 1,
  depth: 1,
  levels: [
    { supportZ: 0.1, clearHeight: 0.5, maxLoadKg: 10 },
    { supportZ: 0.8, clearHeight: 0.5, maxLoadKg: 10 },
  ],
};
const slots = buildSlots(rack);
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});
function Fixture() {
  const [selected, select] = useState(null);
  return <RackElevation rack={rack} slots={slots} selectedSlotId={selected} onSelect={select} />;
}
const label = () => document.activeElement.getAttribute("aria-label");
const press = async (key) =>
  act(() =>
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    ),
  );

it("offers one keyboard entry and navigates by visual row and column", async () => {
  await act(() => root.render(<Fixture />));
  const entries = [...host.querySelectorAll("button")].filter((button) => button.tabIndex === 0);
  expect(entries).toHaveLength(1);
  await act(() => entries[0].focus());
  expect(label()).toBe("Ячейка A-01-02-01");
  await press("ArrowRight");
  expect(label()).toBe("Ячейка A-02-02-01");
  await press("ArrowDown");
  expect(label()).toBe("Ячейка A-02-01-01");
  await press("Home");
  expect(label()).toBe("Ячейка A-01-01-01");
  await press("End");
  expect(label()).toBe("Ячейка A-02-01-01");
  await press("ArrowUp");
  expect(label()).toBe("Ячейка A-02-02-01");
  expect(document.activeElement.getAttribute("aria-pressed")).toBe("true");
});

it("preserves a keyboard entry when the previous selected cell belongs to another rack", async () => {
  await act(() =>
    root.render(
      <RackElevation
        rack={rack}
        slots={slots}
        selectedSlotId="old-rack:1:1:1"
        onSelect={() => {}}
      />,
    ),
  );
  const entries = [...host.querySelectorAll("button")].filter((button) => button.tabIndex === 0);
  expect(entries).toHaveLength(1);
  expect(entries[0].getAttribute("aria-label")).toBe("Ячейка A-01-02-01");
});
