import { ROUTE_WS_URL } from "../../../lib/runtimeConfig";

// Completion acknowledges persistence, not execution by the controller.
export const sendRouteChannelPayload = (routeSocketRef, payload, { onSent, onError, timeoutMs = 5000 } = {}) =>
  new Promise((resolve) => {
    const requestId = payload.requestId || crypto.randomUUID();
    const shared = routeSocketRef.current;
    const temporary = shared?.readyState !== WebSocket.OPEN;
    const socket = temporary ? new WebSocket(ROUTE_WS_URL) : shared;
    let settled = false;
    let sent=false;
    const finish = (error, acknowledgement) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeEventListener("open", send);
      socket.removeEventListener("message", receive);
      socket.removeEventListener("error", fail);
      socket.removeEventListener("close", fail);
      if (temporary) socket.close();
      if (error) {error.mayHaveReachedRobot=sent && !acknowledgement;onError?.(error);}
      else onSent?.(acknowledgement);
      resolve(!error);
    };
    const send = () => {
      try { socket.send(JSON.stringify({ ...payload, requestId }));sent=true; }
      catch (error) { finish(error); }
    };
    const receive = (event) => {
      let response;
      try { response = JSON.parse(event.data); } catch { return; }
      if (response.type !== "route.ack" || response.requestId !== requestId) return;
      const message = response.code === "mission_active"
        ? "Предыдущая миссия ещё активна. Нажмите «Остановить маршрут», дождитесь подтверждения остановки и отправьте маршрут снова."
        : response.error || "Bridge отклонил команду.";
      finish(response.ok ? null : new Error(message), response);
    };
    const fail = () => finish(new Error("Соединение прервано до подтверждения команды."));
    const timer = setTimeout(() => finish(new Error("Bridge не подтвердил сохранение команды.")), timeoutMs);
    socket.addEventListener("message", receive);
    socket.addEventListener("error", fail);
    socket.addEventListener("close", fail);
    if (temporary) socket.addEventListener("open", send);
    else send();
  });
