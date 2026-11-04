-- Recreo libre: staff can give a student (typically one who finished every lesson)
-- 30 minutes of games without tickets, and end it at any moment.

alter table student_recreo add column free_until timestamptz, add column free_by uuid references profiles(id) on delete set null;
alter table recreo_sessions add column free boolean not null default false;

-- Student status now includes the free window and the running session's start.
create or replace function student_recreo(p_token text) returns jsonb
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
    'free_until', case when r.free_until > now() then r.free_until end,
    'active', case when a.id is null then null else jsonb_build_object('game', a.game, 'ends_at', a.ends_at, 'started_at', a.started_at, 'score', a.score, 'free', a.free) end,
    'best', coalesce((select jsonb_object_agg(game, best) from game_scores where student_id = s.id), '{}'::jsonb)
  );
end $$;

create or replace function student_recreo_start(p_token text, p_game text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  r student_recreo := private.recreo_sync(s.id);
  a recreo_sessions;
  v_free boolean := r.free_until is not null and r.free_until > now();
begin
  if p_game not in ('robotina', 'interruptores', 'nonogramas', 'torres', 'flujo') then raise exception 'invalid_game'; end if;
  -- A staff-granted free window works even when the group has ticket breaks paused.
  if not v_free and not (select recreo_enabled from groups where id = s.group_id) then raise exception 'recreo_disabled'; end if;
  select * into a from recreo_sessions where student_id = s.id and ends_at > now() order by ends_at desc limit 1;
  if a.id is not null then
    -- Inside a free window the running session lasts until the window ends.
    if v_free and a.ends_at < r.free_until then update recreo_sessions set ends_at = r.free_until, free = true where id = a.id returning * into a; end if;
    if a.game <> p_game then update recreo_sessions set game = p_game where id = a.id returning * into a; end if;
    return jsonb_build_object('game', a.game, 'ends_at', a.ends_at, 'score', a.score, 'new', false);
  end if;
  if v_free then
    insert into recreo_sessions (student_id, game, ends_at, free) values (s.id, p_game, r.free_until, true) returning * into a;
  else
    if r.tickets < 1 then raise exception 'no_tickets'; end if;
    update student_recreo set tickets = tickets - 1, updated_at = now() where student_id = s.id;
    insert into recreo_sessions (student_id, game, ends_at) values (s.id, p_game, now() + interval '5 minutes') returning * into a;
  end if;
  insert into access_log (actor_kind, actor_id, action, entity_type, entity_id, payload)
  values ('student', s.id, 'recreo_started', 'student', s.id, jsonb_build_object('game', p_game, 'free', v_free));
  return jsonb_build_object('game', a.game, 'ends_at', a.ends_at, 'score', 0, 'new', true);
end $$;

-- Grant (p_minutes > 0) or end (p_minutes = 0) free play for several students at once.
create function staff_recreo_free(p_students uuid[], p_minutes integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  n int := 0;
  v_until timestamptz := case when coalesce(p_minutes, 0) > 0 then now() + make_interval(mins => least(p_minutes, 120)) end;
begin
  perform private.require_staff();
  foreach v_id in array coalesce(p_students, '{}') loop
    perform private.require_student(v_id);
    perform private.recreo_sync(v_id);
    update student_recreo set free_until = v_until, free_by = auth.uid(), updated_at = now() where student_id = v_id;
    if v_until is null then
      update recreo_sessions set ends_at = now() where student_id = v_id and free and ends_at > now();
    end if;
    n := n + 1;
  end loop;
  perform private.log_access(case when v_until is null then 'recreo_free_stopped' else 'recreo_free_granted' end, 'student', null,
                             jsonb_build_object('students', n, 'minutes', coalesce(p_minutes, 0)));
  return n;
end $$;

-- Recreo state per student of a group, for the staff panels.
create function staff_group_recreo(p_group uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
begin
  perform private.require_group(p_group);
  select count(*) into v_total from course_lesson_order o join group_courses gc on gc.course_id = o.course_id where gc.group_id = p_group;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'code', s.code, 'nickname', s.nickname,
      'tickets', coalesce(r.tickets, 0),
      'free_until', case when r.free_until > now() then r.free_until end,
      'playing', exists (select 1 from recreo_sessions x where x.student_id = s.id and x.ends_at > now()),
      'lessons_completed', (select count(*) from lesson_progress lp join course_lesson_order o on o.lesson_id = lp.lesson_id
                            join group_courses gc on gc.course_id = o.course_id and gc.group_id = p_group
                            where lp.student_id = s.id and lp.status = 'completed'),
      'lessons_total', v_total
    ) order by s.number)
    from students s left join student_recreo r on r.student_id = s.id
    where s.group_id = p_group and s.status = 'active'), '[]'::jsonb);
end $$;

revoke all on function staff_recreo_free(uuid[], integer), staff_group_recreo(uuid) from public, anon;
grant execute on function staff_recreo_free(uuid[], integer), staff_group_recreo(uuid) to authenticated;
