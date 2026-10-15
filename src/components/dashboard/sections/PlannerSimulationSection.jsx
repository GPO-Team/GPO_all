import {useEffect,useRef,useState} from "react";
import {connectSimulationViewer} from "../../../features/planner/services/simulationViewer";

function SimulationImage({large=false}) {
  const frame=useRef(null);
  const [status,setStatus]=useState("connecting");
  const [mode,setMode]=useState(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const connection=useRef(null);
  useEffect(()=>{
    const dispose=connectSimulationViewer({frame:frame.current,onStatus:setStatus,onMode:setMode,onError:setError});
    connection.current=dispose;
    return ()=>{connection.current=null;dispose();};
  },[]);
  const changeMode=async value=>{
    const active=connection.current;
    if (!active) return;
    setPending(true);setError("");
    try {await active.setMode(value);}
    catch (failure) {if (connection.current === active) setError(failure.message);}
    finally {if (connection.current === active) setPending(false);}
  };
  return <>
    <p className="mb-2 text-xs text-slate-600" role="status">
      {status === "connected" ? "Интерактивный вид симуляции" : status === "error" ? "Просмотрщик недоступен" : status === "reconnecting" ? "Симулятор недоступен. Повторное подключение…" : "Подключение к симулятору…"}
    </p>
    <div className="mb-2 flex gap-2" role="group" aria-label="Скорость симуляции">
      {[["realtime","Обычная"],["fast","Максимальная"]].map(([value,label])=><button
        key={value} type="button" aria-pressed={mode === value}
        disabled={status !== "connected" || pending}
        onClick={()=>changeMode(value)}
        title={value === "realtime" ? "Цель — 1× реального времени" : "Максимальная скорость, доступная компьютеру"}
        className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${mode === value ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 text-slate-700 hover:bg-sky-50"}`}
      >{label}</button>)}
    </div>
    {pending && <p className="mb-2 text-xs text-slate-600" role="status">Изменяем скорость…</p>}
    {error && <p className="mb-2 text-xs text-red-700" role="alert">{error}</p>}
    <div className={large ? "min-h-[320px] flex-1 overflow-hidden rounded-lg bg-slate-950" : "aspect-video overflow-hidden rounded-lg bg-slate-950"}>
      <iframe ref={frame} title="Робот в симуляторе Webots" className="h-full w-full border-0" allow="fullscreen"/>
    </div>
  </>;
}

export default function PlannerSimulationSection({large=false}) {
  const [open,setOpen]=useState(large);
  const [expanded,setExpanded]=useState(false);
  const expandButton=useRef(null);
  useEffect(()=>{
    if(!expanded)return;
    const close=event=>{if(event.key==="Escape"){setExpanded(false);expandButton.current?.focus();}};
    window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);
  },[expanded]);
  return <section role={expanded?"dialog":undefined} aria-modal={expanded?true:undefined} aria-label={expanded?"Расширенная симуляция":undefined} className={`${large ? "flex h-full min-h-0 flex-col" : ""} ${expanded?"simulation-expanded":""} rounded-[18px] border border-sky-100 bg-white p-4`}>
    <div className="flex items-center justify-between gap-3">
    {large ? <h2 className="text-sm font-semibold">Симуляция Webots</h2> :
    <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="w-full text-left text-sm font-semibold">
      {open ? "Скрыть симуляцию" : "Показать симуляцию"}
    </button>}
    <button ref={expandButton} type="button" onClick={()=>{setOpen(true);setExpanded(value=>!value);}} className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-800">{expanded?"Вернуть в дашборд":"Развернуть симуляцию"}</button>
    </div>
    {open && <div className={large||expanded?"mt-3 flex min-h-0 flex-1 flex-col":"mt-3"}><SimulationImage large={large||expanded}/></div>}
  </section>;
}
