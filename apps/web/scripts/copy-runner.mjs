// Copies the Python harness (packages/grader/src/python/runner.py) next to the
// Pyodide worker so the browser can fetch it. Single source of truth stays in the grader.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../packages/grader/src/python/runner.py");
const dst = resolve(here, "../public/workers/runner.py");
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log("runner.py copied to public/workers");
