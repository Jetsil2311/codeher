-- Staff (educator / founder) functions: groups and codes, roster actions, dashboards,
-- Logros curation, educator management, settings, audit, data export, authoring, API keys.

create function private.require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
end $$;

create function private.require_founder() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_founder() then raise exception 'forbidden'; end if;
end $$;

create function private.require_group(p_group uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not educator_can_see_group(p_group) then raise exception 'forbidden'; end if;
end $$;

create function private.require_student(p_student uuid) returns students
language plpgsql stable security definer set search_path = public as $$
declare
  s students;
begin
  select * into s from students where id = p_student;
  if not found or not educator_can_see_group(s.group_id) then raise exception 'forbidden'; end if;
  return s;
end $$;

create function private.log_access(p_action text, p_entity_type text, p_entity uuid, p_payload jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into access_log (actor_kind, actor_id, action, entity_type, entity_id, payload)
  values ('staff', auth.uid(), p_action, p_entity_type, p_entity, coalesce(p_payload, '{}'::jsonb));
$$;

create function private.group_prefix(p_year int, p_month int, p_letter text) returns text
language sql immutable as $$
  select lpad((p_year % 100)::text, 2, '0') || lpad(p_month::text, 2, '0') || coalesce(p_letter, '');
$$;

create function private.group_label(g groups) returns text
language sql stable security definer set search_path = public as $$
  select private.group_prefix(g.year, g.month, g.letter);
$$;

-- Insert students for a group starting at its next_number. p_students: [{nickname, pin?}]
create function private.insert_students(p_group uuid, p_students jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g groups;
  v_prefix text;
  v_out jsonb := '[]'::jsonb;
  v_num int;
  v_pin text;
  v_code text;
  v_id uuid;
  r record;
begin
  select * into g from groups where id = p_group for update;
  v_prefix := private.group_prefix(g.year, g.month, g.letter);
  v_num := g.next_number;
  for r in select value as item from jsonb_array_elements(p_students) loop
    if nullif(btrim(r.item ->> 'nickname'), '') is null then continue; end if;
    v_pin := r.item ->> 'pin';
    if private.is_trivial_pin(v_pin) then v_pin := private.random_pin(); end if;
    v_code := v_prefix || lpad(v_num::text, case when v_num > 99 then 3 else 2 end, '0');
    insert into students (group_id, number, code, nickname, pin_hash)
    values (g.id, v_num, v_code, left(btrim(r.item ->> 'nickname'), 40), private.hash_pin(v_pin))
    returning id into v_id;
    v_out := v_out || jsonb_build_object('id', v_id, 'number', v_num, 'code', v_code, 'nickname', left(btrim(r.item ->> 'nickname'), 40), 'pin', v_pin);
    v_num := v_num + 1;
  end loop;
  update groups set next_number = v_num where id = g.id;
  return v_out;
end $$;

-- Suggest the next group letter for a month (decision 1).
create function staff_suggest_group(p_year int, p_month int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_taken text[];
  v_first_without boolean := coalesce((private.cfg('group_letter_rule') ->> 'first_without_letter')::boolean, true);
  v_letter text;
  c int;
begin
  perform private.require_staff();
  select coalesce(array_agg(coalesce(letter, '')), '{}') into v_taken from groups where year = p_year and month = p_month;
  if v_first_without and not ('' = any(v_taken)) then
    v_letter := null;
  else
    for c in ascii(case when v_first_without then 'B' else 'A' end)..ascii('Z') loop
      if not (chr(c) = any(v_taken)) then v_letter := chr(c); exit; end if;
    end loop;
  end if;
  return jsonb_build_object('letter', v_letter, 'taken', to_jsonb(v_taken),
                            'prefix', private.group_prefix(p_year, p_month, v_letter));
end $$;

create function staff_create_group(
  p_year int, p_month int, p_letter text, p_community uuid, p_students jsonb,
  p_ends_on date default null, p_label text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_letter text := nullif(upper(btrim(coalesce(p_letter, ''))), '');
  v_group uuid;
  v_students jsonb;
begin
  perform private.require_staff();
  if v_letter is not null and v_letter !~ '^[A-Z]$' then raise exception 'invalid_letter'; end if;
  if exists (select 1 from groups where year = p_year and month = p_month and coalesce(letter, '') = coalesce(v_letter, '')) then
    raise exception 'group_prefix_taken';
  end if;
  if jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) = 0 then raise exception 'no_students'; end if;
  insert into groups (year, month, letter, community_id, label, ends_on, created_by)
  values (p_year, p_month, v_letter, p_community, left(coalesce(p_label, ''), 80), p_ends_on, auth.uid())
  returning id into v_group;
  insert into educator_groups (educator_id, group_id, assigned_by) values (auth.uid(), v_group, auth.uid());
  v_students := private.insert_students(v_group, p_students);
  perform private.log_access('group_created', 'group', v_group,
    jsonb_build_object('prefix', private.group_prefix(p_year, p_month, v_letter), 'students', jsonb_array_length(v_students)));
  return jsonb_build_object('group_id', v_group, 'prefix', private.group_prefix(p_year, p_month, v_letter), 'students', v_students);
end $$;

create function staff_add_students(p_group uuid, p_students jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_students jsonb;
begin
  perform private.require_group(p_group);
  v_students := private.insert_students(p_group, p_students);
  perform private.log_access('students_added', 'group', p_group, jsonb_build_object('count', jsonb_array_length(v_students)));
  return v_students;
end $$;

create function staff_reset_pin(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
  v_pin text := private.random_pin();
begin
  update students set pin_hash = private.hash_pin(v_pin), failed_attempts = 0, locked_until = null, hard_locked = false where id = s.id;
  update student_sessions set revoked_at = now() where student_id = s.id and revoked_at is null;
  perform private.log_access('pin_reset', 'student', s.id, jsonb_build_object('code', s.code));
  return jsonb_build_object('id', s.id, 'code', s.code, 'nickname', s.nickname, 'pin', v_pin);
end $$;

create function staff_unlock_student(p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
begin
  update students set failed_attempts = 0, locked_until = null, hard_locked = false where id = s.id;
  perform private.log_access('student_unlocked', 'student', s.id, jsonb_build_object('code', s.code));
end $$;

create function staff_set_students_status(p_students uuid[], p_status student_status) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  n int := 0;
  s students;
begin
  foreach v_id in array p_students loop
    s := private.require_student(v_id);
    update students set status = p_status where id = s.id and status <> p_status;
    if found then
      n := n + 1;
      if p_status = 'inactive' then
        update student_sessions set revoked_at = now() where student_id = s.id and revoked_at is null;
      end if;
      perform private.log_access(case when p_status = 'active' then 'code_activated' else 'code_deactivated' end,
                                 'student', s.id, jsonb_build_object('code', s.code));
    end if;
  end loop;
  return n;
end $$;

create function staff_set_group_status(p_group uuid, p_status group_status, p_students_too boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_group(p_group);
  update groups set status = p_status, closed_at = case when p_status = 'closed' then now() end where id = p_group;
  if p_students_too then
    update students set status = case when p_status = 'closed' then 'inactive'::student_status else 'active'::student_status end
    where group_id = p_group;
    if p_status = 'closed' then
      update student_sessions set revoked_at = now()
      where revoked_at is null and student_id in (select id from students where group_id = p_group);
    end if;
  end if;
  perform private.log_access(case when p_status = 'closed' then 'group_closed' else 'group_reopened' end, 'group', p_group);
end $$;

create function staff_update_group(p_group uuid, p_label text, p_ends_on date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_group(p_group);
  update groups set label = left(coalesce(p_label, ''), 80), ends_on = p_ends_on where id = p_group;
  perform private.log_access('group_updated', 'group', p_group, jsonb_build_object('ends_on', p_ends_on));
end $$;

create function staff_assign_course(p_group uuid, p_course uuid, p_assign boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_group(p_group);
  if p_assign then
    insert into group_courses (group_id, course_id, position, assigned_by)
    values (p_group, p_course, coalesce((select max(position) + 1 from group_courses where group_id = p_group), 0), auth.uid())
    on conflict do nothing;
  else
    delete from group_courses where group_id = p_group and course_id = p_course;
  end if;
  perform private.log_access(case when p_assign then 'course_assigned' else 'course_unassigned' end, 'group', p_group,
                             jsonb_build_object('course_id', p_course));
end $$;

create function staff_record_consent(p_student uuid, p_consent boolean, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
begin
  update students set guardian_consent = p_consent, consent_reference = nullif(btrim(coalesce(p_reference, '')), ''),
         consent_recorded_at = now(), consent_recorded_by = auth.uid()
  where id = s.id;
  perform private.log_access('consent_recorded', 'student', s.id, jsonb_build_object('consent', p_consent));
end $$;

-- ---------- Read models ----------
create function private.student_stats(p_student uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lessons_completed', (select count(*) from lesson_progress where student_id = p_student and status = 'completed'),
    'xp', coalesce((select sum(amount) from xp_events where student_id = p_student), 0),
    'exercises_passed', (select count(*) from exercise_progress where student_id = p_student and passed),
    'attempts', (select count(*) from exercise_attempts where student_id = p_student)
  );
$$;

create function private.group_json(g groups) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id, 'prefix', private.group_prefix(g.year, g.month, g.letter), 'year', g.year, 'month', g.month,
    'letter', g.letter, 'label', g.label, 'status', g.status, 'ends_on', g.ends_on, 'created_at', g.created_at,
    'community', (select jsonb_build_object('id', c.id, 'name', c.name) from communities c where c.id = g.community_id),
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

create function staff_groups() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  return coalesce((select jsonb_agg(private.group_json(g) order by g.year desc, g.month desc, coalesce(g.letter, ''))
                   from groups g where educator_can_see_group(g.id)), '[]'::jsonb);
end $$;

create function staff_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'groups', (select coalesce(jsonb_agg(private.group_json(g) order by g.created_at desc), '[]'::jsonb)
               from groups g where g.status = 'active' and exists (select 1 from educator_groups eg where eg.group_id = g.id and eg.educator_id = auth.uid())),
    'inactive', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select s.id, s.nickname, s.code, s.last_active_at, private.group_prefix(g.year, g.month, g.letter) as prefix
        from students s join groups g on g.id = s.group_id
        where s.status = 'active' and g.status = 'active'
          and exists (select 1 from educator_groups eg where eg.group_id = g.id and eg.educator_id = auth.uid())
          and (s.last_active_at is null or s.last_active_at < now() - interval '7 days')
        order by s.last_active_at nulls first limit 12) x),
    'locked', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select s.id, s.nickname, s.code, s.hard_locked, s.locked_until
        from students s where educator_can_see_group(s.group_id)
          and exists (select 1 from educator_groups eg where eg.group_id = s.group_id and eg.educator_id = auth.uid())
          and (s.hard_locked or s.locked_until > now()) limit 12) x),
    'recent', (select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) from (
        (select 'lesson_completed' as kind, s.id as student_id, s.nickname, l.title, lp.completed_at as at
         from lesson_progress lp join students s on s.id = lp.student_id join lessons l on l.id = lp.lesson_id
         where lp.status = 'completed' and lp.completed_at > now() - interval '14 days'
           and exists (select 1 from educator_groups eg where eg.group_id = s.group_id and eg.educator_id = auth.uid())
         order by lp.completed_at desc limit 12)
        union all
        (select 'project_created', s.id, s.nickname, p.name, p.created_at
         from projects p join students s on s.id = p.student_id
         where p.created_at > now() - interval '14 days'
           and exists (select 1 from educator_groups eg where eg.group_id = s.group_id and eg.educator_id = auth.uid())
         order by p.created_at desc limit 8)
        union all
        (select 'nomination', s.id, s.nickname, a.title, a.nominated_at
         from accomplishments a join students s on s.id = a.student_id
         where a.status = 'nominated'
           and exists (select 1 from educator_groups eg where eg.group_id = s.group_id and eg.educator_id = auth.uid())
         order by a.nominated_at desc limit 6)
      ) x)
  );
end $$;

create function staff_group_detail(p_group uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g groups;
begin
  perform private.require_group(p_group);
  select * into g from groups where id = p_group;
  return private.group_json(g) || jsonb_build_object(
    'roster', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'number', s.number, 'code', s.code, 'nickname', s.nickname, 'status', s.status,
        'last_active_at', s.last_active_at, 'failed_attempts', s.failed_attempts,
        'locked', s.hard_locked or coalesce(s.locked_until > now(), false), 'hard_locked', s.hard_locked,
        'consent', s.guardian_consent) || private.student_stats(s.id) order by s.number)
      from students s where s.group_id = g.id), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'slug', c.slug) order by gc.position)
                         from group_courses gc join courses c on c.id = gc.course_id where gc.group_id = g.id), '[]'::jsonb),
    'available_courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'slug', c.slug) order by c.position)
                                   from courses c where c.status = 'published'
                                     and not exists (select 1 from group_courses gc where gc.group_id = g.id and gc.course_id = c.id)), '[]'::jsonb),
    'exercise_report', coalesce((select jsonb_agg(r order by r.course_pos, r.seq, r.position) from (
        select c.position as course_pos, o.seq, e.position, e.id as exercise_id, e.title, l.title as lesson, l.language,
               count(ep.*) filter (where ep.attempts > 0) as attempted,
               count(ep.*) filter (where ep.passed) as passed,
               round(avg(ep.attempts) filter (where ep.attempts > 0), 1) as avg_attempts,
               round(avg(ep.hints_used) filter (where ep.attempts > 0), 1) as avg_hints,
               (select ea.error_type from exercise_attempts ea join students s2 on s2.id = ea.student_id
                where ea.exercise_id = e.id and s2.group_id = g.id and ea.error_type is not null
                group by ea.error_type order by count(*) desc limit 1) as top_error
        from group_courses gc
        join courses c on c.id = gc.course_id
        join course_lesson_order o on o.course_id = c.id
        join lessons l on l.id = o.lesson_id
        join exercises e on e.lesson_id = l.id
        left join exercise_progress ep on ep.exercise_id = e.id and ep.student_id in (select id from students where group_id = g.id)
        where gc.group_id = g.id
        group by c.position, o.seq, e.position, e.id, e.title, l.title, l.language) r), '[]'::jsonb)
  );
end $$;

create function staff_student_detail(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
  g groups;
begin
  select * into g from groups where id = s.group_id;
  if is_founder() and not exists (select 1 from educator_groups where group_id = g.id and educator_id = auth.uid()) then
    perform private.log_access('founder_viewed_student', 'student', s.id, jsonb_build_object('code', s.code));
  end if;
  return jsonb_build_object(
    'id', s.id, 'code', s.code, 'nickname', s.nickname, 'avatar', s.avatar, 'status', s.status, 'number', s.number,
    'last_active_at', s.last_active_at, 'created_at', s.created_at,
    'locked', s.hard_locked or coalesce(s.locked_until > now(), false), 'hard_locked', s.hard_locked,
    'consent', jsonb_build_object('given', s.guardian_consent, 'reference', s.consent_reference, 'recorded_at', s.consent_recorded_at),
    'group', private.group_json(g),
    'stats', private.student_stats(s.id) || private.student_totals(s.id),
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('slug', l.slug, 'title', l.title, 'language', l.language,
                                  'status', coalesce(lp.status, 'not_started'), 'completed_at', lp.completed_at) order by gc.position, o.seq)
                         from group_courses gc join course_lesson_order o on o.course_id = gc.course_id
                         join lessons l on l.id = o.lesson_id
                         left join lesson_progress lp on lp.lesson_id = l.id and lp.student_id = s.id
                         where gc.group_id = g.id), '[]'::jsonb),
    'exercises', coalesce((select jsonb_agg(jsonb_build_object('exercise_id', e.id, 'title', e.title, 'lesson', l.title,
                                   'passed', ep.passed, 'attempts', ep.attempts, 'hints_used', ep.hints_used,
                                   'last_error', (select error_type from exercise_attempts ea where ea.student_id = s.id and ea.exercise_id = e.id
                                                  and error_type is not null order by created_at desc limit 1)) order by ep.updated_at desc)
                           from exercise_progress ep join exercises e on e.id = ep.exercise_id join lessons l on l.id = e.lesson_id
                           where ep.student_id = s.id), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select ea.id, ea.created_at, ea.passed, ea.error_type, e.title as exercise, ea.submission
        from exercise_attempts ea join exercises e on e.id = ea.exercise_id where ea.student_id = s.id
        order by ea.created_at desc limit 40) x), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(jsonb_build_object('type', error_type, 'count', n) order by n desc) from (
        select error_type, count(*) as n from exercise_attempts where student_id = s.id and error_type is not null
        group by error_type order by count(*) desc limit 8) x), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'language', p.language, 'updated_at', p.updated_at)
                                  order by p.updated_at desc) from projects p where p.student_id = s.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at,
                                  'author', (select display_name from profiles where id = n.author_id)) order by n.created_at desc)
                       from student_notes n where n.student_id = s.id), '[]'::jsonb)
  );
end $$;

create function staff_project(p_project uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p projects;
  s students;
begin
  select * into p from projects where id = p_project;
  if not found then raise exception 'project_not_found'; end if;
  s := private.require_student(p.student_id);
  if is_founder() and not exists (select 1 from educator_groups where group_id = s.group_id and educator_id = auth.uid()) then
    perform private.log_access('founder_viewed_project', 'project', p.id);
  end if;
  return jsonb_build_object('id', p.id, 'name', p.name, 'language', p.language, 'code', p.code, 'updated_at', p.updated_at,
                            'student', jsonb_build_object('id', s.id, 'nickname', s.nickname, 'code', s.code),
                            'nomination', (select jsonb_build_object('id', a.id, 'status', a.status) from accomplishments a
                                           where a.project_id = p.id order by a.created_at desc limit 1));
end $$;

create function top_errors(p_exercise uuid, p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('type', error_type, 'count', n) order by n desc) from (
    select ea.error_type, count(*) as n from exercise_attempts ea join students s on s.id = ea.student_id
    where ea.exercise_id = p_exercise and ea.error_type is not null and educator_can_see_group(s.group_id)
    group by ea.error_type order by count(*) desc limit p_limit) x), '[]'::jsonb);
end $$;

-- ---------- Logros ----------
create function staff_nominate(p_student uuid, p_project uuid, p_kind accomplishment_kind, p_title text, p_blurb text, p_tags text[] default '{}')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
  g groups;
  p projects;
  v_id uuid;
begin
  select * into g from groups where id = s.group_id;
  if p_project is not null then
    select * into p from projects where id = p_project and student_id = s.id;
    if not found then raise exception 'project_not_found'; end if;
  end if;
  insert into accomplishments (student_id, project_id, kind, title, blurb, tags, language, code, display_name, community_id, year,
                               status, nominated_by)
  values (s.id, p.id, p_kind, left(btrim(p_title), 120), left(coalesce(p_blurb, ''), 600), coalesce(p_tags, '{}'),
          p.language, p.code, s.nickname, g.community_id, g.year, 'nominated', auth.uid())
  returning id into v_id;
  perform private.log_access('logro_nominated', 'accomplishment', v_id);
  return v_id;
end $$;

create function staff_update_nomination(p_id uuid, p_title text, p_blurb text, p_tags text[], p_kind accomplishment_kind) returns void
language plpgsql security definer set search_path = public as $$
declare
  a accomplishments;
begin
  select * into a from accomplishments where id = p_id;
  if not found or not (is_founder() or (a.student_id is not null and educator_can_see_student(a.student_id))) then raise exception 'forbidden'; end if;
  update accomplishments set title = left(btrim(p_title), 120), blurb = left(coalesce(p_blurb, ''), 600),
         tags = coalesce(p_tags, '{}'), kind = p_kind where id = p_id;
end $$;

create function staff_logros() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'blurb', a.blurb, 'kind', a.kind, 'tags', a.tags, 'status', a.status, 'featured', a.featured,
      'language', a.language, 'display_name', a.display_name, 'year', a.year, 'is_sample', a.is_sample,
      'nominated_by_student', a.nominated_by_student, 'nominated_at', a.nominated_at, 'published_at', a.published_at,
      'community', (select name from communities c where c.id = a.community_id),
      'student', (select jsonb_build_object('id', s.id, 'code', s.code, 'consent', s.guardian_consent) from students s where s.id = a.student_id)
    ) order by a.nominated_at desc)
    from accomplishments a
    where is_founder() or (a.student_id is not null and educator_can_see_student(a.student_id))), '[]'::jsonb);
end $$;

create function founder_review_logro(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a accomplishments;
  v_consent boolean;
begin
  perform private.require_founder();
  select * into a from accomplishments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select guardian_consent into v_consent from students where id = a.student_id;
  case p_action
    when 'approve' then update accomplishments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    when 'publish' then
      if not a.is_sample and not coalesce(v_consent, false) then raise exception 'consent_required'; end if;
      update accomplishments set status = 'published', published_at = coalesce(published_at, now()), reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_id;
    when 'unpublish' then update accomplishments set status = 'unpublished', featured = false, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    when 'reject' then update accomplishments set status = 'rejected', featured = false, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    when 'feature' then
      update accomplishments set featured = false where featured;
      update accomplishments set featured = true where id = p_id and status = 'published';
    when 'unfeature' then update accomplishments set featured = false where id = p_id;
    when 'delete' then delete from accomplishments where id = p_id;
    else raise exception 'invalid_action';
  end case;
  perform private.log_access('logro_' || p_action, 'accomplishment', p_id, jsonb_build_object('title', a.title));
end $$;

-- ---------- Founders: educators, settings, stats, audit ----------
create function founder_staff() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_founder();
  return jsonb_build_object(
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'email', p.email, 'role', p.role,
                         'active', p.active, 'created_at', p.created_at,
                         'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'prefix', private.group_prefix(g.year, g.month, g.letter)))
                                             from educator_groups eg join groups g on g.id = eg.group_id where eg.educator_id = p.id), '[]'::jsonb))
                       order by p.role desc, p.display_name) from profiles p), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('email', i.email, 'role', i.role, 'created_at', i.created_at, 'accepted_at', i.accepted_at)
                                          order by i.created_at desc) from staff_invites i), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'prefix', private.group_prefix(g.year, g.month, g.letter), 'status', g.status)
                                         order by g.year desc, g.month desc) from groups g), '[]'::jsonb)
  );
end $$;

create function founder_invite(p_email text, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
begin
  perform private.require_founder();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_role not in ('educator', 'founder') then raise exception 'invalid_role'; end if;
  insert into staff_invites (email, role, invited_by) values (v_email, p_role, auth.uid())
  on conflict (email) do update set role = excluded.role, invited_by = excluded.invited_by;
  update profiles set role = p_role, active = true where email = v_email and role = 'pending';
  perform private.log_access('staff_invited', 'invite', null, jsonb_build_object('email', v_email, 'role', p_role));
end $$;

create function founder_set_staff(p_profile uuid, p_role app_role, p_active boolean, p_confirm text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
begin
  perform private.require_founder();
  select * into p from profiles where id = p_profile for update;
  if not found then raise exception 'not_found'; end if;
  if p_role = 'founder' and p.role <> 'founder' and coalesce(p_confirm, '') <> 'CONFIRMAR' then raise exception 'confirmation_required'; end if;
  update profiles set role = p_role, active = p_active where id = p_profile;
  perform private.log_access('staff_changed', 'profile', p_profile,
    jsonb_build_object('from_role', p.role, 'to_role', p_role, 'from_active', p.active, 'to_active', p_active));
end $$;

create function founder_assign_group(p_educator uuid, p_group uuid, p_assign boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_founder();
  if p_assign then
    insert into educator_groups (educator_id, group_id, assigned_by) values (p_educator, p_group, auth.uid()) on conflict do nothing;
  else
    delete from educator_groups where educator_id = p_educator and group_id = p_group;
  end if;
  perform private.log_access(case when p_assign then 'group_assigned' else 'group_unassigned' end, 'group', p_group,
                             jsonb_build_object('educator', p_educator));
end $$;

create function founder_reassign_groups(p_from uuid, p_to uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform private.require_founder();
  insert into educator_groups (educator_id, group_id, assigned_by)
  select p_to, group_id, auth.uid() from educator_groups where educator_id = p_from on conflict do nothing;
  delete from educator_groups where educator_id = p_from;
  get diagnostics n = row_count;
  perform private.log_access('groups_reassigned', 'profile', p_from, jsonb_build_object('to', p_to, 'count', n));
  return n;
end $$;

create function founder_update_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_founder();
  update app_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then raise exception 'unknown_setting'; end if;
  perform private.log_access('setting_changed', 'setting', null, jsonb_build_object('key', p_key));
end $$;

create function founder_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_founder();
  return jsonb_build_object(
    'students', (select count(*) from students),
    'active_students', (select count(*) from students where status = 'active'),
    'active_week', (select count(*) from students where last_active_at > now() - interval '7 days'),
    'groups', (select count(*) from groups),
    'active_groups', (select count(*) from groups where status = 'active'),
    'educators', (select count(*) from profiles where role in ('educator', 'founder') and active),
    'lessons_completed', (select count(*) from lesson_progress where status = 'completed'),
    'exercises_passed', (select count(*) from exercise_progress where passed),
    'projects', (select count(*) from projects),
    'logros_published', (select count(*) from accomplishments where status = 'published' and not is_sample),
    'nominations_pending', (select count(*) from accomplishments where status in ('nominated', 'approved')),
    'by_community', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'groups', (select count(*) from groups g where g.community_id = c.id),
        'students', (select count(*) from students s join groups g on g.id = s.group_id where g.community_id = c.id)) order by c.position)
        from communities c), '[]'::jsonb),
    'by_language', coalesce((select jsonb_object_agg(language, n) from (
        select l.language, count(*) as n from lesson_progress lp join lessons l on l.id = lp.lesson_id
        where lp.status = 'completed' group by l.language) x), '{}'::jsonb)
  );
end $$;

create function founder_audit(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_founder();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    (select 'access' as source, a.action, a.entity_type, a.entity_id, a.payload, a.created_at, a.actor_kind,
            coalesce((select display_name from profiles where id = a.actor_id), (select nickname from students where id = a.actor_id)) as actor
     from access_log a order by a.created_at desc limit p_limit)
    union all
    (select 'content', c.action, c.entity_type, c.entity_id, c.payload, c.created_at, c.actor_kind,
            (select display_name from profiles where id = c.actor_id)
     from content_audit_log c order by c.created_at desc limit p_limit)
  ) x limit p_limit), '[]'::jsonb);
end $$;

create function founder_search(p_query text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q text := '%' || lower(btrim(coalesce(p_query, ''))) || '%';
begin
  perform private.require_founder();
  return jsonb_build_object(
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'nickname', s.nickname)) from (
        select * from students where lower(code) like q or lower(nickname) like q limit 20) s), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'language', p.language,
                           'student', (select nickname from students where id = p.student_id))) from (
        select * from projects where lower(name) like q order by updated_at desc limit 20) p), '[]'::jsonb),
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'slug', l.slug, 'title', l.title, 'status', l.status,
                          'visibility', l.visibility, 'language', l.language)) from (
        select * from lessons where lower(title) like q or lower(slug) like q limit 20) l), '[]'::jsonb)
  );
end $$;

-- Export or delete a student's data on request (brief section 6).
create function staff_export_student(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
begin
  perform private.log_access('student_exported', 'student', s.id, jsonb_build_object('code', s.code));
  return jsonb_build_object(
    'student', jsonb_build_object('code', s.code, 'nickname', s.nickname, 'avatar', s.avatar, 'status', s.status, 'created_at', s.created_at,
                                  'guardian_consent', s.guardian_consent),
    'progress', coalesce((select jsonb_agg(to_jsonb(lp) - 'student_id') from lesson_progress lp where lp.student_id = s.id), '[]'::jsonb),
    'exercises', coalesce((select jsonb_agg(to_jsonb(ep) - 'student_id') from exercise_progress ep where ep.student_id = s.id), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(to_jsonb(ea) - 'student_id') from exercise_attempts ea where ea.student_id = s.id), '[]'::jsonb),
    'xp', coalesce((select jsonb_agg(to_jsonb(x) - 'student_id') from xp_events x where x.student_id = s.id), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(p) - 'student_id') from projects p where p.student_id = s.id), '[]'::jsonb),
    'accomplishments', coalesce((select jsonb_agg(to_jsonb(a) - 'student_id') from accomplishments a where a.student_id = s.id), '[]'::jsonb)
  );
end $$;

create function staff_delete_student(p_student uuid, p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s students := private.require_student(p_student);
begin
  if p_confirm is distinct from s.code then raise exception 'confirmation_required'; end if;
  delete from students where id = s.id;
  perform private.log_access('student_deleted', 'student', s.id, jsonb_build_object('code', s.code));
end $$;

-- ---------- Public landing data (numbers only, no names) ----------
create function public_landing() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'communities', coalesce((select jsonb_agg(jsonb_build_object(
        'name', c.name, 'state', c.state, 'since_year', c.since_year,
        'groups', (select count(*) from groups g where g.community_id = c.id),
        'students', (select count(*) from students s join groups g on g.id = s.group_id where g.community_id = c.id),
        'years', coalesce((select jsonb_agg(distinct g.year order by g.year) from groups g where g.community_id = c.id), '[]'::jsonb)
      ) order by c.position) from communities c where c.active), '[]'::jsonb),
    'totals', jsonb_build_object(
      'groups', (select count(*) from groups),
      'students', (select count(*) from students),
      'communities', (select count(*) from communities where active),
      'lessons_completed', (select count(*) from lesson_progress where status = 'completed')),
    'featured', coalesce((select jsonb_agg(x) from (
        select a.id, a.title, a.blurb, a.kind, a.tags, a.language, a.display_name, a.year, a.is_sample,
               (select name from communities c where c.id = a.community_id) as community
        from accomplishments a where a.status = 'published'
        order by a.featured desc, a.is_sample, a.published_at desc limit 3) x), '[]'::jsonb)
  );
$$;

-- ---------- Authoring ----------
create function upsert_exercise_bundle(p_payload jsonb, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_lesson uuid := (p_payload ->> 'lesson_id')::uuid;
  v_version int;
  v_expected int := nullif(p_payload ->> 'expected_version', '')::int;
  v_pos int;
  t jsonb;
  i int;
begin
  if v_id is null then
    select coalesce(max(position), 0) + 1 into v_pos from exercises where lesson_id = v_lesson;
    insert into exercises (lesson_id, slug, position, type, title, instructions_md, starter_code, config, xp_reward, required, timeout_ms)
    values (v_lesson, p_payload ->> 'slug', coalesce((p_payload ->> 'position')::int, v_pos),
            coalesce((p_payload ->> 'type')::exercise_type, 'code'), p_payload ->> 'title',
            coalesce(p_payload ->> 'instructions_md', ''), coalesce(p_payload ->> 'starter_code', ''),
            coalesce(p_payload -> 'config', '{}'::jsonb), coalesce((p_payload ->> 'xp_reward')::int, 10),
            coalesce((p_payload ->> 'required')::boolean, true), coalesce((p_payload ->> 'timeout_ms')::int, 5000))
    returning id into v_id;
  else
    select version into v_version from exercises where id = v_id and lesson_id = v_lesson for update;
    if not found then raise exception 'exercise_not_found'; end if;
    if v_expected is not null and v_expected <> v_version then raise exception 'version_conflict'; end if;
    update exercises set slug = p_payload ->> 'slug', type = coalesce((p_payload ->> 'type')::exercise_type, type),
           title = p_payload ->> 'title', instructions_md = coalesce(p_payload ->> 'instructions_md', ''),
           starter_code = coalesce(p_payload ->> 'starter_code', ''), config = coalesce(p_payload -> 'config', '{}'::jsonb),
           xp_reward = coalesce((p_payload ->> 'xp_reward')::int, xp_reward), required = coalesce((p_payload ->> 'required')::boolean, required),
           timeout_ms = coalesce((p_payload ->> 'timeout_ms')::int, timeout_ms)
    where id = v_id;
  end if;

  if p_payload ? 'tests' then
    delete from exercise_tests where exercise_id = v_id;
    i := 0;
    for t in select * from jsonb_array_elements(p_payload -> 'tests') loop
      i := i + 1;
      insert into exercise_tests (exercise_id, position, kind, description, spec, hidden)
      values (v_id, i, (t ->> 'kind')::test_kind, t ->> 'description', coalesce(t -> 'spec', '{}'::jsonb), coalesce((t ->> 'hidden')::boolean, false));
    end loop;
  end if;
  if p_payload ? 'hints' then
    delete from exercise_hints where exercise_id = v_id;
    i := 0;
    for t in select * from jsonb_array_elements(p_payload -> 'hints') loop
      i := i + 1;
      insert into exercise_hints (exercise_id, position, content_md) values (v_id, i, t #>> '{}');
    end loop;
  end if;
  if p_payload ? 'solution' or p_payload ? 'known_wrong_solutions' then
    insert into exercise_solutions (exercise_id, solution_code, answer, explanation_md, known_wrong_solutions, validated_at, validated_fingerprint)
    values (v_id, coalesce(p_payload #>> '{solution,solution_code}', ''), p_payload #> '{solution,answer}',
            coalesce(p_payload #>> '{solution,explanation_md}', ''), coalesce(p_payload -> 'known_wrong_solutions', '[]'::jsonb),
            case when p_payload ? 'validated_fingerprint' then now() end, p_payload ->> 'validated_fingerprint')
    on conflict (exercise_id) do update set
      solution_code = excluded.solution_code, answer = excluded.answer, explanation_md = excluded.explanation_md,
      known_wrong_solutions = excluded.known_wrong_solutions,
      validated_at = case when p_payload ? 'validated_fingerprint' then now() else exercise_solutions.validated_at end,
      validated_fingerprint = case when p_payload ? 'validated_fingerprint' then excluded.validated_fingerprint else exercise_solutions.validated_fingerprint end;
  end if;

  insert into content_audit_log (actor_id, actor_kind, action, entity_type, entity_id, payload)
  values (p_actor, case when p_payload ? 'api_key_id' then 'mcp' else 'user' end,
          case when p_payload ? 'id' then 'update' else 'create' end, 'exercise', v_id,
          jsonb_build_object('slug', p_payload ->> 'slug'));
  return jsonb_build_object('id', v_id, 'version', (select version from exercises where id = v_id));
end $$;

create function staff_save_exercise_bundle(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not can_edit_lesson((p_payload ->> 'lesson_id')::uuid) then raise exception 'forbidden'; end if;
  return upsert_exercise_bundle(p_payload - 'api_key_id', auth.uid());
end $$;

create function staff_set_status(p_entity text, p_id uuid, p_status content_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  l lessons;
begin
  perform private.require_staff();
  if p_entity = 'lesson' then
    select * into l from lessons where id = p_id;
    if not found or not can_edit_lesson(p_id) then raise exception 'forbidden'; end if;
    if p_status = 'published' and l.visibility = 'public' and not is_founder() then raise exception 'founder_publishes_public'; end if;
    update lessons set status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
    where id = p_id;
  elsif p_entity = 'course' then
    if not (is_founder() or exists (select 1 from courses where id = p_id and created_by = auth.uid())) then raise exception 'forbidden'; end if;
    if p_status = 'published' and not exists (select 1 from modules where course_id = p_id and status = 'published') then
      raise exception 'course_needs_module';
    end if;
    update courses set status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end where id = p_id;
  elsif p_entity = 'module' then
    if not (is_founder() or exists (select 1 from modules m join courses c on c.id = m.course_id where m.id = p_id and c.created_by = auth.uid())) then
      raise exception 'forbidden';
    end if;
    if p_status = 'published' and not exists (select 1 from lessons where module_id = p_id and status = 'published') then
      raise exception 'module_needs_lesson';
    end if;
    update modules set status = p_status where id = p_id;
  elsif p_entity = 'slide_deck' then
    update slide_decks set status = p_status where id = p_id and (is_founder() or created_by = auth.uid() or (lesson_id is not null and can_edit_lesson(lesson_id)));
  else
    raise exception 'invalid_entity';
  end if;
  insert into content_audit_log (actor_id, actor_kind, action, entity_type, entity_id, payload)
  values (auth.uid(), 'user', 'set_status', p_entity, p_id, jsonb_build_object('status', p_status));
  if p_status = 'published' then perform private.log_access('content_published', p_entity, p_id); end if;
end $$;

create function reorder_items(p_table text, p_parent uuid, p_ordered_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_parent_col text;
  v_count int;
begin
  perform private.require_staff();
  v_parent_col := case p_table when 'modules' then 'course_id' when 'lessons' then 'module_id' when 'exercises' then 'lesson_id' else null end;
  if v_parent_col is null then raise exception 'invalid_table'; end if;
  if p_table = 'exercises' and not can_edit_lesson(p_parent) then raise exception 'forbidden'; end if;
  if p_table in ('modules', 'lessons') and not is_founder() then raise exception 'forbidden'; end if;
  execute format('select count(*) from %I where %I = $1', p_table, v_parent_col) into v_count using p_parent;
  if v_count <> coalesce(array_length(p_ordered_ids, 1), 0)
     or exists (select 1 from unnest(p_ordered_ids) x(id) group by id having count(*) > 1) then
    raise exception 'ids_mismatch';
  end if;
  execute format('select count(*) from %I where %I = $1 and id = any($2)', p_table, v_parent_col) into v_count using p_parent, p_ordered_ids;
  if v_count <> array_length(p_ordered_ids, 1) then raise exception 'ids_mismatch'; end if;
  execute format('update %I t set position = o.ord from unnest($1) with ordinality o(id, ord) where t.id = o.id and t.%I = $2',
                 p_table, v_parent_col) using p_ordered_ids, p_parent;
end $$;

-- ---------- API keys for the MCP server ----------
create function staff_create_api_key(p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := 'chk_' || encode(gen_random_bytes(24), 'hex');
  v_id uuid;
begin
  perform private.require_staff();
  insert into api_keys (owner_id, name, key_prefix, key_hash, expires_at)
  values (auth.uid(), left(coalesce(nullif(btrim(p_name), ''), 'Claude'), 60), left(v_token, 12),
          encode(digest(v_token, 'sha256'), 'hex'), now() + interval '90 days')
  returning id into v_id;
  perform private.log_access('api_key_created', 'api_key', v_id);
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

create function staff_api_keys() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'prefix', key_prefix, 'created_at', created_at,
          'last_used_at', last_used_at, 'expires_at', expires_at, 'revoked_at', revoked_at) order by created_at desc)
          from api_keys where owner_id = auth.uid()), '[]'::jsonb);
end $$;

create function staff_revoke_api_key(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  update api_keys set revoked_at = now() where id = p_id and owner_id = auth.uid() and revoked_at is null;
  perform private.log_access('api_key_revoked', 'api_key', p_id);
end $$;

-- ---------- Privileges ----------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function upsert_exercise_bundle(jsonb, uuid) from public, anon, authenticated;
grant execute on function upsert_exercise_bundle(jsonb, uuid) to service_role;
grant execute on function public_landing() to anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'staff_suggest_group(int,int)', 'staff_create_group(int,int,text,uuid,jsonb,date,text)', 'staff_add_students(uuid,jsonb)',
    'staff_reset_pin(uuid)', 'staff_unlock_student(uuid)', 'staff_set_students_status(uuid[],student_status)',
    'staff_set_group_status(uuid,group_status,boolean)', 'staff_update_group(uuid,text,date)', 'staff_assign_course(uuid,uuid,boolean)',
    'staff_record_consent(uuid,boolean,text)', 'staff_groups()', 'staff_dashboard()', 'staff_group_detail(uuid)',
    'staff_student_detail(uuid)', 'staff_project(uuid)', 'top_errors(uuid,integer)',
    'staff_nominate(uuid,uuid,accomplishment_kind,text,text,text[])', 'staff_update_nomination(uuid,text,text,text[],accomplishment_kind)',
    'staff_logros()', 'founder_review_logro(uuid,text)', 'founder_staff()', 'founder_invite(text,app_role)',
    'founder_set_staff(uuid,app_role,boolean,text)', 'founder_assign_group(uuid,uuid,boolean)', 'founder_reassign_groups(uuid,uuid)',
    'founder_update_setting(text,jsonb)', 'founder_stats()', 'founder_audit(integer)', 'founder_search(text)',
    'staff_export_student(uuid)', 'staff_delete_student(uuid,text)', 'staff_save_exercise_bundle(jsonb)',
    'staff_set_status(text,uuid,content_status)', 'reorder_items(text,uuid,uuid[])',
    'staff_create_api_key(text)', 'staff_api_keys()', 'staff_revoke_api_key(uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
