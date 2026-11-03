// Node adapter that grades Python with the same runner.py harness, using a local
// CPython (python3) in a child process with a hard timeout. Used by tests, seed
// validation and the local MCP server. In production the MCP server can swap this
// for the pyodide npm package (tech spec 7.4).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunReport, RunRequest } from "@codeher/core";

const RUNNER = resolve(dirname(fileURLToPath(import.meta.url)), "runner.py");

export function runPythonLocally(req: RunRequest, python = process.env.PYTHON_BIN ?? "python3"): RunReport {
  const script = `import sys, json, importlib.util\nspec = importlib.util.spec_from_file_location("runner", ${JSON.stringify(RUNNER)})\nr = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)\nsys.stdout.write(r.run_request(sys.stdin.read()))\n`;
  const res = spawnSync(python, ["-I", "-c", script], { input: JSON.stringify(req), timeout: req.timeoutMs + 1000, encoding: "utf8" });
  if (res.error || res.status !== 0) {
    const timedOut = (res.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT" || res.signal === "SIGTERM";
    return {
      ok: false, stdout: "", truncated: false, tests: [], runtimeMs: req.timeoutMs, language: "python",
      error: { type: timedOut ? "Timeout" : "HarnessError", message: timedOut ? "timeout" : String(res.stderr || res.error), line: null },
    };
  }
  return JSON.parse(res.stdout) as RunReport;
}
