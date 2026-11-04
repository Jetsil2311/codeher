// Prints idempotent SQL that loads CODEHER's starting content into Supabase:
// communities, settings, curriculum (courses, modules, lessons, exercises with tests,
// hints and solutions, slide decks), friendly error messages, sample Logros and the
// first founder invite. No demo accounts or demo students (those are local-mode only).
//
//   node --conditions=react-server --import tsx scripts/seed-supabase.ts > seed.sql
//   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v gate="$STUDENT_GATE_SECRET" -1 -f seed.sql
import { buildSeed } from "../src/server/db/seed";

const FOUNDER_EMAIL = (process.env.FOUNDER_EMAIL ?? "jjclaudegpt@gmail.com").toLowerCase().replace(/'/g, "");
const db = buildSeed();
const now = new Date().toISOString();
const j = (v: unknown) => `$json$${JSON.stringify(v)}$json$::jsonb`;
const out: string[] = [];
const load = (table: string, rows: unknown[], cols: string[], conflict: string, update = true) => {
  if (!rows.length) return;
  const keys = conflict.split(",").map((x) => x.trim());
  const set = cols.filter((c) => !keys.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ");
  out.push(
    `insert into ${table} (${cols.join(", ")}) select ${cols.join(", ")} from jsonb_populate_recordset(null::${table}, ${j(rows)})` +
      ` on conflict (${conflict}) do ${update && set ? `update set ${set}` : "nothing"};`,
  );
};

load("communities", db.communities, ["id", "slug", "name", "state", "since_year", "position", "active"], "id");

const settings = db.settings as unknown as Record<string, unknown>;
const PUBLIC = new Set(["contact_email", "social", "team", "consent_text"]);
load("app_settings", Object.entries(settings).map(([key, value]) => ({ key, value, is_public: PUBLIC.has(key) })), ["key", "value", "is_public"], "key", false);

load("courses", db.courses.map((c) => ({ ...c, created_by: null, published_at: now })), ["id", "slug", "title", "description", "status", "position", "created_by", "published_at"], "id");
load("modules", db.modules, ["id", "course_id", "slug", "title", "position", "status"], "id");
// Pairs point at other lessons: insert without them first, then link.
load(
  "lessons",
  db.lessons.map((l) => ({ ...l, pair_lesson_id: null, created_by: null, published_at: now })),
  ["id", "module_id", "slug", "title", "summary", "content_md", "language", "visibility", "position", "estimated_minutes", "xp_reward", "status", "created_by", "published_at"],
  "id",
);
for (const l of db.lessons) if (l.pair_lesson_id) out.push(`update lessons set pair_lesson_id = '${l.pair_lesson_id}' where id = '${l.id}';`);

load(
  "exercises",
  db.exercises.map(({ tests: _t, hints: _h, solution: _s, ...e }) => e),
  ["id", "lesson_id", "slug", "position", "type", "title", "instructions_md", "starter_code", "config", "xp_reward", "required", "timeout_ms"],
  "id",
);
const ids = db.exercises.map((e) => `'${e.id}'`).join(",");
out.push(`delete from exercise_tests where exercise_id in (${ids});`, `delete from exercise_hints where exercise_id in (${ids});`);
load(
  "exercise_tests",
  db.exercises.flatMap((e) => e.tests.map((t, i) => ({ id: t.id, exercise_id: e.id, position: i + 1, kind: t.kind, description: t.description, spec: t.spec, hidden: t.hidden }))),
  ["id", "exercise_id", "position", "kind", "description", "spec", "hidden"],
  "id",
);
load("exercise_hints", db.exercises.flatMap((e) => e.hints.map((h, i) => ({ exercise_id: e.id, position: i + 1, content_md: h }))), ["exercise_id", "position", "content_md"], "id", false);
load(
  "exercise_solutions",
  db.exercises.map((e) => ({ exercise_id: e.id, ...e.solution })),
  ["exercise_id", "solution_code", "answer", "explanation_md", "known_wrong_solutions", "validated_at", "validated_fingerprint"],
  "exercise_id",
);
load("slide_decks", db.decks.map((d) => ({ ...d, created_by: null })), ["id", "lesson_id", "title", "slides", "status"], "id");
load("error_translations", db.error_translations, ["id", "language", "error_type", "pattern", "message_es", "explanation_es", "suggestion_es", "priority", "enabled"], "id");
load(
  "accomplishments",
  db.accomplishments.map((a) => ({ ...a, nominated_by: null })),
  ["id", "kind", "title", "blurb", "tags", "language", "code", "display_name", "community_id", "year", "status", "featured", "is_sample", "nominated_at", "reviewed_at", "published_at"],
  "id",
);

out.push(`insert into staff_invites (email, role) values ('${FOUNDER_EMAIL}', 'founder') on conflict (email) do update set role = 'founder';`);
// The Next.js server proves itself to student_sign_in with this shared secret.
out.push(`update private.secrets set value = :'gate' where key = 'student_gate';`);
console.log(out.join("\n"));
