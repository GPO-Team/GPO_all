import { MISSION_API_BASE_URL } from "../../../lib/runtimeConfig";

const REQUEST_TIMEOUT_MS = 10000;
const requestMission = async (path, message, { method = "GET", signal } = {}) => {
  const controller = new AbortController();
  const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(new Error(message)), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${MISSION_API_BASE_URL}/api/missions${path}`, { method, signal: requestSignal });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error(result?.error || message);
    return result;
  } finally {
    clearTimeout(timer);
  }
};

export const getMission = (missionId, signal) =>
  requestMission(`/${encodeURIComponent(missionId)}`, "Состояние миссии недоступно.", { signal });

export const listMissions = async signal => {
  const result = await requestMission("", "История миссий недоступна.", { signal });
  return result.missions;
};

export const cancelMission = missionId =>
  requestMission(`/${encodeURIComponent(missionId)}/cancel`, "Отмена миссии недоступна.", { method: "POST" });

export const resumeMission = missionId =>
  requestMission(`/${encodeURIComponent(missionId)}/resume`, "Продолжение миссии недоступно.", { method: "POST" });
