import { describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import nativeSolverModule from "./native-solver.cjs";

const { createNativeSolver } = nativeSolverModule;
const solver = createNativeSolver({ solverPath: "/missing/solver" });

describe("native solver adapter", () => {
  it.each([
    ["status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n1 0\n",[{x:0,y:0},{x:1,y:0},{x:2,y:0}],"hamiltonian_chain"],
    ["status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n2 0\n",[{x:0,y:0},{x:1,y:0}],"hamiltonian_chain"],
    ["status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n1 0\n",[{x:0,y:0},{x:1,y:0}],"tsp"],
    ["status ok\nclosed 0\nlength 1\norder 1 0\nroute_count 2\n1 0\n0 0\n",[{x:0,y:0},{x:1,y:0}],"shortest_route"],
    ["status ok\nclosed 0\nlength 99\norder 0 1\nroute_count 2\n0 0\n1 0\n",[{x:0,y:0},{x:1,y:0}],"hamiltonian_chain"],
    ["status ok\nclosed 1\nlength 2\norder 0 1\nroute_count 3\n0 0\n1 0\n1 0\n",[{x:0,y:0},{x:1,y:0}],"tsp"],
  ])("rejects solver output that does not match the request: %s", (output,points,taskKey) => {
    expect(() => solver.parseOutput(output,{points,taskKey})).toThrow();
  });
  it("rejects duplicate response metadata", () => {
    expect(() => solver.parseOutput("status ok\nclosed 0\nclosed 1\nlength 1\norder 0 1\nroute_count 2\n0 0\n1 0\n")).toThrow();
  });
  it.each([
    ["status ok\nclosed 0\nlength 0\norder\nroute_count 0\n",[],"tsp"],
    ["status ok\nclosed 1\nlength 0\norder 0\nroute_count 1\n1 2\n",[{x:1,y:2}],"tsp"],
    ["status ok\nclosed 1\nlength 2\norder 0 1\nroute_count 3\n0 0\n1 0\n0 0\n",[{x:0,y:0},{x:1,y:0}],"tsp"],
    ["status ok\nclosed 0\nlength 1\norder 1 0\nroute_count 2\n1 0\n0 0\n",[{x:0,y:0},{x:1,y:0}],"hamiltonian_chain"],
    ["status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n1 0\n",[{x:0.00000049,y:0},{x:1.00000049,y:0}],"shortest_route"],
  ])("accepts a matching request including native rounding: %s", (output,points,taskKey) => {
    expect(solver.parseOutput(output,{points,taskKey}).route.length).toBeGreaterThanOrEqual(points.length);
  });
  it("checks request identity when consuming a real successful child process", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(),"gpo-solver-request-"));
    try {
      const shim = path.join(directory,"output-shim.cjs");
      const output = "status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n1 0\n";
      await writeFile(shim, `process.stdout.write(${JSON.stringify(output)}); process.exit(0);`);
      vi.stubEnv("NODE_OPTIONS", `${process.env.NODE_OPTIONS || ""} --require="${shim.replaceAll("\\", "/")}"`);
      const runner = createNativeSolver({solverPath:process.execPath});
      const request = {points:[{x:0,y:0},{x:1,y:0}],algorithmKey:"ga_tabu",taskKey:"hamiltonian_chain",params:{},seed:1};
      await expect(runner.run(request)).resolves.toMatchObject({length:1,order:[0,1]});
      await expect(runner.run({...request,points:[...request.points,{x:2,y:0}]})).rejects.toThrow("requested points");
    } finally {
      vi.unstubAllEnvs();
      await rm(directory,{recursive:true,force:true});
    }
  });
  it.each([
    "status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n",
    "status ok\nclosed 0\nlength 1\norder 0\nroute_count 1.5\n0 0\n",
    "status ok\nclosed 0\nlength nan\norder 0\nroute_count 1\n0 0\n",
    "status ok\nclosed 0\nlength 1\norder 0 0\nroute_count 2\n0 0\n1 0\n",
    "status ok\nclosed 0\nlength\norder\nroute_count 0\n",
    "status ok\nclosed 0\nlength 0\norder\nroute_count\n",
  ])("rejects malformed solver output: %s", output => {
    expect(() => solver.parseOutput(output)).toThrow();
  });
  it("parses the native empty-route response without mistaking its order line for a missing field", () => {
    expect(solver.parseOutput("status ok\nclosed 0\nlength 0\norder\nroute_count 0\n")).toEqual({closed:false,length:0,order:[],route:[]});
  });

  it("rejects a failed process even when it printed a successful response", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(),"gpo-solver-exit-"));
    try {
      const shim = path.join(directory,"exit-shim.cjs");
      const output = "status ok\nclosed 0\nlength 1\norder 0 1\nroute_count 2\n0 0\n1 0\n";
      await writeFile(shim, `process.stdout.write(${JSON.stringify(output)}); process.exit(2);`);
      vi.stubEnv("NODE_OPTIONS", `${process.env.NODE_OPTIONS || ""} --require="${shim.replaceAll("\\", "/")}"`);
      const runner = createNativeSolver({solverPath:process.execPath});
      await expect(runner.run({points:[{x:0,y:0},{x:1,y:0}],algorithmKey:"ga_tabu",taskKey:"hamiltonian_chain",params:{},seed:1})).rejects.toThrow("кодом 2");
    } finally {
      vi.unstubAllEnvs();
      await rm(directory,{recursive:true,force:true});
    }
  });
  it("builds the existing stdin contract", () => {
    expect(
      solver.buildInput({
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        algorithmKey: "ga_tabu",
        taskKey: "tsp",
        params: { nests: 90, pa: 0.18, max_iter: 260, alpha: 0.9, beta: 24 },
        seed: 1337,
      })
    ).toBe(
      "task tsp\n" +
        "algorithm ga_tabu\n" +
        "seed 1337\n" +
        "params 90 0.18 260 0.9 24\n" +
        "count 2\n" +
        "1 2\n" +
        "3 4\n"
    );
  });

  it("parses a successful solver response", () => {
    expect(
      solver.parseOutput(
        "status ok\nclosed 1\nlength 4.5\norder 0 1\nroute_count 2\n1 2\n3 4\n"
      )
    ).toEqual({
      closed: true,
      length: 4.5,
      order: [0, 1],
      route: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    });
  });

  it("surfaces solver protocol errors", () => {
    expect(() => solver.parseOutput("status error\nmessage invalid input\n")).toThrow(
      "invalid input"
    );
  });
});
