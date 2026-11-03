-- CODEHER schema v1.1 (tech spec section 5, adapted by the design brief section 8).
-- Students are NOT Supabase Auth users: they live in `students` and sign in with code + PIN.
-- Staff (educators and founders) are Auth users with a row in `profiles`.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- Enums ----------
create type app_role as enum ('pending', 'educator', 'founder');
create type content_status as enum ('draft', 'review', 'published', 'archived');
create type lesson_visibility as enum ('public', 'program', 'draft');
create type exercise_type as enum ('code', 'multiple_choice', 'short_answer');
create type test_kind as enum ('stdout', 'function_call', 'assert_code', 'construct_rule', 'final_variable');
create type progress_status as enum ('not_started', 'in_progress', 'completed');
create type code_language as enum ('python', 'pseudocode_es');
create type student_status as enum ('active', 'inactive');
create type group_status as enum ('active', 'closed');
create type accomplishment_status as enum ('nominated', 'approved', 'published', 'unpublished', 'rejected');
create type accomplishment_kind as enum ('project', 'first_program', 'first_website', 'community_presentation', 'milestone');

-- ---------- Generic triggers ----------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create function touch_content() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end $$;

-- ---------- Private secrets (not exposed through the API) ----------
create table private.secrets (
  key   text primary key,
  value text not null
);
insert into private.secrets (key, value)
values ('student_gate', encode(extensions.gen_random_bytes(32), 'hex'));

-- ---------- Staff identity ----------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email        text,
  role         app_role not null default 'pending',
  active       boolean not null default true,
  locale       text not null default 'es-MX',
  timezone     text not null default 'America/Mexico_City',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table staff_invites (
  email       text primary key check (email = lower(email)),
  role        app_role not null default 'educator' check (role in ('educator', 'founder')),
  invited_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

-- ---------- Program structure ----------
create table communities (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  state      text not null default 'Estado de México',
  since_year integer check (since_year between 2000 and 2099),
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table app_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

create table groups (
  id           uuid primary key default gen_random_uuid(),
  year         integer not null check (year between 2000 and 2099),
  month        integer not null check (month between 1 and 12),
  letter       text check (letter ~ '^[A-Z]$'),
  community_id uuid not null references communities(id),
  label        text not null default '',
  status       group_status not null default 'active',
  ends_on      date,
  next_number  integer not null default 1,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create unique index groups_unique_prefix on groups (year, month, coalesce(letter, ''));

create table educator_groups (
  educator_id uuid not null references profiles(id) on delete cascade,
  group_id    uuid not null references groups(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (educator_id, group_id)
);
create index educator_groups_group on educator_groups (group_id);

create table students (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references groups(id) on delete restrict,
  number              integer not null check (number > 0),
  code                text not null unique check (code = upper(code)),
  nickname            text not null check (char_length(nickname) between 1 and 40),
  avatar              text not null default 'orbita',
  status              student_status not null default 'active',
  pin_hash            text not null,
  failed_attempts     integer not null default 0,
  locked_until        timestamptz,
  hard_locked         boolean not null default false,
  guardian_consent    boolean not null default false,
  consent_reference   text,
  consent_recorded_at timestamptz,
  consent_recorded_by uuid references profiles(id) on delete set null,
  last_active_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (group_id, number)
);
create index students_group on students (group_id);

create table student_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table student_sessions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip         text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index student_sessions_student on student_sessions (student_id);

create table login_attempts (
  id         bigint generated always as identity primary key,
  code_norm  text not null,
  ip         text,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_code on login_attempts (code_norm, created_at desc);
create index login_attempts_ip on login_attempts (ip, created_at desc);

-- ---------- Content ----------
create table courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text not null default '',
  status       content_status not null default 'draft',
  position     integer not null default 0,
  version      integer not null default 1,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create table modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  slug        text not null,
  title       text not null,
  description text not null default '',
  position    integer not null,
  status      content_status not null default 'draft',
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, slug),
  unique (course_id, position) deferrable initially deferred
);

create table lessons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid references modules(id) on delete cascade,
  slug              text not null,
  title             text not null,
  summary           text not null default '',
  content_md        text not null default '',
  language          code_language not null default 'python',
  visibility        lesson_visibility not null default 'draft',
  pair_lesson_id    uuid references lessons(id) on delete set null,
  position          integer not null default 0,
  estimated_minutes integer not null default 15 check (estimated_minutes > 0),
  xp_reward         integer not null default 20 check (xp_reward >= 0),
  status            content_status not null default 'draft',
  version           integer not null default 1,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz,
  -- Routes use the slug alone (/app/leccion/<slug>, /probar/<slug>), so it is unique platform-wide.
  unique (slug),
  unique (module_id, position) deferrable initially deferred,
  check (pair_lesson_id is distinct from id),
  -- Public lessons belong to no course; program lessons always live in a module.
  check (module_id is not null or visibility <> 'program')
);

create table exercises (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references lessons(id) on delete cascade,
  slug            text not null,
  position        integer not null,
  type            exercise_type not null default 'code',
  title           text not null,
  instructions_md text not null default '',
  starter_code    text not null default '',
  config          jsonb not null default '{}'::jsonb,
  xp_reward       integer not null default 10 check (xp_reward >= 0),
  required        boolean not null default true,
  timeout_ms      integer not null default 5000 check (timeout_ms between 500 and 30000),
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lesson_id, slug),
  unique (lesson_id, position) deferrable initially deferred
);

-- Readable where the lesson is readable (the browser grades). "hidden" only hides
-- details in feedback; it is NOT a security boundary.
create table exercise_tests (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  position    integer not null,
  kind        test_kind not null,
  description text not null,
  spec        jsonb not null,
  hidden      boolean not null default false,
  unique (exercise_id, position) deferrable initially deferred
);

create table exercise_hints (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  position    integer not null,
  content_md  text not null,
  unique (exercise_id, position) deferrable initially deferred
);

create table exercise_solutions (
  exercise_id           uuid primary key references exercises(id) on delete cascade,
  solution_code         text not null default '',
  answer                jsonb,
  explanation_md        text not null default '',
  known_wrong_solutions jsonb not null default '[]'::jsonb,
  validated_at          timestamptz,
  validated_fingerprint text
);

create table slide_decks (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid references lessons(id) on delete cascade,
  module_id      uuid references modules(id) on delete cascade,
  title          text not null,
  slides         jsonb not null default '[]'::jsonb,
  schema_version integer not null default 1,
  status         content_status not null default 'draft',
  version        integer not null default 1,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((lesson_id is not null)::int + (module_id is not null)::int = 1)
);
create unique index slide_decks_one_per_lesson on slide_decks (lesson_id) where lesson_id is not null;
create unique index slide_decks_one_per_module on slide_decks (module_id) where module_id is not null;

-- Courses assigned to a group ("program" lessons are readable through these).
create table group_courses (
  group_id    uuid not null references groups(id) on delete cascade,
  course_id   uuid not null references courses(id) on delete cascade,
  position    integer not null default 0,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (group_id, course_id)
);

-- ---------- Progress (written only through SECURITY DEFINER functions) ----------
create table lesson_progress (
  student_id   uuid not null references students(id) on delete cascade,
  lesson_id    uuid not null references lessons(id) on delete cascade,
  status       progress_status not null default 'in_progress',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table exercise_attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  submission   text not null default '' check (char_length(submission) <= 20000),
  passed       boolean not null,
  test_results jsonb not null default '[]'::jsonb,
  error_type   text,
  runtime_ms   integer,
  created_at   timestamptz not null default now()
);
create index exercise_attempts_lookup on exercise_attempts (student_id, exercise_id, created_at desc);
create index exercise_attempts_by_exercise on exercise_attempts (exercise_id);
create index exercise_attempts_recent on exercise_attempts (created_at desc);

create table exercise_progress (
  student_id      uuid not null references students(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete cascade,
  passed          boolean not null default false,
  attempts        integer not null default 0,
  hints_used      integer not null default 0,
  first_passed_at timestamptz,
  best_submission text,
  updated_at      timestamptz not null default now(),
  primary key (student_id, exercise_id)
);

create table xp_events (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  source_type text not null check (source_type in ('exercise', 'lesson')),
  source_id   uuid not null,
  amount      integer not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  unique (student_id, source_type, source_id)
);
create index xp_events_student on xp_events (student_id);

create table student_streaks (
  student_id         uuid primary key references students(id) on delete cascade,
  current_streak     integer not null default 0,
  longest_streak     integer not null default 0,
  last_activity_date date
);

-- ---------- Projects ----------
create table projects (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  language         code_language not null,
  code             text not null default '' check (char_length(code) <= 20000),
  source_lesson_id uuid references lessons(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index projects_student on projects (student_id, updated_at desc);

create table project_versions (
  id         bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  code       text not null,
  created_at timestamptz not null default now()
);
create index project_versions_project on project_versions (project_id, created_at desc);

-- Keep only the last 10 versions per project.
create function trim_project_versions() returns trigger
language plpgsql as $$
begin
  delete from project_versions
  where project_id = new.project_id
    and id not in (select id from project_versions where project_id = new.project_id order by created_at desc, id desc limit 10);
  return new;
end $$;
create trigger trg_project_versions_trim after insert on project_versions
  for each row execute function trim_project_versions();

-- ---------- Logros ----------
create table accomplishments (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid references students(id) on delete cascade,
  project_id           uuid references projects(id) on delete set null,
  kind                 accomplishment_kind not null default 'project',
  title                text not null check (char_length(title) between 1 and 120),
  blurb                text not null default '' check (char_length(blurb) <= 600),
  tags                 text[] not null default '{}',
  language             code_language,
  code                 text,
  display_name         text not null default '',
  community_id         uuid references communities(id) on delete set null,
  year                 integer,
  status               accomplishment_status not null default 'nominated',
  featured             boolean not null default false,
  is_sample            boolean not null default false,
  nominated_by_student boolean not null default false,
  nominated_by         uuid references profiles(id) on delete set null,
  nominated_at         timestamptz not null default now(),
  reviewed_by          uuid references profiles(id) on delete set null,
  reviewed_at          timestamptz,
  published_at         timestamptz,
  created_at           timestamptz not null default now()
);
create index accomplishments_status on accomplishments (status, published_at desc);

-- ---------- Operational ----------
create table error_translations (
  id             uuid primary key default gen_random_uuid(),
  language       code_language,
  error_type     text not null,
  pattern        text,
  message_es     text not null,
  explanation_es text not null default '',
  suggestion_es  text not null default '',
  priority       integer not null default 100,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null unique,
  scopes       text[] not null default array['content:write'],
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table content_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_kind  text not null check (actor_kind in ('user', 'mcp', 'system')),
  api_key_id  uuid,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index content_audit_entity on content_audit_log (entity_type, entity_id);

-- Access events: PIN resets, activations, unlocks, role changes, publications, founder views.
create table access_log (
  id          bigint generated always as identity primary key,
  actor_kind  text not null check (actor_kind in ('staff', 'student', 'system')),
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index access_log_created on access_log (created_at desc);

-- ---------- Triggers ----------
create trigger trg_courses_touch before update on courses for each row execute function touch_content();
create trigger trg_modules_touch before update on modules for each row execute function touch_content();
create trigger trg_lessons_touch before update on lessons for each row execute function touch_content();
create trigger trg_exercises_touch before update on exercises for each row execute function touch_content();
create trigger trg_slide_decks_touch before update on slide_decks for each row execute function touch_content();
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_students_updated before update on students for each row execute function set_updated_at();
create trigger trg_lprog_updated before update on lesson_progress for each row execute function set_updated_at();
create trigger trg_eprog_updated before update on exercise_progress for each row execute function set_updated_at();
create trigger trg_errtr_updated before update on error_translations for each row execute function set_updated_at();
create trigger trg_projects_updated before update on projects for each row execute function set_updated_at();

-- ---------- Indexes on foreign keys ----------
create index modules_course on modules (course_id);
create index lessons_module on lessons (module_id);
create index exercises_lesson on exercises (lesson_id);
create index exercise_tests_exercise on exercise_tests (exercise_id);
create index exercise_hints_exercise on exercise_hints (exercise_id);
create index group_courses_course on group_courses (course_id);
create index lesson_progress_lesson on lesson_progress (lesson_id);
create index exercise_progress_exercise on exercise_progress (exercise_id);
create index student_notes_student on student_notes (student_id);
create index groups_community on groups (community_id);
