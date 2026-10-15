import { expect, it } from "vitest";
import { runContainerStack } from "./container-stack.mjs";

function harness(fail = () => false) {
  const calls = [];
  const run = async (args, options) => {
    calls.push({ args, options });
    return fail(args) || { code: 0, output: "" };
  };
  return { calls, run };
}

it("stops before building when Docker Engine is unavailable", async () => {
  const h = harness(args => args[0] === "info" && { code: 1, output: "engine offline" });
  await expect(runContainerStack({ run: h.run, log: () => {} })).rejects.toThrow(/Docker Engine.*engine offline/s);
  expect(h.calls).toHaveLength(1);
  expect(h.calls[0].options.timeoutMs).toBe(15000);
});

it("rebuilds current sources and falls back to CPU when WSLg mounts are unavailable", async () => {
  const h = harness(args => args[0] === "run" && { code: 1, output: "no dxg" });
  await runContainerStack({ run: h.run, revision: "abc123-dirty", log: () => {} });
  expect(h.calls.some(({ args }) => args.includes("build"))).toBe(true);
  const up = h.calls.find(({ args }) => args.includes("up"));
  expect(up.args).not.toContain("compose.simulator.gpu-wslg.yaml");
  expect(up.options.env).toMatchObject({ WEBOTS_RENDERER: "cpu", GPO_SOURCE_REVISION: "abc123-dirty" });
});

it("selects WSLg with automatic OpenGL fallback when its device and mounts exist", async () => {
  const h = harness();
  await runContainerStack({ run: h.run, args: ["--no-build"], log: () => {} });
  expect(h.calls.some(({ args }) => args.includes("build"))).toBe(false);
  const up = h.calls.find(({ args }) => args.includes("up"));
  expect(up.args).toContain("compose.simulator.gpu-wslg.yaml");
  expect(up.options.env.WEBOTS_RENDERER).toBe("auto");
});

it("rejects explicitly requested GPU before starting services if mounts are missing", async () => {
  const h = harness(args => args[0] === "run" && { code: 1, output: "no dxg" });
  await expect(runContainerStack({ run: h.run, args: ["--gpu", "--no-build"], log: () => {} })).rejects.toThrow(/GPU/);
  expect(h.calls.some(({ args }) => args.includes("up"))).toBe(false);
});

it("keeps explicit GPU mode strict and does not announce CPU fallback", async () => {
  const h = harness(), messages=[];
  await runContainerStack({ run: h.run, args: ["--gpu", "--no-build"], log: value => messages.push(value) });
  expect(h.calls.find(({ args }) => args.includes("up")).options.env.WEBOTS_RENDERER).toBe("gpu");
  expect(messages.join(" ")).not.toContain("при неудаче использую CPU");
});

it("captures service status and recent logs after failed startup without removing volumes", async () => {
  const h = harness(args => args.includes("up") && { code: 1, output: "unhealthy" });
  await expect(runContainerStack({ run: h.run, args: ["--cpu"], log: () => {} })).rejects.toThrow(/startup/i);
  expect(h.calls.some(({ args }) => args.includes("ps") && args.includes("--all"))).toBe(true);
  expect(h.calls.some(({ args }) => args.includes("logs") && args.includes("--tail"))).toBe(true);
  expect(h.calls.some(({ args }) => args.includes("down"))).toBe(false);
});

it("validates incompatible flags before touching Docker", async () => {
  const h = harness();
  await expect(runContainerStack({ run: h.run, args: ["--cpu", "--gpu"] })).rejects.toThrow(/either/);
  expect(h.calls).toHaveLength(0);
});
