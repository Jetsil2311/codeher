// Main-thread API for the Python engine (tech spec 6.4): one reusable Pyodide worker,
// lazy load with status events, timeout that terminates and respawns the worker.

import { PYODIDE_INDEX_URL, type RunReport, type RunRequest, type RawError } from "@codeher/core";

export type PythonStatus = "idle" | "loading" | "ready" | "crashed";

export interface PythonEngineOptions {
  workerURL?: string;
  runnerURL?: string;
  indexURL?: string;
}

type Listener = (s: PythonStatus, detail?: string) => void;

function failure(type: string, message: string, runtimeMs = 0): RunReport {
  return { ok: false, stdout: "", truncated: false, error: { type, message, line: null } as RawError, tests: [], runtimeMs, language: "python" };
}

export class PythonEngine {
  private worker: Worker | null = null;
  private status: PythonStatus = "idle";
  private ready: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private pending = new Map<string, (r: RunReport) => void>();
  private readonly opts: Required<PythonEngineOptions>;
  private seq = 0;

  constructor(opts: PythonEngineOptions = {}) {
    this.opts = {
      workerURL: opts.workerURL ?? "/workers/python.worker.js",
      runnerURL: opts.runnerURL ?? "/workers/runner.py",
      indexURL: opts.indexURL ?? PYODIDE_INDEX_URL,
    };
  }

  get currentStatus() {
    return this.status;
  }

  onStatus(fn: Listener) {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: PythonStatus, detail?: string) {
    this.status = s;
    for (const l of this.listeners) l(s, detail);
  }

  /** Start downloading Pyodide (call when a Python lesson opens). */
  load(): Promise<void> {
    if (this.ready) return this.ready;
    this.setStatus("loading", "download");
    const w = new Worker(this.opts.workerURL);
    this.worker = w;
    this.ready = new Promise<void>((resolve, reject) => {
      w.onmessage = (ev: MessageEvent) => {
        const m = ev.data;
        if (m.type === "status") {
          if (m.status === "ready") {
            this.setStatus("ready");
            resolve();
          } else if (m.status === "crashed") {
            this.setStatus("crashed", m.message);
            this.ready = null;
            reject(new Error(m.message));
          } else this.setStatus("loading", m.stage);
        } else if (m.type === "result") {
          const done = this.pending.get(m.id);
          if (done) {
            this.pending.delete(m.id);
            done(m.report);
          }
        }
      };
      w.onerror = (e) => {
        this.setStatus("crashed", e.message);
        this.ready = null;
        reject(new Error(e.message));
      };
    });
    w.postMessage({ type: "init", indexURL: this.opts.indexURL, runnerURL: this.opts.runnerURL });
    return this.ready;
  }

  private reset() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const [, done] of this.pending) done(failure("WorkerCrashed", "worker restarted"));
    this.pending.clear();
    this.setStatus("idle");
  }

  async run(req: Omit<RunRequest, "id"> & { id?: string }): Promise<RunReport> {
    const t0 = Date.now();
    try {
      await this.load();
    } catch (e) {
      return failure("WorkerCrashed", String((e as Error).message));
    }
    const id = req.id ?? `py-${++this.seq}`;
    return new Promise<RunReport>((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        this.reset();
        // Warm the worker again in the background so the next run is fast.
        void this.load().catch(() => undefined);
        resolve(failure("Timeout", `timeout after ${req.timeoutMs} ms`, Date.now() - t0));
      }, req.timeoutMs + 300);
      this.pending.set(id, (report) => {
        clearTimeout(timer);
        resolve(report);
      });
      this.worker!.postMessage({ type: "run", id, req: { ...req, id } });
    });
  }
}

let shared: PythonEngine | null = null;
export function getPythonEngine(): PythonEngine {
  shared ??= new PythonEngine();
  return shared;
}
