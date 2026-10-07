import {useCallback,useEffect,useRef,useState} from "react";
import {getMission,listMissions,cancelMission,resumeMission} from "../services/missionClient";
const terminal = new Set(["completed","failed","cancelled"]);
export const useMissionTracking = ({onStarted,fetchMission = getMission}) => {
  const [missionId,setMissionId] = useState(null);
  const [state,setState] = useState(null);
  const [actionError,setActionError] = useState(null);
  const [actionPending,setActionPending] = useState(null);
  const pendingAction = useRef(false);
  const control = useCallback(async (action,request) => {
    if (!missionId || pendingAction.current) return;
    pendingAction.current = true;
    setActionError(null);
    setActionPending(action);
    try {
      const result = await request(missionId);
      if (result.missionId !== missionId) throw new Error("Ответ относится к другой миссии.");
      setState(previous => previous?.missionId === missionId ? {...previous,...result} : previous);
    } catch(error) {setActionError(error.message);}
    finally {pendingAction.current=false;setActionPending(null);}
  },[missionId]);
  const cancel = useCallback(async () => {
    await control("cancel",cancelMission);
  },[control]);
  const resume = useCallback(async () => {
    await control("resume",resumeMission);
  },[control]);
  const track = useCallback(ack => {
    if (!ack?.missionId) return;
    setActionError(null);
    setState({...ack,missionId:ack.missionId,status:ack.status || "persisted"});
    setMissionId(ack.missionId);
  },[]);
  useEffect(() => {
    if (missionId || fetchMission !== getMission) return;
    const controller = new AbortController();
    let timer;
    const restore = async () => {
      try {
        const records = await listMissions(controller.signal);
        if(controller.signal.aborted)return;
        const active=records.find(record=>!terminal.has(record.status));
        if(active){track(active);return;}
      } catch { /* Retry discovery after the mission service returns. */ }
      if(!controller.signal.aborted)timer=setTimeout(restore,1000);
    };
    restore();
    return ()=>{controller.abort();clearTimeout(timer);};
  },[missionId,fetchMission,track]);
  useEffect(() => {
    if (!missionId) return;
    const controller = new AbortController();
    let timer;
    let started = false;
    const poll = async () => {
      try {
        const result = await fetchMission(missionId,controller.signal);
        if (controller.signal.aborted) return;
        if (result.missionId !== missionId) throw new Error("Ответ относится к другой миссии.");
        setState(result);
        if (result.status === "running" && !started) {started=true;onStarted?.();}
        if (terminal.has(result.status)) {setMissionId(null);return;}
      } catch(error) {
        if (controller.signal.aborted) return;
        setState(previous => ({...previous,connectionError:error.message}));
      }
      timer = setTimeout(poll,1000);
    };
    poll();
    return () => {controller.abort();clearTimeout(timer);};
  },[missionId,fetchMission,onStarted]);
  return {state:state ? {...state,actionError,actionPending} : null,track,cancel,resume};
};
