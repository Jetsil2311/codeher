// Message handler for the pseudocode Web Worker. The worker entry file only wires
// `self.onmessage` to this function, so the same logic is testable in Node.

import type { RunRequest } from "@codeher/core";
import { createSession, format, grade, lint, type Session, type SessionEvent } from "./index";

export type PseudoWorkerRequest =
  | { type: "run"; id: string; code: string; stdin?: string[]; interactive?: boolean; seed?: number; timeoutMs?: number }
  | { type: "debug"; id: string; code: string; stdin?: string[]; seed?: number }
  | { type: "step"; id: string }
  | { type: "input"; id: string; value: string }
  | { type: "grade"; id: string; req: RunRequest }
  | { type: "lint"; id: string; code: string }
  | { type: "format"; id: string; code: string };

export type PseudoWorkerResponse =
  | { type: "event"; id: string; event: SessionEvent | { type: "compileError"; error: NonNullable<ReturnType<typeof createSession>["error"]> } }
  | { type: "graded"; id: string; report: ReturnType<typeof grade> }
  | { type: "linted"; id: string; diagnostics: ReturnType<typeof lint> }
  | { type: "formatted"; id: string; code: string };

export function createPseudoWorkerHandler(post: (msg: PseudoWorkerResponse) => void) {
  let session: Session | null = null;
  let sessionId = "";
  let mode: "run" | "debug" = "run";
  let timeoutMs = 5000;

  const pump = () => {
    if (!session) return;
    const deadline = Date.now() + timeoutMs;
    const loop = () => {
      if (!session) return;
      const ev = session.run(25_000, deadline);
      post({ type: "event", id: sessionId, event: ev });
      if (ev.type === "paused") setTimeout(loop, 0);
    };
    loop();
  };

  return (msg: PseudoWorkerRequest) => {
    switch (msg.type) {
      case "run":
      case "debug": {
        mode = msg.type;
        sessionId = msg.id;
        timeoutMs = msg.type === "run" ? (msg.timeoutMs ?? 5000) : 5000;
        const { session: s, error } = createSession(msg.code, {
          stdin: msg.stdin,
          interactive: msg.type === "debug" ? true : (msg.interactive ?? true),
          seed: msg.seed,
        });
        session = s;
        if (!s) {
          post({ type: "event", id: msg.id, event: { type: "compileError", error: error! } });
          return;
        }
        if (mode === "run") pump();
        else post({ type: "event", id: msg.id, event: s.step() });
        return;
      }
      case "step":
        if (session && msg.id === sessionId) post({ type: "event", id: msg.id, event: session.step() });
        return;
      case "input":
        if (session && msg.id === sessionId) {
          session.provideInput(msg.value);
          if (mode === "run") pump();
          else post({ type: "event", id: msg.id, event: session.step() });
        }
        return;
      case "grade":
        post({ type: "graded", id: msg.id, report: grade(msg.req) });
        return;
      case "lint":
        post({ type: "linted", id: msg.id, diagnostics: lint(msg.code) });
        return;
      case "format":
        post({ type: "formatted", id: msg.id, code: format(msg.code) });
        return;
    }
  };
}
