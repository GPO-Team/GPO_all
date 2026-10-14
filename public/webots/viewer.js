import {webots} from "./wwi/webots.js";
import {changeGtaoLevel} from "./wwi/nodes/wb_preferences.js";
import ImageLoader from "./wwi/ImageLoader.js";
import {bufferSceneUpdates} from "./scene-buffer.js";
import WbLidar from "./wwi/nodes/WbLidar.js";
import {hideLidarFrustum} from "./lidar-display.js";

hideLidarFrustum(WbLidar);

// Serve this world's release-pinned textures from the frontend image too.
const loadTextureData=ImageLoader.loadTextureData;
ImageLoader.loadTextureData=function(prefix,url,...args) {
  const upstream="https://raw.githubusercontent.com/cyberbotics/webots/R2025a/";
  const path=url.startsWith(upstream) ? url.slice(upstream.length) :
    url.startsWith("webots://") ? url.slice(9) : null;
  if(path !== null)url=new URL(`/webots/wwi/world-assets/${path}`,location.origin).href;
  return loadTextureData.call(this,prefix,url,...args);
};

const session=new URLSearchParams(location.search).get("session");
const send=(type,values={})=>parent.postMessage({channel:"gpo-w3d",session,type,...values},location.origin);
let socket,closed=false,viewer,flushScene;
const loadScript=src=>new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Не удалось загрузить ${src}`));
  document.head.appendChild(script);
});

async function connect() {
  // Same runtime as WebotsView, without Toolbar (whose initialization pauses the simulation).
  const runtime=new Promise((resolve,reject)=>{
    window.Module={locateFile:path=>`/webots/wwi/${path}`,onRuntimeInitialized:resolve,
      onAbort:()=>reject(new Error("Не удалось запустить WebGL2-просмотрщик."))};
  });
  await Promise.all([runtime,...["dependencies/ansi_up.js","dependencies/assimpjs.js",
    "dependencies/glm-js.min.js","dependencies/quaternion.min.js","dependencies/libtess.min.js",
    "enum.js","wrenjs.js"].map(path=>loadScript(`/webots/wwi/${path}`))]);
  changeGtaoLevel(0);
  viewer=new webots.View(document.getElementById("viewer"),false);
  // Disable the server's zero-second client timeout on initial W3D negotiation.
  viewer.broadcast=true;
  viewer.setTimeout(-1);
  viewer.onready=()=>{flushScene?.();viewer.onresize();send("ready");};
  const endpoint=new URL("/simulation",location.href);
  endpoint.protocol=endpoint.protocol === "https:" ? "wss:" : "ws:";
  viewer.open(endpoint.href,"w3d");
  // R2025a's public message callback only forwards controller stdout. Observe the
  // actual socket for clock acknowledgements, without replacing scene processing.
  socket=viewer.stream.socket;
  flushScene=bufferSceneUpdates(socket);
  // Upstream close handler opens a blocking confirm dialog. The parent reloads
  // this isolated document instead, which also releases all WebGL/global state.
  socket.onclose=null;
  socket.addEventListener("close",()=>{if(!closed)send("disconnected");});
  socket.addEventListener("message",event=>{
    if(event.data === "real-time")send("mode",{mode:"realtime"});
    else if(event.data === "fast")send("mode",{mode:"fast"});
    else if(typeof event.data === "string" && event.data.startsWith("pause"))send("mode",{mode:"paused"});
  });
}
window.addEventListener("message",event=>{
  const message=event.data;
  if(event.origin !== location.origin || event.source !== parent || message?.channel !== "gpo-w3d" ||
     message.session !== session || message.type !== "set-mode" || !["realtime","fast"].includes(message.mode))return;
  if(socket?.readyState !== WebSocket.OPEN) {send("error",{message:"Симулятор не подключён."});return;}
  socket.send(message.mode === "fast" ? "fast:-1" : "real-time:-1");
});
window.addEventListener("pagehide",()=>{closed=true;socket?.close();});
connect().catch(error=>send("error",{fatal:true,message:error.message}));
