import { MISSION_API_BASE_URL } from "../../../lib/runtimeConfig";
export const getMission = async (missionId,signal) => {
  const response = await fetch(`${MISSION_API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}`,{signal});
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "Состояние миссии недоступно.");
  return result;
};

export const listMissions = async signal => {
  const response = await fetch(`${MISSION_API_BASE_URL}/api/missions`,{signal});
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "История миссий недоступна.");
  return result.missions;
};
export const cancelMission = async missionId => {
  const response = await fetch(`${MISSION_API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}/cancel`,{method:"POST"});
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "Отмена миссии недоступна.");
  return result;
};
export const resumeMission = async missionId => {
  const response = await fetch(`${MISSION_API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}/resume`,{method:"POST"});
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "Продолжение миссии недоступно.");
  return result;
};
