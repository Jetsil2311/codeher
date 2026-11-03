/* CODEHER Pyodide worker (classic worker). Loaded lazily, only for Python lessons.
   The harness (runner.py) is the one in packages/grader, copied here at build time. */
let pyodide = null;
let runRequest = null;
let checkSyntax = null;

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type === "init") {
    try {
      self.postMessage({ type: "status", status: "loading", stage: "download" });
      importScripts(msg.indexURL + "pyodide.js");
      self.postMessage({ type: "status", status: "loading", stage: "start" });
      pyodide = await self.loadPyodide({ indexURL: msg.indexURL });
      const src = await (await fetch(msg.runnerURL)).text();
      pyodide.runPython(src);
      runRequest = pyodide.globals.get("run_request");
      checkSyntax = pyodide.globals.get("check_syntax");
      self.postMessage({ type: "status", status: "ready" });
    } catch (err) {
      self.postMessage({ type: "status", status: "crashed", message: String(err && err.message ? err.message : err) });
    }
    return;
  }
  if (msg.type === "run") {
    try {
      const out = runRequest(JSON.stringify(msg.req));
      self.postMessage({ type: "result", id: msg.id, report: JSON.parse(out) });
    } catch (err) {
      self.postMessage({
        type: "result",
        id: msg.id,
        report: {
          ok: false,
          stdout: "",
          truncated: false,
          error: { type: "HarnessError", message: String(err && err.message ? err.message : err), line: null },
          tests: [],
          runtimeMs: 0,
          language: "python",
        },
      });
    }
    return;
  }
  if (msg.type === "syntax") {
    try {
      self.postMessage({ type: "syntax", id: msg.id, error: JSON.parse(checkSyntax(msg.code)) });
    } catch (err) {
      self.postMessage({ type: "syntax", id: msg.id, error: null });
    }
  }
};
