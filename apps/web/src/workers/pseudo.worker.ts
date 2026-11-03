/// <reference lib="webworker" />
// Pseudocode Web Worker: pure TypeScript interpreter, no WebAssembly, no eval.
import { createPseudoWorkerHandler, type PseudoWorkerRequest } from "@codeher/grader/pseudo/worker";

const handle = createPseudoWorkerHandler((msg) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg));
self.onmessage = (ev: MessageEvent<PseudoWorkerRequest>) => handle(ev.data);
