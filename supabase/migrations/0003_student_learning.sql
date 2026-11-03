-- Student access (code + PIN) and the learning flow (tech spec 5/6, design brief 4/5).
-- Students never touch tables: every call goes through SECURITY DEFINER functions that
-- read a session token issued by student_sign_in (called only by the Next.js server).

-- ---------- Private helpers ----------
create function private.cfg(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from app_settings where key = p_key;
$$;

create function private.today_mx() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

create function private.is_trivial_pin(p text) returns boolean
language plpgsql immutable as $$
declare
  d int[];
  i int;
  up boolean := true;
  down boolean := true;
begin
  if p is null or p !~ '^\d{4}$' then return true; end if;
  d := array[substr(p,1,1)::int, substr(p,2,1)::int, substr(p,3,1)::int, substr(p,4,1)::int];
  if d[1] = d[2] and d[2] = d[3] and d[3] = d[4] then return true; end if;
  for i in 2..4 loop
    if d[i] <> (d[i-1] + 1) % 10 then up := false; end if;
    if d[i] <> (d[i-1] + 9) % 10 then down := false; end if;
  end loop;
  if up or down then return true; end if;
  if substr(p,1,2) = substr(p,3,2) then return true; end if;
  if d[1] = d[2] and d[3] = d[4] then return true; end if;
  if p::int between 1950 and 2035 then return true; end if;
  return false;
end $$;

create function private.random_pin() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  b bytea;
  p text;
begin
  loop
    b := gen_random_bytes(2);
    p := lpad(((get_byte(b, 0) * 256 + get_byte(b, 1)) % 10000)::text, 4, '0');
    exit when not private.is_trivial_pin(p);
  end loop;
  return p;
end $$;

create function private.hash_pin(p text) returns text
language sql volatile set search_path = public, extensions as $$
  select crypt(p, gen_salt('bf', 8));
$$;

create function private.session_student(p_token text) returns students
language plpgsql security definer set search_path = public, extensions as $$
declare
  s students;
  g groups;
begin
  if p_token is null or length(p_token) < 32 then raise exception 'not_authenticated'; end if;
  select st.* into s
  from student_sessions ss join students st on st.id = ss.student_id
  where ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') and ss.revoked_at is null and ss.expires_at > now();
  if not found then raise exception 'not_authenticated'; end if;
  select * into g from groups where id = s.group_id;
  if s.status <> 'active' or g.status <> 'active' or (g.ends_on is not null and g.ends_on < private.today_mx()) then
    raise exception 'not_authenticated';
  end if;
  if s.last_active_at is null or s.last_active_at < now() - interval '5 minutes' then
    update students set last_active_at = now() where id = s.id;
  end if;
  return s;
end $$;

-- ---------- Progression ----------
create function private.student_can_read_lesson(p_student uuid, p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from lessons l
    where l.id = p_lesson and l.status = 'published'
      and (l.visibility = 'public' or exists (
        select 1 from course_lesson_order o
        join students s on s.id = p_student
        join group_courses gc on gc.group_id = s.group_id and gc.course_id = o.course_id
        where o.lesson_id = l.id))
  );
$$;

create function private.is_lesson_unlocked(p_student uuid, p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with cur as (
    select o.course_id, o.seq from course_lesson_order o
    join students s on s.id = p_student
    join group_courses gc on gc.group_id = s.group_id and gc.course_id = o.course_id
    where o.lesson_id = p_lesson
  )
  select coalesce(
    exists (select 1 from lessons l where l.id = p_lesson and l.status = 'published' and l.visibility = 'public')
    or exists (select 1 from cur where seq = 1)
    or exists (
      select 1 from cur
      join course_lesson_order prev on prev.course_id = cur.course_id and prev.seq = cur.seq - 1
      join lesson_progress lp on lp.lesson_id = prev.lesson_id and lp.student_id = p_student and lp.status = 'completed'),
    false);
$$;

create function private.touch_streak(p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_today date := private.today_mx();
  v_last date;
  v_cur integer;
begin
  select last_activity_date, current_streak into v_last, v_cur from student_streaks where student_id = p_student;
  if not found then
    v_cur := 1;
  elsif v_last = v_today then
    return;
  elsif v_last = v_today - 1 then
    v_cur := v_cur + 1;
  else
    v_cur := 1;
  end if;
  insert into student_streaks (student_id, current_streak, longest_streak, last_activity_date)
  values (p_student, v_cur, v_cur, v_today)
  on conflict (student_id) do update
    set current_streak = v_cur,
        longest_streak = greatest(student_streaks.longest_streak, v_cur),
        last_activity_date = v_today;
end $$;

create function private.try_complete_lesson(p_student uuid, p_lesson uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
  from exercises e
  left join exercise_progress ep on ep.exercise_id = e.id and ep.student_id = p_student
  where e.lesson_id = p_lesson and e.required and not coalesce(ep.passed, false);

  if v_remaining > 0 then
    insert into lesson_progress (student_id, lesson_id, status, started_at)
    values (p_student, p_lesson, 'in_progress', now())
    on conflict (student_id, lesson_id) do nothing;
    return false;
  end if;

  insert into lesson_progress (student_id, lesson_id, status, started_at, completed_at)
  values (p_student, p_lesson, 'completed', now(), now())
  on conflict (student_id, lesson_id) do update
    set status = 'completed', completed_at = coalesce(lesson_progress.completed_at, now());

  insert into xp_events (student_id, source_type, source_id, amount)
  select p_student, 'lesson', l.id, l.xp_reward from lessons l where l.id = p_lesson
  on conflict (student_id, source_type, source_id) do nothing;
  return true;
end $$;

create function private.apply_attempt(
  p_student uuid, p_exercise uuid, p_passed boolean, p_submission text,
  p_results jsonb, p_runtime_ms integer, p_hints_used integer, p_error_type text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lesson uuid;
  v_xp integer;
  v_was_passed boolean;
  v_first_pass boolean;
  v_completed boolean;
begin
  select e.lesson_id, e.xp_reward into v_lesson, v_xp from exercises e where e.id = p_exercise;
  if v_lesson is null or not private.student_can_read_lesson(p_student, v_lesson) then
    raise exception 'exercise_not_found';
  end if;
  if not private.is_lesson_unlocked(p_student, v_lesson) then
    raise exception 'lesson_locked';
  end if;
  if (select count(*) from exercise_attempts where student_id = p_student and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited';
  end if;

  select passed into v_was_passed from exercise_progress where student_id = p_student and exercise_id = p_exercise;
  v_first_pass := p_passed and not coalesce(v_was_passed, false);

  insert into exercise_attempts (student_id, exercise_id, submission, passed, test_results, runtime_ms, error_type)
  values (p_student, p_exercise, left(coalesce(p_submission, ''), 20000), p_passed, coalesce(p_results, '[]'::jsonb), p_runtime_ms, left(p_error_type, 80));

  insert into exercise_progress (student_id, exercise_id, passed, attempts, hints_used, first_passed_at, best_submission)
  values (p_student, p_exercise, p_passed, 1, coalesce(p_hints_used, 0),
          case when p_passed then now() end, case when p_passed then left(p_submission, 20000) end)
  on conflict (student_id, exercise_id) do update
    set passed = exercise_progress.passed or excluded.passed,
        attempts = exercise_progress.attempts + 1,
        hints_used = greatest(exercise_progress.hints_used, excluded.hints_used),
        first_passed_at = coalesce(exercise_progress.first_passed_at, excluded.first_passed_at),
        best_submission = case when excluded.passed then excluded.best_submission else exercise_progress.best_submission end;

  if v_first_pass then
    insert into xp_events (student_id, source_type, source_id, amount)
    values (p_student, 'exercise', p_exercise, v_xp)
    on conflict (student_id, source_type, source_id) do nothing;
  end if;

  perform private.touch_streak(p_student);
  v_completed := private.try_complete_lesson(p_student, v_lesson);

  return jsonb_build_object(
    'passed', p_passed,
    'first_pass', v_first_pass,
    'xp_awarded', case when v_first_pass then v_xp else 0 end,
    'lesson_completed', v_completed,
    'lesson_xp', case when v_completed then (select xp_reward from lessons where id = v_lesson) else 0 end
  );
end $$;

create function private.student_totals(p_student uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'xp', coalesce((select sum(amount) from xp_events where student_id = p_student), 0),
    'streak', coalesce((select case when last_activity_date >= private.today_mx() - 1 then current_streak else 0 end
                        from student_streaks where student_id = p_student), 0),
    'longest_streak', coalesce((select longest_streak from student_streaks where student_id = p_student), 0)
  );
$$;

-- Next lesson of a student's program: first unlocked, not completed lesson (course order).
create function private.next_lesson(p_student uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', l.slug, 'title', l.title, 'language', l.language, 'course', c.title,
                            'status', coalesce(lp.status, 'not_started'))
  from students s
  join group_courses gc on gc.group_id = s.group_id
  join courses c on c.id = gc.course_id
  join course_lesson_order o on o.course_id = gc.course_id
  join lessons l on l.id = o.lesson_id
  left join lesson_progress lp on lp.lesson_id = l.id and lp.student_id = s.id
  where s.id = p_student and coalesce(lp.status, 'not_started') <> 'completed'
    and private.is_lesson_unlocked(s.id, l.id)
  order by gc.position, c.position, o.seq
  limit 1;
$$;

-- ---------- Sign-in ----------
create function student_sign_in(p_gate text, p_code text, p_pin text, p_ip text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  v_lock jsonb := coalesce(private.cfg('lockout'), '{}'::jsonb);
  v_soft_after int := coalesce((v_lock ->> 'soft_after')::int, 5);
  v_soft_min int := coalesce((v_lock ->> 'soft_minutes')::int, 15);
  v_hard_after int := coalesce((v_lock ->> 'hard_after')::int, 10);
  v_hours int := coalesce((private.cfg('session_hours') #>> '{}')::int, 12);
  v_last_ok timestamptz;
  v_recent int;
  v_total int;
  v_fails int;
  v_token text;
  s students;
  g groups;
begin
  if p_gate is distinct from (select value from private.secrets where key = 'student_gate') then
    raise exception 'forbidden';
  end if;
  if p_ip is not null and (select count(*) from login_attempts where ip = p_ip and not success
                            and created_at > now() - interval '15 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select * into s from students where code = v_code for update;
  if not found then
    -- Unknown codes behave like real ones, so the response never reveals whether a code exists.
    insert into login_attempts (code_norm, ip, success) values (v_code, p_ip, false);
    select max(created_at) into v_last_ok from login_attempts where code_norm = v_code and success;
    select count(*) filter (where created_at > now() - make_interval(mins => v_soft_min)), count(*)
      into v_recent, v_total
      from login_attempts where code_norm = v_code and not success and created_at > coalesce(v_last_ok, '-infinity');
    if v_total >= v_hard_after or v_recent >= v_soft_after then
      return jsonb_build_object('ok', false, 'error', 'locked');
    end if;
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if s.hard_locked or (s.locked_until is not null and s.locked_until > now()) then
    insert into login_attempts (code_norm, ip, success) values (v_code, p_ip, false);
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  if crypt(coalesce(p_pin, ''), s.pin_hash) <> s.pin_hash then
    v_fails := s.failed_attempts + 1;
    insert into login_attempts (code_norm, ip, success) values (v_code, p_ip, false);
    if v_fails >= v_hard_after then
      update students set failed_attempts = v_fails, hard_locked = true, locked_until = null where id = s.id;
      insert into access_log (actor_kind, action, entity_type, entity_id, payload)
      values ('system', 'student_hard_locked', 'student', s.id, jsonb_build_object('failures', v_fails));
      return jsonb_build_object('ok', false, 'error', 'locked');
    elsif v_fails % v_soft_after = 0 then
      update students set failed_attempts = v_fails, locked_until = now() + make_interval(mins => v_soft_min) where id = s.id;
      insert into access_log (actor_kind, action, entity_type, entity_id, payload)
      values ('system', 'student_soft_locked', 'student', s.id, jsonb_build_object('failures', v_fails));
      return jsonb_build_object('ok', false, 'error', 'locked');
    end if;
    update students set failed_attempts = v_fails where id = s.id;
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into g from groups where id = s.group_id;
  if s.status <> 'active' or g.status <> 'active' or (g.ends_on is not null and g.ends_on < private.today_mx()) then
    insert into login_attempts (code_norm, ip, success) values (v_code, p_ip, false);
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into student_sessions (student_id, token_hash, user_agent, ip, expires_at)
  values (s.id, encode(digest(v_token, 'sha256'), 'hex'), left(p_user_agent, 300), p_ip, now() + make_interval(hours => v_hours));
  update students set failed_attempts = 0, locked_until = null, last_active_at = now() where id = s.id;
  insert into login_attempts (code_norm, ip, success) values (v_code, p_ip, true);
  return jsonb_build_object('ok', true, 'token', v_token, 'expires_at', now() + make_interval(hours => v_hours), 'nickname', s.nickname);
end $$;

create function student_sign_out(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  update student_sessions set revoked_at = now()
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and revoked_at is null;
$$;

-- ---------- Read models ----------
create function student_me(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
begin
  return (
    select jsonb_build_object(
      'id', s.id, 'code', s.code, 'nickname', s.nickname, 'avatar', s.avatar,
      'group', jsonb_build_object('id', g.id, 'year', g.year, 'month', g.month, 'letter', g.letter, 'community', c.name)
    ) || private.student_totals(s.id)
    from groups g join communities c on c.id = g.community_id where g.id = s.group_id
  );
end $$;

create function student_home(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  v_totals jsonb := private.student_totals(s.id);
  v_completed int;
  v_total int;
  v_badges jsonb;
begin
  select count(*) into v_completed from lesson_progress where student_id = s.id and status = 'completed';
  select count(*) into v_total from course_lesson_order o join group_courses gc on gc.course_id = o.course_id where gc.group_id = s.group_id;
  v_badges := jsonb_build_array(
    jsonb_build_object('id', 'first_program', 'earned', exists (select 1 from exercise_progress where student_id = s.id and passed)),
    jsonb_build_object('id', 'first_lesson', 'earned', v_completed >= 1),
    jsonb_build_object('id', 'five_lessons', 'earned', v_completed >= 5),
    jsonb_build_object('id', 'streak_3', 'earned', (v_totals ->> 'longest_streak')::int >= 3),
    jsonb_build_object('id', 'streak_7', 'earned', (v_totals ->> 'longest_streak')::int >= 7),
    jsonb_build_object('id', 'first_project', 'earned', exists (select 1 from projects where student_id = s.id)),
    jsonb_build_object('id', 'bilingual', 'earned', (
      select count(distinct l.language) = 2 from lesson_progress lp join lessons l on l.id = lp.lesson_id
      where lp.student_id = s.id and lp.status = 'completed')),
    jsonb_build_object('id', 'level_5', 'earned', (v_totals ->> 'xp')::int >= 800),
    jsonb_build_object('id', 'logro', 'earned', exists (select 1 from accomplishments where student_id = s.id and status = 'published'))
  );
  return student_me(p_token) || jsonb_build_object(
    'next', private.next_lesson(s.id),
    'lessons_completed', v_completed,
    'lessons_total', v_total,
    'badges', v_badges,
    'recent_projects', coalesce((
      select jsonb_agg(x order by x.updated_at desc) from (
        select id, name, language, updated_at from projects where student_id = s.id order by updated_at desc limit 3) x), '[]'::jsonb)
  );
end $$;

create function student_path(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
begin
  return coalesce((
    select jsonb_agg(course order by gpos, cpos) from (
      select gc.position as gpos, c.position as cpos, jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description,
        'lessons', (
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'slug', l.slug, 'title', l.title, 'summary', l.summary, 'language', l.language,
            'minutes', l.estimated_minutes, 'xp', l.xp_reward, 'seq', o.seq, 'module', m.title,
            'status', coalesce(lp.status, 'not_started'),
            'unlocked', private.is_lesson_unlocked(s.id, l.id),
            'unlock_after', (select pl.title from course_lesson_order po join lessons pl on pl.id = po.lesson_id
                             where po.course_id = o.course_id and po.seq = o.seq - 1)
          ) order by o.seq)
          from course_lesson_order o
          join lessons l on l.id = o.lesson_id
          join modules m on m.id = l.module_id
          left join lesson_progress lp on lp.lesson_id = l.id and lp.student_id = s.id
          where o.course_id = c.id)
      ) as course
      from group_courses gc join courses c on c.id = gc.course_id
      where gc.group_id = s.group_id and c.status = 'published'
    ) t), '[]'::jsonb);
end $$;

create function private.lesson_payload(p_lesson uuid, p_student uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', l.id, 'slug', l.slug, 'title', l.title, 'summary', l.summary, 'content_md', l.content_md,
    'language', l.language, 'visibility', l.visibility, 'minutes', l.estimated_minutes, 'xp', l.xp_reward,
    'pair', (select jsonb_build_object('slug', p.slug, 'title', p.title, 'language', p.language)
             from lessons p where p.id = l.pair_lesson_id and p.status = 'published'
               and (p_student is null and p.visibility = 'public' or p_student is not null and private.student_can_read_lesson(p_student, p.id))),
    'deck', (select d.slides from slide_decks d where d.lesson_id = l.id and d.status = 'published'),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'slug', e.slug, 'position', e.position, 'type', e.type, 'title', e.title,
        'instructions_md', e.instructions_md, 'starter_code', e.starter_code, 'config', e.config,
        'xp', e.xp_reward, 'required', e.required, 'timeout_ms', e.timeout_ms,
        'tests', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'description', t.description,
                                   'spec', t.spec, 'hidden', t.hidden) order by t.position)
                           from exercise_tests t where t.exercise_id = e.id), '[]'::jsonb),
        'hints', coalesce((select jsonb_agg(h.content_md order by h.position) from exercise_hints h where h.exercise_id = e.id), '[]'::jsonb),
        'progress', (select jsonb_build_object('passed', ep.passed, 'attempts', ep.attempts, 'hints_used', ep.hints_used,
                                               'best_submission', ep.best_submission)
                     from exercise_progress ep where ep.exercise_id = e.id and ep.student_id = p_student)
      ) order by e.position) from exercises e where e.lesson_id = l.id), '[]'::jsonb)
  ) from lessons l where l.id = p_lesson;
$$;

create function student_lesson(p_token text, p_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  v_id uuid;
  v_course uuid;
  v_seq bigint;
begin
  select id into v_id from lessons where slug = p_slug and status = 'published';
  if v_id is null or not private.student_can_read_lesson(s.id, v_id) then raise exception 'lesson_not_found'; end if;
  select o.course_id, o.seq into v_course, v_seq from course_lesson_order o
    join group_courses gc on gc.course_id = o.course_id and gc.group_id = s.group_id where o.lesson_id = v_id limit 1;
  return private.lesson_payload(v_id, s.id) || jsonb_build_object(
    'status', coalesce((select status from lesson_progress where student_id = s.id and lesson_id = v_id), 'not_started'),
    'unlocked', private.is_lesson_unlocked(s.id, v_id),
    'unlock_after', (select l.title from course_lesson_order o join lessons l on l.id = o.lesson_id
                     where o.course_id = v_course and o.seq = v_seq - 1),
    'course', (select jsonb_build_object('slug', c.slug, 'title', c.title) from courses c where c.id = v_course),
    'next', (select jsonb_build_object('slug', l.slug, 'title', l.title, 'language', l.language)
             from course_lesson_order o join lessons l on l.id = o.lesson_id where o.course_id = v_course and o.seq = v_seq + 1)
  );
end $$;

-- ---------- Submissions ----------
create function student_submit_code(
  p_token text, p_exercise_id uuid, p_submission text, p_passed boolean,
  p_results jsonb default '[]'::jsonb, p_runtime_ms integer default null, p_hints_used integer default 0,
  p_error_type text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  v_type exercise_type;
  v_res jsonb;
begin
  select type into v_type from exercises where id = p_exercise_id;
  if v_type is distinct from 'code' then raise exception 'wrong_exercise_type'; end if;
  v_res := private.apply_attempt(s.id, p_exercise_id, p_passed, p_submission, p_results, p_runtime_ms, p_hints_used, p_error_type);
  return v_res || private.student_totals(s.id);
end $$;

create function student_submit_answer(p_token text, p_exercise_id uuid, p_answer jsonb, p_hints_used integer default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  v_type exercise_type;
  v_expected jsonb;
  v_explanation text;
  v_passed boolean := false;
  v_res jsonb;
begin
  select e.type, so.answer, so.explanation_md into v_type, v_expected, v_explanation
  from exercises e left join exercise_solutions so on so.exercise_id = e.id where e.id = p_exercise_id;
  if v_type is null or v_type = 'code' then raise exception 'wrong_exercise_type'; end if;
  if v_expected is null then raise exception 'exercise_not_configured'; end if;
  if v_type = 'multiple_choice' then
    v_passed := coalesce((p_answer -> 'choices') = (v_expected -> 'choices'), false);
  else
    v_passed := exists (select 1 from jsonb_array_elements_text(v_expected -> 'accepted') a
                        where lower(btrim(a)) = lower(btrim(coalesce(p_answer ->> 'text', ''))));
  end if;
  v_res := private.apply_attempt(s.id, p_exercise_id, v_passed, p_answer::text, '[]'::jsonb, null, p_hints_used, null);
  return v_res || private.student_totals(s.id) || jsonb_build_object('explanation_md', case when v_passed then v_explanation end);
end $$;

-- Visitors grade multiple choice too, but nothing is stored.
create function public_check_answer(p_exercise_id uuid, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_type exercise_type;
  v_expected jsonb;
  v_explanation text;
  v_passed boolean := false;
begin
  select e.type, so.answer, so.explanation_md into v_type, v_expected, v_explanation
  from exercises e join lessons l on l.id = e.lesson_id
  left join exercise_solutions so on so.exercise_id = e.id
  where e.id = p_exercise_id and l.status = 'published' and l.visibility = 'public';
  if v_type is null or v_type = 'code' then raise exception 'wrong_exercise_type'; end if;
  if v_type = 'multiple_choice' then
    v_passed := coalesce((p_answer -> 'choices') = (v_expected -> 'choices'), false);
  else
    v_passed := exists (select 1 from jsonb_array_elements_text(v_expected -> 'accepted') a
                        where lower(btrim(a)) = lower(btrim(coalesce(p_answer ->> 'text', ''))));
  end if;
  return jsonb_build_object('passed', v_passed, 'explanation_md', case when v_passed then v_explanation end);
end $$;

create function student_complete_lesson(p_token text, p_lesson_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  v_done boolean;
begin
  if not private.student_can_read_lesson(s.id, p_lesson_id) then raise exception 'lesson_not_found'; end if;
  if not private.is_lesson_unlocked(s.id, p_lesson_id) then raise exception 'lesson_locked'; end if;
  perform private.touch_streak(s.id);
  v_done := private.try_complete_lesson(s.id, p_lesson_id);
  return jsonb_build_object('lesson_completed', v_done) || private.student_totals(s.id);
end $$;

-- ---------- Projects ----------
create function private.own_project(p_student uuid, p_project uuid) returns projects
language plpgsql stable security definer set search_path = public as $$
declare
  p projects;
begin
  select * into p from projects where id = p_project and student_id = p_student;
  if not found then raise exception 'project_not_found'; end if;
  return p;
end $$;

create function student_projects(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'language', p.language, 'updated_at', p.updated_at, 'created_at', p.created_at,
      'lesson', (select jsonb_build_object('slug', l.slug, 'title', l.title) from lessons l where l.id = p.source_lesson_id),
      'nomination', (select a.status from accomplishments a where a.project_id = p.id order by a.created_at desc limit 1)
    ) order by p.updated_at desc)
    from projects p where p.student_id = s.id), '[]'::jsonb);
end $$;

create function student_project_get(p_token text, p_project uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
begin
  return jsonb_build_object(
    'id', p.id, 'name', p.name, 'language', p.language, 'code', p.code, 'updated_at', p.updated_at,
    'lesson', (select jsonb_build_object('slug', l.slug, 'title', l.title) from lessons l where l.id = p.source_lesson_id),
    'nomination', (select jsonb_build_object('status', a.status, 'title', a.title) from accomplishments a
                   where a.project_id = p.id order by a.created_at desc limit 1),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'created_at', v.created_at) order by v.created_at desc)
                          from project_versions v where v.project_id = p.id), '[]'::jsonb)
  );
end $$;

create function student_project_create(p_token text, p_name text, p_language code_language, p_code text default '', p_source_lesson uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  v_id uuid;
begin
  if (select count(*) from projects where student_id = s.id) >= 200 then raise exception 'too_many_projects'; end if;
  if p_source_lesson is not null and not private.student_can_read_lesson(s.id, p_source_lesson) then p_source_lesson := null; end if;
  insert into projects (student_id, name, language, code, source_lesson_id)
  values (s.id, left(btrim(coalesce(nullif(btrim(p_name), ''), 'Mi proyecto')), 80), p_language, left(coalesce(p_code, ''), 20000), p_source_lesson)
  returning id into v_id;
  insert into project_versions (project_id, code) values (v_id, left(coalesce(p_code, ''), 20000));
  return v_id;
end $$;

create function student_project_save(p_token text, p_project uuid, p_code text, p_snapshot boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
  v_last project_versions;
  v_versioned boolean := false;
begin
  update projects set code = left(coalesce(p_code, ''), 20000) where id = p.id;
  select * into v_last from project_versions where project_id = p.id order by created_at desc, id desc limit 1;
  if v_last.id is null or (v_last.code is distinct from p_code and (p_snapshot or v_last.created_at < now() - interval '2 minutes')) then
    insert into project_versions (project_id, code) values (p.id, left(coalesce(p_code, ''), 20000));
    v_versioned := true;
  end if;
  return jsonb_build_object('saved_at', now(), 'versioned', v_versioned);
end $$;

create function student_project_rename(p_token text, p_project uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
begin
  if nullif(btrim(p_name), '') is null then raise exception 'invalid_name'; end if;
  update projects set name = left(btrim(p_name), 80) where id = p.id;
end $$;

create function student_project_duplicate(p_token text, p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
begin
  return student_project_create(p_token, left(p.name || ' (copia)', 80), p.language, p.code, p.source_lesson_id);
end $$;

create function student_project_delete(p_token text, p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
begin
  delete from projects where id = p.id;
end $$;

create function student_project_version(p_token text, p_project uuid, p_version bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
begin
  return (select code from project_versions where id = p_version and project_id = p.id);
end $$;

create function student_nominate_project(p_token text, p_project uuid, p_title text, p_blurb text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
  p projects := private.own_project(s.id, p_project);
  g groups;
  v_id uuid;
begin
  select * into g from groups where id = s.group_id;
  select id into v_id from accomplishments where project_id = p.id and status in ('nominated', 'approved') limit 1;
  if v_id is not null then
    update accomplishments set title = left(coalesce(nullif(btrim(p_title), ''), p.name), 120), blurb = left(coalesce(p_blurb, ''), 600),
           code = p.code, language = p.language where id = v_id;
    return v_id;
  end if;
  insert into accomplishments (student_id, project_id, kind, title, blurb, language, code, display_name, community_id, year,
                               status, nominated_by_student)
  values (s.id, p.id, 'project', left(coalesce(nullif(btrim(p_title), ''), p.name), 120), left(coalesce(p_blurb, ''), 600),
          p.language, p.code, s.nickname, g.community_id, g.year, 'nominated', true)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Profile ----------
create function student_update_profile(p_token text, p_nickname text, p_avatar text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s students := private.session_student(p_token);
begin
  if nullif(btrim(p_nickname), '') is null then raise exception 'invalid_name'; end if;
  if p_avatar !~ '^[a-z0-9_-]{1,24}$' then raise exception 'invalid_avatar'; end if;
  update students set nickname = left(btrim(p_nickname), 40), avatar = p_avatar where id = s.id;
end $$;

create function student_change_pin(p_token text, p_current text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s students := private.session_student(p_token);
begin
  if crypt(coalesce(p_current, ''), s.pin_hash) <> s.pin_hash then return jsonb_build_object('ok', false, 'error', 'wrong_pin'); end if;
  if private.is_trivial_pin(p_new) then return jsonb_build_object('ok', false, 'error', 'trivial_pin'); end if;
  update students set pin_hash = private.hash_pin(p_new) where id = s.id;
  insert into access_log (actor_kind, actor_id, action, entity_type, entity_id) values ('student', s.id, 'student_changed_pin', 'student', s.id);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Privileges ----------
revoke all on all functions in schema private from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'student_sign_in(text,text,text,text,text)', 'student_sign_out(text)', 'student_me(text)', 'student_home(text)',
    'student_path(text)', 'student_lesson(text,text)',
    'student_submit_code(text,uuid,text,boolean,jsonb,integer,integer,text)', 'student_submit_answer(text,uuid,jsonb,integer)',
    'student_complete_lesson(text,uuid)', 'student_projects(text)', 'student_project_get(text,uuid)',
    'student_project_create(text,text,code_language,text,uuid)', 'student_project_save(text,uuid,text,boolean)',
    'student_project_rename(text,uuid,text)', 'student_project_duplicate(text,uuid)', 'student_project_delete(text,uuid)',
    'student_project_version(text,uuid,bigint)', 'student_nominate_project(text,uuid,text,text)',
    'student_update_profile(text,text,text)', 'student_change_pin(text,text,text)', 'public_check_answer(uuid,jsonb)']
  loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
