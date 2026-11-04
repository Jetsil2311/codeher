-- Recreo: short game breaks earned by learning.
-- Every 2 completed lessons earn 1 ticket (at most 2 saved). A ticket opens a 5-minute
-- break with one of the STEM games; each game keeps a personal best. Educators can turn
-- breaks off per group. Students never touch these tables: everything goes through the
-- token-authenticated functions below, like the rest of the student API.

alter table groups add column recreo_enabled boolean not null default true;

create table student_recreo (
  student_id       uuid primary key references students(id) on delete cascade,
  tickets          integer not null default 0 check (tickets between 0 and 2),
  lessons_credited integer not null default 0 check (lessons_credited >= 0),
  updated_at       timestamptz not null default now()
);

create table recreo_sessions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  game       text not null check (game in ('robotina', 'interruptores', 'nonogramas', 'torres', 'flujo')),
  started_at timestamptz not null default now(),
  ends_at    timestamptz not null,
  score      integer not null default 0 check (score >= 0)
);
create index recreo_sessions_student on recreo_sessions (student_id, ends_at desc);

create table game_scores (
  student_id uuid not null references students(id) on delete cascade,
  game       text not null,
  best       integer not null default 0,
  plays      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, game)
);

alter table student_recreo enable row level security;
alter table recreo_sessions enable row level security;
alter table game_scores enable row level security;
create policy student_recreo_staff on student_recreo for select to authenticated using (educator_can_see_student(student_id));
create policy recreo_sessions_staff on recreo_sessions for select to authenticated using (educator_can_see_student(student_id));
create policy game_scores_staff on game_scores for select to authenticated using (educator_can_see_student(student_id));

-- Credits new lessons into tickets. Tickets above the cap are not kept (max 2 saved).
create function private.recreo_sync(p_student uuid) returns student_recreo
language plpgsql security definer set search_path = public as $$
declare
  r student_recreo;
  v_done int;
  v_new int;
begin
  insert into student_recreo (student_id) values (p_student) on conflict (student_id) do nothing;
  select * into r from student_recreo where student_id = p_student for update;
  select count(*) into v_done from lesson_progress where student_id = p_student and status = 'completed';
  v_new := greatest(0, (v_done - r.lessons_credited) / 2);
  if v_new > 0 then
    update student_recreo set tickets = least(2, tickets + v_new), lessons_credited = lessons_credited + v_new * 2, updated_at = now()
    where student_id = p_student returning * into r;
  end if;
  return r;
end $$;

create function student_recreo(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  r student_recreo := private.recreo_sync(s.id);
  v_done int;
  a recreo_sessions;
begin
  select count(*) into v_done from lesson_progress where student_id = s.id and status = 'completed';
  select * into a from recreo_sessions where student_id = s.id and ends_at > now() order by ends_at desc limit 1;
  return jsonb_build_object(
    'enabled', (select recreo_enabled from groups where id = s.group_id),
    'tickets', r.tickets, 'max_tickets', 2, 'lessons_per_ticket', 2, 'minutes', 5,
    'toward_next', least(1, greatest(0, v_done - r.lessons_credited)),
    'active', case when a.id is null then null else jsonb_build_object('game', a.game, 'ends_at', a.ends_at, 'score', a.score) end,
    'best', coalesce((select jsonb_object_agg(game, best) from game_scores where student_id = s.id), '{}'::jsonb)
  );
end $$;

create function student_recreo_start(p_token text, p_game text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  r student_recreo := private.recreo_sync(s.id);
  a recreo_sessions;
begin
  if not (select recreo_enabled from groups where id = s.group_id) then raise exception 'recreo_disabled'; end if;
  if p_game not in ('robotina', 'interruptores', 'nonogramas', 'torres', 'flujo') then raise exception 'invalid_game'; end if;
  -- A break in progress continues (switching games inside it costs nothing).
  select * into a from recreo_sessions where student_id = s.id and ends_at > now() order by ends_at desc limit 1;
  if a.id is not null then
    if a.game <> p_game then update recreo_sessions set game = p_game where id = a.id returning * into a; end if;
    return jsonb_build_object('game', a.game, 'ends_at', a.ends_at, 'score', a.score, 'new', false);
  end if;
  if r.tickets < 1 then raise exception 'no_tickets'; end if;
  update student_recreo set tickets = tickets - 1, updated_at = now() where student_id = s.id;
  insert into recreo_sessions (student_id, game, ends_at) values (s.id, p_game, now() + interval '5 minutes') returning * into a;
  insert into access_log (actor_kind, actor_id, action, entity_type, entity_id, payload)
  values ('student', s.id, 'recreo_started', 'student', s.id, jsonb_build_object('game', p_game));
  return jsonb_build_object('game', a.game, 'ends_at', a.ends_at, 'score', 0, 'new', true);
end $$;

create function student_recreo_score(p_token text, p_game text, p_score integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  a recreo_sessions;
  v_best int;
begin
  -- Scores only count during a break (with a short grace period for the final submit).
  select * into a from recreo_sessions where student_id = s.id and game = p_game and ends_at > now() - interval '1 minute'
  order by ends_at desc limit 1;
  if a.id is null then raise exception 'no_active_recreo'; end if;
  update recreo_sessions set score = greatest(score, least(coalesce(p_score, 0), 1000)) where id = a.id;
  insert into game_scores (student_id, game, best, plays) values (s.id, p_game, least(greatest(coalesce(p_score, 0), 0), 1000), 1)
  on conflict (student_id, game) do update set best = greatest(game_scores.best, excluded.best), updated_at = now()
  returning best into v_best;
  return jsonb_build_object('best', v_best);
end $$;

create function staff_set_group_recreo(p_group uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_group(p_group);
  update groups set recreo_enabled = p_enabled where id = p_group;
  perform private.log_access('recreo_toggled', 'group', p_group, jsonb_build_object('enabled', p_enabled));
end $$;

-- Group summaries carry the recreo switch.
create or replace function private.group_json(g groups) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id, 'prefix', private.group_prefix(g.year, g.month, g.letter), 'year', g.year, 'month', g.month,
    'letter', g.letter, 'label', g.label, 'status', g.status, 'ends_on', g.ends_on, 'created_at', g.created_at,
    'community', coalesce((select c.name from communities c where c.id = g.community_id), ''),
    'community_id', g.community_id, 'recreo_enabled', g.recreo_enabled,
    'students', (select count(*) from students s where s.group_id = g.id),
    'active_students', (select count(*) from students s where s.group_id = g.id and s.status = 'active'),
    'lessons_total', (select count(*) from course_lesson_order o join group_courses gc on gc.course_id = o.course_id where gc.group_id = g.id),
    'avg_completed', coalesce((select round(avg(x.n), 1) from (
        select count(lp.lesson_id) filter (where lp.status = 'completed') as n
        from students s left join lesson_progress lp on lp.student_id = s.id where s.group_id = g.id group by s.id) x), 0),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name))
                           from educator_groups eg join profiles p on p.id = eg.educator_id where eg.group_id = g.id), '[]'::jsonb)
  );
$$;

revoke all on function private.recreo_sync(uuid) from public, anon, authenticated;
revoke all on function student_recreo(text), student_recreo_start(text, text), student_recreo_score(text, text, integer) from public;
grant execute on function student_recreo(text), student_recreo_start(text, text), student_recreo_score(text, text, integer) to anon, authenticated;
revoke all on function staff_set_group_recreo(uuid, boolean) from public, anon;
grant execute on function staff_set_group_recreo(uuid, boolean) to authenticated;
