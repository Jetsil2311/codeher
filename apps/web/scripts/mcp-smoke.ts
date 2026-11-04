// End-to-end smoke test of the MCP route in local mode (no Supabase, no real keys):
//   CODEHER_DATA_FILE=/tmp/x.json DATA_MODE=local node --conditions=react-server --import tsx scripts/mcp-smoke.ts
import { write } from "../src/server/db/store";
import { createApiKey } from "../src/server/services/local/staff";
import { POST } from "../src/app/api/mcp/route";

const founder = write((db) => db.profiles.find((p) => p.role === "founder")!);
const { token } = createApiKey(founder, "smoke");
let id = 0;
async function call(method: string, params: Record<string, unknown> = {}) {
  const res = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    }),
  );
  const body = (await res.json()) as { result?: { content?: { text: string }[]; isError?: boolean; tools?: { name: string }[] }; error?: unknown };
  return { status: res.status, body };
}
const tool = async (name: string, args: Record<string, unknown>) => {
  const r = await call("tools/call", { name, arguments: args });
  const text = r.body.result?.content?.[0]?.text ?? JSON.stringify(r.body);
  return { error: !!r.body.result?.isError, data: (() => { try { return JSON.parse(text); } catch { return text; } })() };
};

const unauth = await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" }));
console.log("no key ->", unauth.status);
console.log("initialize ->", (await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } })).status);
console.log("tools ->", (await call("tools/list")).body.result?.tools?.map((t) => t.name).join(", "));
const guide = await tool("get_authoring_guide", {});
console.log("guide ->", String(guide.data).slice(0, 40));
const courses = await tool("list_courses", {});
console.log("courses ->", (courses.data as { title: string }[]).map((c) => c.title).join(" | "));
const moduleId = (courses.data as { modules: { id: string }[] }[])[0].modules[0].id;

const created = await tool("create_lesson", { title: "Ciclos Mientras", slug: "mcp-smoke-mientras", language: "pseudocode_es", visibility: "program", module_id: moduleId, content_md: "Un **ciclo Mientras** repite mientras la condición sea verdadera." });
console.log("create_lesson ->", created.error ? created.data : created.data.status);
const lessonId = created.data.id as string;

const P = (body: string) => `Proceso Cuenta\n    Definir i Como Entero;\n${body}\nFinProceso\n`;
const exercise = {
  slug: "cuenta-a-tres",
  type: "code",
  title: "Cuenta hasta 3",
  instructions_md: "Usa `Mientras` para escribir 1, 2 y 3.",
  starter_code: P("    i <- 1;\n    // Escribe tu ciclo aquí"),
  tests: [
    { kind: "stdout", description: "Escribe 1, 2 y 3", spec: { expected: "1\n2\n3" } },
    { kind: "construct_rule", description: "Usa Mientras", spec: { must_contain: ["Mientras"], message_es: "Usa un ciclo Mientras." } },
  ],
  hints: ["Empieza con i <- 1.", "Suma 1 a i dentro del ciclo."],
  solution: { solution_code: P("    i <- 1;\n    Mientras i <= 3 Hacer\n        Escribir i;\n        i <- i + 1;\n    FinMientras") },
  known_wrong_solutions: [P("    i <- 1;\n    Mientras i < 3 Hacer\n        Escribir i;\n        i <- i + 1;\n    FinMientras")],
};
const bad = await tool("save_exercise", { lesson_id: lessonId, exercise: { ...exercise, solution: { solution_code: exercise.starter_code } } });
console.log("save_exercise (broken solution) ->", bad.data.saved, bad.data.validation?.steps?.find((s: { ok: boolean }) => !s.ok)?.check);
const good = await tool("save_exercise", { lesson_id: lessonId, exercise });
console.log("save_exercise ->", good.data.saved, "validated:", good.data.validated);
const deck = await tool("save_slide_deck", { lesson_id: lessonId, deck: { schema_version: 1, slides: [{ id: "s1", title: "¿Qué es un ciclo?", blocks: [{ type: "text", markdown: "Repite instrucciones." }] }] } });
console.log("save_slide_deck ->", deck.data.saved);
const got = await tool("get_lesson", { lesson: "mcp-smoke-mientras" });
console.log("get_lesson ->", got.data.lesson?.status, got.data.exercises?.length, "exercise(s), deck:", !!got.data.deck);
console.log("submit_for_review ->", (await tool("submit_for_review", { lesson_id: lessonId })).data.status);
const published = (await tool("list_lessons", { status: "published" })).data as { id: string }[];
const locked = await tool("update_lesson", { lesson_id: published[0].id, title: "Cambiado por Claude" });
console.log("update published lesson ->", locked.error ? locked.data : "UPDATED (should be blocked)");
