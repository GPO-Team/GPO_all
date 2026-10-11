import { interpolateCanvasTelemetry } from "../model/plannerCanvasTelemetry";
import { renderPlannerCanvasFrame, renderPlannerCanvasScene } from "./plannerCanvasFrameRenderer";
import { renderPlannerRobot } from "./plannerCanvasPointRenderer";

export const startPlannerCanvasRenderLoop = ({
  canvasRef,
  telemetryTargetRef,
  telemetryRenderRef,
  drawStateRef,
  viewportRef,
  scheduleFrame = window.requestAnimationFrame,
  cancelFrame = window.cancelAnimationFrame,
}) => {
  let frameId = 0;
  let sceneCanvas;
  let lastState;
  let lastViewport;

  const render = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      telemetryRenderRef.current = interpolateCanvasTelemetry(
        telemetryRenderRef.current,
        telemetryTargetRef.current,
        0.35
      );
      const viewport = viewportRef?.current;
      if (viewport) {
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(viewport.width * dpr));
        const height = Math.max(1, Math.round(viewport.height * dpr));
        const key = `${width}:${height}:${dpr}:${viewport.scale}:${viewport.x}:${viewport.y}`;
        const state = { ...drawStateRef.current, viewScale: viewport.scale, markerScale: viewport.fitScale };
        if (!sceneCanvas) sceneCanvas = document.createElement("canvas");
        if (key !== lastViewport || lastState !== drawStateRef.current) {
          canvas.width = sceneCanvas.width = width;
          canvas.height = sceneCanvas.height = height;
          const scene = sceneCanvas.getContext("2d");
          scene.fillStyle = "#f1f5f9";
          scene.fillRect(0, 0, width, height);
          scene.setTransform(dpr * viewport.scale, 0, 0, dpr * viewport.scale, dpr * viewport.x, dpr * viewport.y);
          renderPlannerCanvasScene(scene, state);
          lastState = drawStateRef.current;
          lastViewport = key;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sceneCanvas, 0, 0);
        ctx.setTransform(dpr * viewport.scale, 0, 0, dpr * viewport.scale, dpr * viewport.x, dpr * viewport.y);
        renderPlannerRobot(ctx, state, telemetryRenderRef.current);
      } else {
        renderPlannerCanvasFrame(ctx, drawStateRef.current, telemetryRenderRef.current);
      }
    }
    frameId = scheduleFrame(render);
  };

  render();
  return () => cancelFrame(frameId);
};
