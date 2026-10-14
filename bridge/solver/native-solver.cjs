const fs = require("fs");
const { spawn } = require("child_process");
const {maxRoutePoints} = require("../../shared/controller-limits.json");

const DEFAULT_TIMEOUT_MS = 30000;

const createNativeSolver = ({ solverPath, timeoutMs = DEFAULT_TIMEOUT_MS }) => {
  const solverExists = async () => {
    try {
      await fs.promises.access(solverPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  };

  const buildInput = ({ points, algorithmKey, taskKey, params, seed }) => {
    const lines = [
      `task ${taskKey}`,
      `algorithm ${algorithmKey}`,
      `seed ${seed}`,
      `params ${params.nests} ${params.pa} ${params.max_iter} ${params.alpha} ${params.beta}`,
      `count ${points.length}`,
    ];

    for (const point of points) {
      lines.push(`${point.x} ${point.y}`);
    }

    return `${lines.join("\n")}\n`;
  };

  const parseOutput = (stdout, request) => {
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new Error("Solver returned an empty response.");
    }

    const [statusLine, ...rest] = lines;
    if (statusLine !== "status ok") {
      const errorLine = rest.find((line) => line.startsWith("message "));
      throw new Error(errorLine ? errorLine.slice("message ".length) : "Native solver failed.");
    }

    const getValueLine = (prefix) => {
      const matches = rest.filter((item) => item.startsWith(prefix) || item === prefix.trim());
      if (matches.length > 1) throw new Error(`Solver response repeats "${prefix.trim()}".`);
      const line = matches[0];
      if (!line) throw new Error(`Solver response is missing "${prefix.trim()}".`);
      return line === prefix.trim() ? "" : line.slice(prefix.length);
    };

    const closedValue = getValueLine("closed ");
    if (!["0", "1"].includes(closedValue)) throw new Error("Solver returned an invalid closure flag.");
    const closed = closedValue === "1";
    const lengthValue = getValueLine("length ");
    const length = Number(lengthValue);
    if (!lengthValue || !Number.isFinite(length) || length < 0) throw new Error("Solver returned an invalid route length.");
    const order = getValueLine("order ")
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number(value));
    const routeCountValue = getValueLine("route_count ");
    const routeCount = Number(routeCountValue);
    if (!routeCountValue || !Number.isInteger(routeCount) || routeCount < 0 || routeCount > maxRoutePoints + 1) {
      throw new Error("Solver returned an invalid route count.");
    }

    const routeStart = rest.findIndex((line) => line.startsWith("route_count "));
    if (rest.length - routeStart - 1 !== routeCount) throw new Error("Solver returned an incomplete route.");
    if (order.length > maxRoutePoints || new Set(order).size !== order.length ||
        order.some(index => !Number.isInteger(index) || index < 0 || index >= order.length) ||
        (order.length !== routeCount && !(closed && order.length + 1 === routeCount))) {
      throw new Error("Solver returned an invalid point order.");
    }
    const route = rest
      .slice(routeStart + 1, routeStart + 1 + routeCount)
      .map((line) => {
        const values = line.split(/\s+/).map(Number);
        if (values.length !== 2) throw new Error("Solver returned an invalid route point.");
        const [x, y] = values;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error("Solver returned an invalid route point.");
        }
        return { x, y };
      });

    if (request) {
      const {points, taskKey} = request;
      const expectedClosed = points.length > 0 && taskKey === "tsp";
      const expectedCount = points.length + (expectedClosed && points.length > 1 ? 1 : 0);
      if (order.length !== points.length || route.length !== expectedCount || closed !== expectedClosed) {
        throw new Error("Solver response does not match the requested points or task.");
      }
      // Native coordinates and length are printed with six decimal places.
      const precision = 0.00000051;
      for (let index = 0; index < route.length; ++index) {
        const expected = points[order[index % order.length]];
        if (Math.abs(route[index].x - expected.x) > precision || Math.abs(route[index].y - expected.y) > precision) {
          throw new Error("Solver returned coordinates that do not match the point order.");
        }
      }
      if (taskKey === "shortest_route" && points.length > 1 && (order[0] !== 0 || order.at(-1) !== points.length - 1)) {
        throw new Error("Solver changed the fixed route endpoints.");
      }
      let expectedLength = 0;
      for (let index = 1; index < expectedCount; ++index) {
        const previous = points[order[(index - 1) % order.length]];
        const current = points[order[index % order.length]];
        expectedLength += Math.hypot(current.x - previous.x, current.y - previous.y);
      }
      if (Math.abs(length - expectedLength) > precision + expectedLength * Number.EPSILON * points.length) {
        throw new Error("Solver returned a length that does not match the route.");
      }
    }

    return {
      closed,
      length,
      order,
      route,
    };
  };

  const run = async ({ points, algorithmKey, params, taskKey, seed }) => {
    if (!(await solverExists())) {
      throw new Error(
        `Не найден native solver: ${solverPath}. Сначала соберите его для текущей платформы.`
      );
    }

    const input = buildInput({ points, algorithmKey, taskKey, params, seed });

    return new Promise((resolve, reject) => {
      const child = spawn(solverPath, [], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      const finish = (handler) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        handler();
      };

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        finish(() => reject(new Error(`Не удалось запустить native solver: ${error.message}`)));
      });

      child.on("close", (code, signal) => {
        finish(() => {
          if (timedOut) {
            reject(new Error(`Native solver превысил лимит ${timeoutMs} мс.`));
            return;
          }
          if (signal) {
            reject(new Error(`Native solver был остановлен сигналом ${signal}.`));
            return;
          }
          if (code !== 0 && !stdout.trim()) {
            reject(new Error(stderr.trim() || "Native solver завершился с ошибкой."));
            return;
          }

          try {
            const result = parseOutput(stdout, {points, taskKey});
            if (code !== 0) throw new Error(stderr.trim() || `Native solver завершился с кодом ${code}.`);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });

      child.stdin.on("error", () => {});
      child.stdin.end(input, "utf8");
    });
  };

  return {
    buildInput,
    parseOutput,
    run,
    solverExists,
  };
};

module.exports = { createNativeSolver };
