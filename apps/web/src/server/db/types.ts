// Row types mirroring supabase/migrations (0001_schema.sql). The local adapter stores
// them in a JSON file; the Supabase adapter will read the same shapes from Postgres.
import type { CodeLanguage, TestKind } from "@codeher/core";

export type Role = "pending" | "educator" | "founder";
export type ContentStatus = "draft" | "review" | "published" | "archived";
export type Visibility = "public" | "program" | "draft";
export type ExerciseType = "code" | "multiple_choice" | "short_answer";
export type ProgressStatus = "not_started" | "in_progress" | "completed";
export type AccomplishmentStatus = "nominated" | "approved" | "published" | "unpublished" | "rejected";
export type AccomplishmentKind = "project" | "first_program" | "first_website" | "community_presentation" | "milestone";

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  active: boolean;
  password_hash: string; // local mode only (Supabase Auth owns passwords)
  created_at: string;
}
export interface StaffInvite { email: string; role: "educator" | "founder"; invited_by: string | null; created_at: string; accepted_at: string | null }
export interface Community { id: string; slug: string; name: string; state: string; since_year: number | null; position: number; active: boolean }
export interface Group {
  id: string; year: number; month: number; letter: string | null; community_id: string; label: string;
  status: "active" | "closed"; ends_on: string | null; next_number: number; created_by: string | null; created_at: string; closed_at: string | null;
  recreo_enabled?: boolean;
}
export interface EducatorGroup { educator_id: string; group_id: string; assigned_at: string }
export interface Student {
  id: string; group_id: string; number: number; code: string; nickname: string; avatar: string; status: "active" | "inactive";
  pin_hash: string; failed_attempts: number; locked_until: string | null; hard_locked: boolean;
  guardian_consent: boolean; consent_reference: string | null; consent_recorded_at: string | null;
  last_active_at: string | null; created_at: string;
}
export interface StudentNote { id: string; student_id: string; author_id: string; body: string; created_at: string }
export interface Session { id: string; kind: "student" | "staff"; subject_id: string; token_hash: string; created_at: string; expires_at: string; revoked_at: string | null }
export interface LoginAttempt { code_norm: string; ip: string | null; success: boolean; created_at: string }

export interface Course { id: string; slug: string; title: string; description: string; status: ContentStatus; position: number; created_by: string | null }
export interface Module { id: string; course_id: string; slug: string; title: string; position: number; status: ContentStatus }
export interface TestRow { id: string; kind: TestKind; description: string; spec: Record<string, unknown>; hidden: boolean }
export interface Exercise {
  id: string; lesson_id: string; slug: string; position: number; type: ExerciseType; title: string; instructions_md: string;
  starter_code: string; config: Record<string, unknown>; xp_reward: number; required: boolean; timeout_ms: number; version: number;
  tests: TestRow[]; hints: string[];
  solution: { solution_code: string; answer: unknown; explanation_md: string; known_wrong_solutions: string[]; validated_at: string | null; validated_fingerprint: string | null };
}
export interface Lesson {
  id: string; module_id: string | null; slug: string; title: string; summary: string; content_md: string; language: CodeLanguage;
  visibility: Visibility; pair_lesson_id: string | null; position: number; estimated_minutes: number; xp_reward: number;
  status: ContentStatus; version: number; created_by: string | null; updated_at: string;
}
export interface SlideDeck { id: string; lesson_id: string; title: string; slides: unknown; status: ContentStatus; version: number }
export interface GroupCourse { group_id: string; course_id: string; position: number }

export interface LessonProgress { student_id: string; lesson_id: string; status: ProgressStatus; started_at: string; completed_at: string | null; updated_at: string }
export interface Attempt { id: string; student_id: string; exercise_id: string; submission: string; passed: boolean; test_results: unknown; error_type: string | null; runtime_ms: number | null; created_at: string }
export interface ExerciseProgress { student_id: string; exercise_id: string; passed: boolean; attempts: number; hints_used: number; first_passed_at: string | null; best_submission: string | null; updated_at: string }
export interface XpEvent { student_id: string; source_type: "exercise" | "lesson"; source_id: string; amount: number; created_at: string }
export interface Streak { student_id: string; current_streak: number; longest_streak: number; last_activity_date: string | null }

export interface Project { id: string; student_id: string; name: string; language: CodeLanguage; code: string; source_lesson_id: string | null; created_at: string; updated_at: string }
export interface ProjectVersion { id: number; project_id: string; code: string; created_at: string }
export interface Accomplishment {
  id: string; student_id: string | null; project_id: string | null; kind: AccomplishmentKind; title: string; blurb: string; tags: string[];
  language: CodeLanguage | null; code: string | null; display_name: string; community_id: string | null; year: number | null;
  status: AccomplishmentStatus; featured: boolean; is_sample: boolean; nominated_by_student: boolean; nominated_by: string | null;
  nominated_at: string; reviewed_at: string | null; published_at: string | null;
}
export interface ErrorTranslation { id: string; language: CodeLanguage | null; error_type: string; pattern: string | null; message_es: string; explanation_es: string; suggestion_es: string; priority: number; enabled: boolean }
export interface ApiKey { id: string; owner_id: string; name: string; key_prefix: string; key_hash: string; created_at: string; last_used_at: string | null; expires_at: string; revoked_at: string | null }
export interface AccessLog { id: number; actor_kind: "staff" | "student" | "system" | "mcp"; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; payload: Record<string, unknown>; created_at: string }

export const GAMES = ["robotina", "interruptores", "nonogramas", "torres", "flujo"] as const;
export type GameId = (typeof GAMES)[number];
export interface StudentRecreo { student_id: string; tickets: number; lessons_credited: number }
export interface RecreoSession { id: string; student_id: string; game: GameId; started_at: string; ends_at: string; score: number }
export interface GameScore { student_id: string; game: GameId; best: number; plays: number }

export interface Settings {
  session_hours: number;
  lockout: { soft_after: number; soft_minutes: number; hard_after: number };
  group_letter_rule: { first_without_letter: boolean };
  consent_text: string;
  contact_email: string;
  social: { label: string; url: string }[];
  team: { name: string; role: string; bio: string }[];
}

export interface Db {
  version: number;
  profiles: Profile[];
  invites: StaffInvite[];
  communities: Community[];
  settings: Settings;
  groups: Group[];
  educator_groups: EducatorGroup[];
  students: Student[];
  notes: StudentNote[];
  sessions: Session[];
  login_attempts: LoginAttempt[];
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  exercises: Exercise[];
  decks: SlideDeck[];
  group_courses: GroupCourse[];
  lesson_progress: LessonProgress[];
  attempts: Attempt[];
  exercise_progress: ExerciseProgress[];
  xp_events: XpEvent[];
  streaks: Streak[];
  projects: Project[];
  project_versions: ProjectVersion[];
  accomplishments: Accomplishment[];
  error_translations: ErrorTranslation[];
  api_keys: ApiKey[];
  access_log: AccessLog[];
  content_audit_log: AccessLog[];
  recreo?: StudentRecreo[];
  recreo_sessions?: RecreoSession[];
  game_scores?: GameScore[];
  seq: number;
}
