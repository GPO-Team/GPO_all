// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WarehouseWorkspace from "./WarehouseWorkspace";
import { buildSlots } from "../../../shared/warehouse/layout";

let root;
let host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const snapshot = () => ({
  ok: true,
  warehouse: {
    schemaVersion: 1,
    revision: 0,
    racks: [],
    stations: [
      { id: "receiving", kind: "receiving", name: "Приёмка", x: -5, y: -5 },
      { id: "shipping", kind: "shipping", name: "Отгрузка", x: 5, y: -5 },
    ],
    cargo: [],
    tasks: [],
  },
  slots: [],
});
async function click(text) {
  const button = [...host.querySelectorAll("button")].find((el) => el.textContent === text);
  expect(button, text).toBeTruthy();
  await act(async () => {
    button.click();
  });
}
async function field(label, value) {
  const input = host.querySelector(`[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  await act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
      input,
      value,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(label) {
  await act(async () => {
    host
      .querySelector(`[aria-label="${label}"]`)
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

it("creates a rack with edited levels, registers cargo, prepares and cancels without moving cargo", async () => {
  const state = snapshot();
  const calls = [];
  const api = vi.fn(async (path, options) => {
    calls.push([path, options]);
    if (path.startsWith("/suggestions"))
      return {
        ok: true,
        revision: state.warehouse.revision,
        suggestions: [
          {
            slotId: "rack:1:1:1",
            address: "A-01-01-01",
            eligible: true,
            reasons: [],
            robotAccess: "unverified",
          },
        ],
      };
    if (options) {
      const body = options.body;
      expect(body.expectedRevision).toBe(state.warehouse.revision);
      if (path === "/racks") {
        state.warehouse.racks.push({ ...body.rack, id: "rack" });
        state.slots.push({
          id: "rack:1:1:1",
          rackId: "rack",
          address: "A-01-01-01",
          bay: 1,
          level: 1,
          place: 1,
          maxLoadKg: 50,
          reservedBy: null,
        });
      }
      if (path === "/cargo") state.warehouse.cargo.push({ ...body.cargo, locationId: "receiving" });
      if (path === "/tasks") {
        state.warehouse.tasks.push({ ...body, sourceId: "receiving", status: "prepared" });
        state.slots[0].reservedBy = body.id;
      }
      if (path.endsWith("/cancel")) {
        state.warehouse.tasks[0].status = "cancelled";
        state.slots[0].reservedBy = null;
      }
      state.warehouse.revision += 1;
    }
    return structuredClone(state);
  });
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  expect(host.textContent).toContain("Склад пока пуст");
  await click("Добавить стеллаж");
  await field("Код стеллажа", "A");
  await field("Название стеллажа", "Секция A");
  await field("Угол, °", "90");
  await field("Уровень 1: просвет, м", "0.7");
  await submit("Редактор стеллажа");
  expect(state.warehouse.racks[0].yaw).toBeCloseTo(Math.PI / 2);
  expect(state.warehouse.racks[0].levels[0].clearHeight).toBe(0.7);
  await field("ID груза", "BOX-1");
  await field("Название груза", "Коробка");
  await submit("Регистрация груза");
  await click("Подобрать ячейки");
  await click("Подготовить размещение");
  const taskCall = calls.find(([path]) => path === "/tasks")[1].body;
  expect(taskCall.id).toMatch(/^[\da-f-]{36}$/i);
  expect(taskCall.cargoId).toBe("BOX-1");
  expect(taskCall.destinationId).toBe("rack:1:1:1");
  expect(host.textContent).toContain("Груз остаётся на приёмке");
  expect(host.textContent.toLowerCase()).toContain("доступ робота не проверен");
  expect(state.warehouse.cargo[0].locationId).toBe("receiving");
  expect(host.textContent).not.toMatch(/Выполнено|Запустить робота/);
  await click("Отменить задачу");
  expect(state.warehouse.tasks[0].status).toBe("cancelled");
});

it("refreshes after a revision conflict and preserves the rack draft", async () => {
  const state = snapshot();
  const api = vi.fn(async (path, options) => {
    if (options) {
      state.warehouse.revision = 4;
      throw Object.assign(new Error("Данные изменились"), { status: 409 });
    }
    return structuredClone(state);
  });
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await click("Добавить стеллаж");
  await field("Название стеллажа", "Мой черновик");
  await submit("Редактор стеллажа");
  expect(host.querySelector('[role="alert"]').textContent).toContain("Данные изменились");
  expect(host.querySelector('[aria-label="Название стеллажа"]').value).toBe("Мой черновик");
  expect(host.textContent).toContain("Ревизия 4");
  expect(api.mock.calls.filter(([, options]) => !options)).toHaveLength(2);
});

it("recovers from network failure with an explicit refresh", async () => {
  const api = vi
    .fn()
    .mockRejectedValueOnce(new Error("Сервис недоступен"))
    .mockResolvedValue(snapshot());
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  expect(host.textContent).toContain("Сервис недоступен");
  await click("Обновить");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.textContent).toContain("Склад пока пуст");
});

it("retries a lost task response with the same UUID and revision", async () => {
  const state = snapshot();
  state.warehouse.cargo.push({
    id: "BOX",
    label: "Коробка",
    width: 0.2,
    depth: 0.2,
    height: 0.2,
    massKg: 1,
    locationId: "receiving",
  });
  const attempts = [];
  const api = async (path, options) => {
    if (path.startsWith("/suggestions"))
      return {
        ok: true,
        revision: 0,
        suggestions: [
          {
            slotId: "rack:1:1:1",
            address: "A-01-01-01",
            eligible: true,
            reasons: [],
            robotAccess: "unverified",
          },
        ],
      };
    if (path === "/tasks") {
      attempts.push(options.body);
      if (attempts.length === 1) {
        state.warehouse.tasks.push({ ...options.body, status: "prepared", sourceId: "receiving" });
        state.warehouse.revision = 1;
        throw new Error("Ответ потерян");
      }
    }
    return structuredClone(state);
  };
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await act(async () => {
    const select = host.querySelector('[aria-label="Груз на приёмке"]');
    select.value = "BOX";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Подобрать ячейки");
  await click("Подготовить размещение");
  expect(host.textContent).toContain("Ответ потерян");
  await click("Подготовить размещение");
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(state.warehouse.tasks).toHaveLength(1);
  expect(host.textContent).toContain("Груз остаётся на приёмке");
});

it("sends nested station and layout changes, exports only layout, and reloads server state", async () => {
  const state = snapshot();
  state.warehouse.cargo.push({
    id: "BOX",
    label: "Сохранённый груз",
    width: 0.2,
    depth: 0.2,
    height: 0.2,
    massKg: 1,
    locationId: "receiving",
  });
  const calls = [];
  const api = async (path, options) => {
    if (options) {
      calls.push([path, options.body]);
      expect(options.body.expectedRevision).toBe(state.warehouse.revision);
      if (path === "/stations") state.warehouse.stations = options.body.stations;
      if (path === "/layout") {
        state.warehouse.racks = options.body.layout.racks;
        state.warehouse.stations = options.body.layout.stations;
      }
      state.warehouse.revision += 1;
    }
    return structuredClone(state);
  };
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await click("Настроить");
  await field("Приёмка: X, м", "-4");
  await submit("Настройки станций");
  expect(calls[0][0]).toBe("/stations");
  expect(calls[0][1].stations[0].x).toBe(-4);
  const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:warehouse-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(window.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await click("Экспорт JSON");
  expect(urlSpy).toHaveBeenCalledOnce();
  const exported = JSON.parse(host.querySelector('[aria-label="JSON планировки"]').value);
  expect(Object.keys(exported).sort()).toEqual(["racks", "schemaVersion", "stations"]);
  const imported = {
    ...exported,
    stations: exported.stations.map((station) => ({ ...station, name: `${station.name} 2` })),
    cargo: [],
  };
  await act(async () => {
    const area = host.querySelector('[aria-label="JSON планировки"]');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(
      area,
      JSON.stringify(imported),
    );
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Заменить планировку");
  expect(calls[1][0]).toBe("/layout");
  expect(calls[1][1].layout).not.toHaveProperty("cargo");
  expect(state.warehouse.cargo).toHaveLength(1);
  await act(() => root.unmount());
  root = createRoot(host);
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  expect(host.textContent).toContain("Приёмка 2");
  expect(host.textContent).toContain("Сохранённый груз");
  expect(host.textContent).toContain("Ревизия 2");
});

it("does not announce preparation when an idempotent retry returns a cancelled task", async () => {
  const state = snapshot();
  state.warehouse.cargo.push({
    id: "BOX",
    label: "Коробка",
    width: 0.2,
    depth: 0.2,
    height: 0.2,
    massKg: 1,
    locationId: "receiving",
  });
  let attempts = 0;
  const api = async (path, options) => {
    if (path.startsWith("/suggestions"))
      return {
        ok: true,
        revision: 0,
        suggestions: [
          {
            slotId: "rack:1:1:1",
            address: "A-01-01-01",
            eligible: true,
            reasons: [],
            robotAccess: "unverified",
          },
        ],
      };
    if (path === "/tasks") {
      attempts += 1;
      if (attempts === 1) throw new Error("Ответ потерян");
      state.warehouse.tasks.push({ ...options.body, status: "cancelled", sourceId: "receiving" });
      state.warehouse.revision = 2;
    }
    return structuredClone(state);
  };
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await act(async () => {
    const select = host.querySelector('[aria-label="Груз на приёмке"]');
    select.value = "BOX";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Подобрать ячейки");
  await click("Подготовить размещение");
  await click("Подготовить размещение");
  expect(host.textContent).not.toContain("Задача подготовлена.");
  expect(host.querySelector('[role="status"]').textContent).toContain("отменена");
});

const existingRack = () => ({
  id: "rack-A",
  code: "A",
  name: "Стеллаж A",
  x: 0,
  y: 0,
  yaw: 0,
  bays: 2,
  placesPerBay: 1,
  bayWidth: 1,
  depth: 0.5,
  levels: [{ supportZ: 0.1, clearHeight: 0.7, maxLoadKg: 10 }],
});

it("does not overwrite a remotely changed rack with a stale draft after refresh", async () => {
  const state = snapshot();
  state.warehouse.racks = [existingRack()];
  state.slots = buildSlots(state.warehouse.racks[0]);
  const api = vi.fn(async () => structuredClone(state));
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await click("Редактировать");
  await field("Название стеллажа", "Мой черновик");
  state.warehouse.racks[0].depth = 0.9;
  state.warehouse.revision = 1;
  await click("Обновить");
  await submit("Редактор стеллажа");
  expect(api.mock.calls.filter(([, options]) => options)).toHaveLength(0);
  expect(host.querySelector('[aria-label="Название стеллажа"]').value).toBe("Мой черновик");
  expect(host.textContent).toContain("Стеллаж изменён в другой вкладке");
  await click("Загрузить актуальный стеллаж");
  expect(host.querySelector('[aria-label="Глубина, м"]').value).toBe("0.9");
});

it("selects the newly created rack even when other racks already exist", async () => {
  const state = snapshot();
  state.warehouse.racks = [existingRack()];
  state.slots = buildSlots(state.warehouse.racks[0]);
  const api = async (path, options) => {
    if (path === "/racks") {
      const saved = { ...options.body.rack, id: "rack-B" };
      state.warehouse.racks.push(saved);
      state.slots.push(...buildSlots(saved));
      state.warehouse.revision += 1;
    }
    return structuredClone(state);
  };
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await click("Добавить стеллаж");
  await field("Код стеллажа", "B");
  await field("Название стеллажа", "Новый B");
  await field("X, м", "4");
  await submit("Редактор стеллажа");
  const selected = [...host.querySelectorAll('button[aria-pressed="true"]')].map(
    (button) => button.textContent,
  );
  expect(selected).toContain("B · Новый B");
  expect(host.querySelector('[aria-label="Ячейка B-01-01-01"]')).toBeTruthy();
});

it("requires reloading station drafts when another client has changed the stations", async () => {
  const state = snapshot();
  const api = vi.fn(async () => structuredClone(state));
  await act(() => root.render(<WarehouseWorkspace api={api} />));
  await click("Настроить");
  await field("Название приёмки", "Мой черновик приёмки");
  state.warehouse.stations[0].x = -9;
  state.warehouse.revision = 1;
  await click("Обновить");
  await submit("Настройки станций");
  expect(api.mock.calls.filter(([, options]) => options)).toHaveLength(0);
  expect(host.querySelector('[aria-label="Название приёмки"]').value).toBe("Мой черновик приёмки");
  await click("Загрузить актуальные станции");
  expect(host.querySelector('[aria-label="Приёмка: X, м"]').value).toBe("-9");
});
