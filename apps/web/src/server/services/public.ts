import "server-only";
import { read } from "../db/store";
import type { Accomplishment, Db } from "../db/types";
import { AppError } from "../errors";
import { gradeAnswer, lessonPayload } from "../learning";

export function landing() {
  return read((db) => ({
    communities: db.communities
      .filter((c) => c.active)
      .sort((a, b) => a.position - b.position)
      .map((c) => {
        const groups = db.groups.filter((g) => g.community_id === c.id);
        return {
          name: c.name,
          state: c.state,
          since_year: c.since_year,
          groups: groups.length,
          students: db.students.filter((s) => groups.some((g) => g.id === s.group_id)).length,
          years: Array.from(new Set(groups.map((g) => g.year))).sort(),
        };
      }),
    totals: {
      groups: db.groups.length,
      students: db.students.length,
      communities: db.communities.filter((c) => c.active).length,
      lessons_completed: db.lesson_progress.filter((p) => p.status === "completed").length,
    },
    featured: publishedLogros(db).slice(0, 3).map((a) => logroCard(db, a)),
    team: db.settings.team,
    contact_email: db.settings.contact_email,
    social: db.settings.social,
  }));
}

function publishedLogros(db: Db) {
  return db.accomplishments
    .filter((a) => a.status === "published")
    .sort((a, b) => Number(b.featured) - Number(a.featured) || Number(a.is_sample) - Number(b.is_sample) || (b.published_at ?? "").localeCompare(a.published_at ?? ""));
}

function logroCard(db: Db, a: Accomplishment) {
  return {
    id: a.id,
    title: a.title,
    blurb: a.blurb,
    kind: a.kind,
    tags: a.tags,
    language: a.language,
    display_name: a.display_name,
    year: a.year,
    featured: a.featured,
    is_sample: a.is_sample,
    has_code: !!a.code,
    preview: a.code ? a.code.split("\n").slice(0, 10).join("\n") : null,
    community: db.communities.find((c) => c.id === a.community_id)?.name ?? null,
  };
}
export type LogroCard = ReturnType<typeof logroCard>;

export function logros() {
  return read((db) => publishedLogros(db).map((a) => logroCard(db, a)));
}

export function logro(id: string) {
  return read((db) => {
    const a = db.accomplishments.find((x) => x.id === id && x.status === "published");
    return a ? { ...logroCard(db, a), code: a.code } : null;
  });
}

export function publicLessons() {
  return read((db) =>
    db.lessons
      .filter((l) => l.status === "published" && l.visibility === "public")
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ id: l.id, slug: l.slug, title: l.title, summary: l.summary, language: l.language, minutes: l.estimated_minutes, exercises: db.exercises.filter((e) => e.lesson_id === l.id).length })),
  );
}

export function publicLesson(slug: string) {
  return read((db) => {
    const l = db.lessons.find((x) => x.slug === slug && x.status === "published" && x.visibility === "public");
    return l ? lessonPayload(db, l, null) : null;
  });
}

/** Visitors can check multiple-choice answers; nothing is stored. */
export function checkPublicAnswer(exerciseId: string, answer: { choices?: number[]; text?: string }) {
  return read((db) => {
    const ex = db.exercises.find((e) => e.id === exerciseId);
    const l = ex && db.lessons.find((x) => x.id === ex.lesson_id);
    if (!ex || !l || l.visibility !== "public" || l.status !== "published" || ex.type === "code") throw new AppError("wrong_exercise_type");
    const passed = gradeAnswer(ex, answer);
    return { passed, explanation_md: passed ? ex.solution.explanation_md : null };
  });
}

export function errorCatalog() {
  return read((db) => db.error_translations.filter((e) => e.enabled));
}

export function consentText() {
  return read((db) => db.settings.consent_text);
}
