"use client";
// Client-side engine access (tech spec 6.4: getEngine(language)). Pseudocode uses a small
// worker bundle; Pyodide is only downloaded the first time a Python lesson runs.
import type { CodeLanguage, RunReport, RunRequest } from "@codeher/core";
import type { PseudoWorkerRequest, PseudoWorkerResponse } from "@codeher/grader/pseudo/worker";
import { getPythonEngine } from "@codeher/grader/python";

type Listener = (msg: PseudoWorkerResponse) => void;

class PseudoClient {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private seq = 0;

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL("../../workers/pseudo.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (ev: MessageEvent<PseudoWorkerResponse>) => this.listeners.forEach((l) => l(ev.data));
    this.worker = w;
    return w;
  }
  nextId(prefix = "ps") {
    return `${prefix}-${++this.seq}-${Date.now()}`;
  }
  post(msg: PseudoWorkerRequest) {
    this.ensure().postMessage(msg);
  }
  on(fn: Listener) {
    this.ensure();
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Kill a runaway program (timeout or "Detener"). */
  restart() {
    this.worker?.terminate();
    this.worker = null;
    const ls = [...this.listeners];
    this.listeners.clear();
    this.ensure();
    ls.forEach((l) => this.listeners.add(l));
  }
  grade(req: RunRequest): Promise<RunReport> {
    return new Promise((resolve) => {
      const id = req.id;
      const timer = setTimeout(() => {
        off();
        this.restart();
        resolve({ ok: false, stdout: "", truncated: false, error: { type: "Timeout", message: "timeout", line: null }, tests: [], runtimeMs: req.timeoutMs, language: "pseudocode_es" });
      }, req.timeoutMs + 1500);
      const off = this.on((m) => {
        if (m.type === "graded" && m.id === id) {
          clearTimeout(timer);
          off();
          resolve(m.report);
        }
      });
      this.post({ type: "grade", id, req });
    });
  }
}

let pseudo: PseudoClient | null = null;
export function getPseudoClient(): PseudoClient {
  pseudo ??= new PseudoClient();
  return pseudo;
}

export function gradeWith(language: CodeLanguage, req: RunRequest): Promise<RunReport> {
  return language === "python" ? getPythonEngine().run(req) : getPseudoClient().grade(req);
}

export { getPythonEngine };
