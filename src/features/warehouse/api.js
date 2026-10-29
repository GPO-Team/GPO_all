import { MISSION_API_BASE_URL } from "@/lib/runtimeConfig";

export async function warehouseApi(path = "", options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${MISSION_API_BASE_URL}/api/warehouse${path}`, {
      signal: controller.signal,
      ...(options
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(options.body),
          }
        : {}),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Сервис вернул некорректный ответ (${response.status})`);
    }
    if (!data || typeof data !== "object" || typeof data.ok !== "boolean")
      throw new Error(`Сервис вернул некорректный ответ (${response.status})`);
    if (!response.ok || !data.ok) {
      throw Object.assign(new Error(data.error || `Ошибка сервиса (${response.status})`), {
        status: response.status,
        code: data.code,
      });
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "Сервис склада не ответил за 15 секунд. Обновите данные перед повтором запроса.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function validateLayout(text) {
  const layout = JSON.parse(text);
  if (
    layout?.schemaVersion !== 1 ||
    !Array.isArray(layout.racks) ||
    !Array.isArray(layout.stations)
  ) {
    throw new Error("Нужен JSON планировки версии 1 с массивами racks и stations");
  }
  if (
    layout.racks.some(
      (rack) => !rack || typeof rack.code !== "string" || !Array.isArray(rack.levels),
    )
  ) {
    throw new Error("У каждого стеллажа должны быть код и массив уровней");
  }
  return { schemaVersion: 1, racks: layout.racks, stations: layout.stations };
}
