import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { runContainerStack } from "./container-stack.mjs";

const root = path.resolve(import.meta.dirname, "..");
const run = (args, { capture = false, env = process.env, timeoutMs = 0 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: root, env, windowsHide: true, timeout: timeoutMs,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    child.stdout?.on("data", data => { output += data; });
    child.stderr?.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code: code ?? 1, output: output + (signal ? `\nDocker command stopped (${signal}); timeout ${timeoutMs}ms` : "") }));
  });

let revision = "unknown";
try {
  const git = args => execFileSync("git", args, { cwd: root, windowsHide: true, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  revision = git(["rev-parse", "HEAD"]) + (git(["status", "--porcelain"]) ? "-dirty" : "");
} catch { /* A source archive can run without Git. */ }

try {
  await runContainerStack({ run, args: process.argv.slice(2), revision });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
