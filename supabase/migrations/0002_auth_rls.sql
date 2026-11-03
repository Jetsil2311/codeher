-- Staff identity, role helpers and row-level security (design brief section 6).
-- Educator isolation is enforced here, not only in the interface.

create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role in ('educator', 'founder'));
$$;

create function is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'founder');
$$;

create function educator_can_see_group(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_founder() or exists (
    select 1 from educator_groups eg
    join profiles p on p.id = eg.educator_id
    where eg.group_id = p_group and eg.educator_id = auth.uid() and p.active and p.role in ('educator', 'founder')
  );
$$;

create function educator_can_see_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = p_student and educator_can_see_group(s.group_id));
$$;

create function can_edit_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_founder() or (is_staff() and exists (select 1 from lessons l where l.id = p_lesson and l.created_by = auth.uid()));
$$;

-- New Auth users: invited emails get their role; everyone else waits as 'pending' with no access.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := 'pending';
begin
  select role into v_role from staff_invites where email = lower(new.email);
  if found then
    update staff_invites set accepted_at = now() where email = lower(new.email);
  else
    v_role := 'pending';
  end if;
  insert into profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    lower(new.email),
    v_role
  );
  insert into access_log (actor_kind, actor_id, action, entity_type, entity_id, payload)
  values ('system', new.id, 'staff_signed_up', 'profile', new.id, jsonb_build_object('role', v_role));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Only privileged roles (or SECURITY DEFINER founder functions, which run as the owner) change roles.
create function prevent_role_change() returns trigger
language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email)
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'role_change_forbidden';
  end if;
  return new;
end $$;
create trigger trg_profiles_role_guard before update on profiles
  for each row execute function prevent_role_change();

-- The last founder cannot be removed or demoted.
create function protect_last_founder() returns trigger
language plpgsql as $$
begin
  if old.role = 'founder' and old.active and (new.role <> 'founder' or not new.active) then
    if (select count(*) from profiles where role = 'founder' and active and id <> old.id) = 0 then
      raise exception 'last_founder';
    end if;
  end if;
  return new;
end $$;
create trigger trg_profiles_last_founder before update on profiles
  for each row execute function protect_last_founder();

-- ---------- Enable RLS everywhere (default deny) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','staff_invites','communities','app_settings','groups','educator_groups','students','student_notes',
    'student_sessions','login_attempts','courses','modules','lessons','exercises','exercise_tests','exercise_hints',
    'exercise_solutions','slide_decks','group_courses','lesson_progress','exercise_attempts','exercise_progress',
    'xp_events','student_streaks','projects','project_versions','accomplishments','error_translations','api_keys',
    'content_audit_log','access_log']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Profiles: staff see staff; everyone edits only their own display name.
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_staff());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy staff_invites_founder on staff_invites for all to authenticated
  using (is_founder()) with check (is_founder());

-- Communities and public settings are public (landing page).
create policy communities_read on communities for select to anon, authenticated using (active or is_staff());
create policy communities_founder on communities for all to authenticated using (is_founder()) with check (is_founder());
create policy settings_public_read on app_settings for select to anon, authenticated using (is_public or is_staff());
create policy settings_founder on app_settings for all to authenticated using (is_founder()) with check (is_founder());

-- Groups and students: educators see only assigned groups; founders see all. Writes go through RPCs.
create policy groups_read on groups for select to authenticated using (educator_can_see_group(id));
create policy educator_groups_read on educator_groups for select to authenticated
  using (is_founder() or educator_id = auth.uid());
create policy students_read on students for select to authenticated using (educator_can_see_group(group_id));
create policy student_notes_read on student_notes for select to authenticated using (educator_can_see_student(student_id));
create policy student_notes_insert on student_notes for insert to authenticated
  with check (educator_can_see_student(student_id) and author_id = auth.uid());
create policy group_courses_read on group_courses for select to authenticated using (educator_can_see_group(group_id));

-- Content: anyone can read published public lessons (Probar). Staff read published content and their drafts.
create policy courses_read on courses for select to authenticated
  using (is_founder() or (is_staff() and (status = 'published' or created_by = auth.uid())));
create policy courses_write on courses for all to authenticated
  using (is_founder() or (is_staff() and created_by = auth.uid()))
  with check (is_founder() or (is_staff() and created_by = auth.uid()));

create policy modules_read on modules for select to authenticated
  using (is_staff() and exists (select 1 from courses c where c.id = modules.course_id));
create policy modules_write on modules for all to authenticated
  using (is_founder() or exists (select 1 from courses c where c.id = modules.course_id and c.created_by = auth.uid()))
  with check (is_founder() or exists (select 1 from courses c where c.id = modules.course_id and c.created_by = auth.uid()));

create policy lessons_public_read on lessons for select to anon, authenticated
  using (status = 'published' and visibility = 'public');
create policy lessons_staff_read on lessons for select to authenticated
  using (is_founder() or (is_staff() and (status = 'published' or created_by = auth.uid())));
create policy lessons_insert on lessons for insert to authenticated
  with check (is_founder() or (is_staff() and created_by = auth.uid() and not (visibility = 'public' and status = 'published')));
create policy lessons_update on lessons for update to authenticated
  using (is_founder() or (is_staff() and created_by = auth.uid()))
  with check (is_founder() or (is_staff() and created_by = auth.uid() and not (visibility = 'public' and status = 'published')));
create policy lessons_delete on lessons for delete to authenticated using (is_founder());

create policy exercises_read on exercises for select to anon, authenticated
  using (exists (select 1 from lessons l where l.id = exercises.lesson_id));
create policy exercise_tests_read on exercise_tests for select to anon, authenticated
  using (exists (select 1 from exercises e where e.id = exercise_tests.exercise_id));
create policy exercise_hints_read on exercise_hints for select to anon, authenticated
  using (exists (select 1 from exercises e where e.id = exercise_hints.exercise_id));
create policy exercise_solutions_read on exercise_solutions for select to authenticated
  using (is_staff() and exists (select 1 from exercises e where e.id = exercise_solutions.exercise_id));

do $$
declare t text;
begin
  foreach t in array array['exercises'] loop
    execute format('create policy %I on %I for all to authenticated using (can_edit_lesson(lesson_id)) with check (can_edit_lesson(lesson_id))', t || '_write', t);
  end loop;
  foreach t in array array['exercise_tests', 'exercise_hints', 'exercise_solutions'] loop
    execute format(
      'create policy %I on %I for all to authenticated '
      'using (exists (select 1 from exercises e where e.id = %I.exercise_id and can_edit_lesson(e.lesson_id))) '
      'with check (exists (select 1 from exercises e where e.id = %I.exercise_id and can_edit_lesson(e.lesson_id)))',
      t || '_write', t, t, t);
  end loop;
end $$;

create policy slide_decks_read on slide_decks for select to anon, authenticated
  using ((status = 'published' and lesson_id is not null and exists (select 1 from lessons l where l.id = slide_decks.lesson_id))
         or is_staff());
create policy slide_decks_write on slide_decks for all to authenticated
  using (is_founder() or (lesson_id is not null and can_edit_lesson(lesson_id)) or created_by = auth.uid())
  with check (is_founder() or (lesson_id is not null and can_edit_lesson(lesson_id)) or created_by = auth.uid());

-- Progress, projects: staff read the students they can see; nobody writes directly (RPC only).
do $$
declare t text;
begin
  foreach t in array array['lesson_progress', 'exercise_attempts', 'exercise_progress', 'xp_events', 'student_streaks', 'projects'] loop
    execute format('create policy %I on %I for select to authenticated using (educator_can_see_student(student_id))', t || '_read', t);
  end loop;
end $$;
create policy project_versions_read on project_versions for select to authenticated
  using (exists (select 1 from projects p where p.id = project_versions.project_id and educator_can_see_student(p.student_id)));

-- Logros: published items are public; staff see items of their students; founders see all.
create policy accomplishments_public on accomplishments for select to anon, authenticated using (status = 'published');
create policy accomplishments_staff on accomplishments for select to authenticated
  using (is_founder() or (student_id is not null and educator_can_see_student(student_id)));

-- Error catalog: readable by everyone (visitors run public lessons); staff edit.
create policy error_translations_read on error_translations for select to anon, authenticated using (enabled or is_staff());
create policy error_translations_staff on error_translations for all to authenticated using (is_staff()) with check (is_staff());

-- Audit: founders only.
create policy audit_founder on content_audit_log for select to authenticated using (is_founder());
create policy access_log_founder on access_log for select to authenticated using (is_founder());
-- api_keys, student_sessions, login_attempts: no policies (server functions only).

-- Views (security_invoker so RLS of the caller applies)
create view course_lesson_order with (security_invoker = true) as
select m.course_id, l.id as lesson_id,
       row_number() over (partition by m.course_id order by m.position, l.position) as seq
from lessons l
join modules m on m.id = l.module_id
join courses c on c.id = m.course_id
where l.status = 'published' and m.status = 'published' and c.status = 'published' and l.visibility <> 'draft';

create view student_xp_totals with (security_invoker = true) as
select student_id, sum(amount)::integer as total_xp from xp_events group by student_id;

create view v_exercise_difficulty with (security_invoker = true) as
select e.id as exercise_id, e.lesson_id,
       count(*) filter (where ep.attempts > 0) as students_attempted,
       count(*) filter (where ep.passed) as students_passed,
       round(avg(ep.attempts)::numeric, 2) as avg_attempts,
       round(avg(ep.hints_used)::numeric, 2) as avg_hints
from exercises e
left join exercise_progress ep on ep.exercise_id = e.id
group by e.id, e.lesson_id;
