-- Course authoring: staff create, edit, reorder and delete courses, modules and lessons
-- from the platform. All writes go through SECURITY DEFINER functions so positions stay
-- contiguous (deferrable unique constraints) and every change leaves an audit row.
-- Who can do what:
--   * Founders: everything.
--   * Educators: courses they created (and their modules); lessons they created.
--     They cannot delete anything that already has student progress.

create function can_edit_course(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_founder() or (is_staff() and exists (select 1 from courses c where c.id = p_course and c.created_by = auth.uid()));
$$;

create function private.slugify(p text) returns text
language sql immutable as $$
  select left(trim(both '-' from regexp_replace(lower(translate(coalesce(p, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g')), 60);
$$;

create function private.content_audit(p_action text, p_type text, p_id uuid, p_payload jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into content_audit_log (actor_id, actor_kind, action, entity_type, entity_id, payload)
  values (auth.uid(), 'user', p_action, p_type, p_id, coalesce(p_payload, '{}'::jsonb));
$$;

-- Close position gaps inside a module / course (the unique constraints are deferrable).
create function private.renumber_lessons(p_module uuid) returns void
language sql security definer set search_path = public as $$
  update lessons l set position = o.rn
  from (select id, row_number() over (order by position, created_at) as rn from lessons where module_id = p_module) o
  where l.id = o.id and l.position <> o.rn;
$$;
create function private.renumber_modules(p_course uuid) returns void
language sql security definer set search_path = public as $$
  update modules m set position = o.rn
  from (select id, row_number() over (order by position, created_at) as rn from modules where course_id = p_course) o
  where m.id = o.id and m.position <> o.rn;
$$;

create function private.lesson_has_progress(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lesson_progress where lesson_id = p_lesson)
      or exists (select 1 from exercise_progress ep join exercises e on e.id = ep.exercise_id where e.lesson_id = p_lesson);
$$;

-- Removes the lessons of a module: deletes the ones the caller may delete (when asked to)
-- and detaches the rest as unassigned drafts so no one else's work is lost.
create function private.release_lessons(p_module uuid, p_delete boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_deleted int := 0;
  v_detached int := 0;
begin
  for r in select id from lessons where module_id = p_module loop
    if p_delete and can_edit_lesson(r.id) and (is_founder() or not private.lesson_has_progress(r.id)) then
      delete from lessons where id = r.id;
      perform private.content_audit('delete', 'lesson', r.id);
      v_deleted := v_deleted + 1;
    else
      update lessons set module_id = null,
        visibility = case when visibility = 'program' then 'draft'::lesson_visibility else visibility end,
        status = case when visibility = 'program' then 'draft'::content_status else status end
      where id = r.id;
      perform private.content_audit('detach', 'lesson', r.id, jsonb_build_object('module_id', p_module));
      v_detached := v_detached + 1;
    end if;
  end loop;
  return jsonb_build_object('deleted', v_deleted, 'detached', v_detached);
end $$;

-- ---------- Courses ----------
create function staff_save_course(p_id uuid, p_slug text, p_title text, p_description text, p_first_module text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_id;
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_slug text := btrim(coalesce(p_slug, ''));
  v_mod text := left(coalesce(nullif(btrim(coalesce(p_first_module, '')), ''), 'Módulo 1'), 120);
begin
  perform private.require_staff();
  if v_title = '' then raise exception 'invalid_name'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 60 then raise exception 'invalid_slug'; end if;
  if exists (select 1 from courses where slug = v_slug and id is distinct from p_id) then raise exception 'already_exists'; end if;
  if p_id is null then
    insert into courses (slug, title, description, status, position, created_by)
    values (v_slug, v_title, left(coalesce(p_description, ''), 600), 'draft', coalesce((select max(position) from courses), 0) + 1, auth.uid())
    returning id into v_id;
    insert into modules (course_id, slug, title, position) values (v_id, coalesce(nullif(private.slugify(v_mod), ''), 'modulo-1'), v_mod, 1);
    perform private.content_audit('create', 'course', v_id, jsonb_build_object('slug', v_slug));
  else
    if not can_edit_course(p_id) then raise exception 'forbidden'; end if;
    update courses set slug = v_slug, title = v_title, description = left(coalesce(p_description, ''), 600), version = version + 1, updated_at = now()
    where id = p_id;
    if not found then raise exception 'not_found'; end if;
    perform private.content_audit('update', 'course', v_id);
  end if;
  return v_id;
end $$;

-- How many groups and students use a course (for the delete warning).
create function staff_course_usage(p_course uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform private.require_staff();
  if not can_edit_course(p_course) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'groups', (select count(*) from group_courses where course_id = p_course),
    'students', (select count(distinct lp.student_id) from lesson_progress lp join lessons l on l.id = lp.lesson_id
                 join modules m on m.id = l.module_id where m.course_id = p_course)
  );
end $$;

create function staff_delete_course(p_id uuid, p_confirm text, p_delete_lessons boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c courses;
  m record;
  v_out jsonb;
  v_deleted int := 0;
  v_detached int := 0;
begin
  perform private.require_staff();
  select * into c from courses where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not can_edit_course(p_id) then raise exception 'forbidden'; end if;
  if p_confirm is distinct from c.slug then raise exception 'confirmation_required'; end if;
  if not is_founder() and exists (select 1 from lesson_progress lp join lessons l on l.id = lp.lesson_id
                                  join modules mm on mm.id = l.module_id where mm.course_id = p_id) then
    raise exception 'course_in_use';
  end if;
  for m in select id from modules where course_id = p_id loop
    v_out := private.release_lessons(m.id, coalesce(p_delete_lessons, false));
    v_deleted := v_deleted + (v_out->>'deleted')::int;
    v_detached := v_detached + (v_out->>'detached')::int;
  end loop;
  delete from courses where id = p_id;
  perform private.content_audit('delete', 'course', p_id, jsonb_build_object('slug', c.slug, 'lessons_deleted', v_deleted, 'lessons_detached', v_detached));
  perform private.log_access('course_deleted', 'course', p_id, jsonb_build_object('slug', c.slug));
  return jsonb_build_object('deleted', v_deleted, 'detached', v_detached);
end $$;

-- ---------- Modules ----------
create function staff_save_module(p_id uuid, p_course uuid, p_title text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_id;
  v_course uuid := p_course;
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_base text;
  v_slug text;
  i int := 2;
begin
  perform private.require_staff();
  if v_title = '' then raise exception 'invalid_name'; end if;
  if p_id is not null then select course_id into v_course from modules where id = p_id; end if;
  if v_course is null then raise exception 'not_found'; end if;
  if not can_edit_course(v_course) then raise exception 'forbidden'; end if;
  if p_id is null then
    v_base := coalesce(nullif(private.slugify(v_title), ''), 'modulo');
    v_slug := v_base;
    while exists (select 1 from modules where course_id = v_course and slug = v_slug) loop
      v_slug := v_base || '-' || i;
      i := i + 1;
    end loop;
    insert into modules (course_id, slug, title, position)
    values (v_course, v_slug, v_title, coalesce((select max(position) from modules where course_id = v_course), 0) + 1)
    returning id into v_id;
    perform private.content_audit('create', 'module', v_id, jsonb_build_object('course_id', v_course));
  else
    update modules set title = v_title, version = version + 1, updated_at = now() where id = p_id;
    perform private.content_audit('update', 'module', p_id);
  end if;
  return v_id;
end $$;

create function staff_delete_module(p_id uuid, p_delete_lessons boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_out jsonb;
begin
  perform private.require_staff();
  select course_id into v_course from modules where id = p_id;
  if v_course is null then raise exception 'not_found'; end if;
  if not can_edit_course(v_course) then raise exception 'forbidden'; end if;
  if not is_founder() and coalesce(p_delete_lessons, false)
     and exists (select 1 from lessons l where l.module_id = p_id and private.lesson_has_progress(l.id)) then
    raise exception 'module_in_use';
  end if;
  v_out := private.release_lessons(p_id, coalesce(p_delete_lessons, false));
  delete from modules where id = p_id;
  perform private.renumber_modules(v_course);
  perform private.content_audit('delete', 'module', p_id, v_out);
  return v_out;
end $$;

-- ---------- Lessons ----------
-- Moves a lesson to the end of another module (or out of every course when p_module is null).
create function staff_move_lesson(p_lesson uuid, p_module uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l lessons;
  v_course uuid;
  v_from_course uuid;
begin
  perform private.require_staff();
  select * into l from lessons where id = p_lesson;
  if not found then raise exception 'not_found'; end if;
  if l.module_id is not distinct from p_module then return; end if;
  select course_id into v_from_course from modules where id = l.module_id;
  if p_module is not null then
    select course_id into v_course from modules where id = p_module;
    if v_course is null then raise exception 'not_found'; end if;
  end if;
  -- The lesson's author or whoever owns the course it leaves / joins may move it.
  if not (can_edit_lesson(p_lesson)
          or ((v_from_course is null or can_edit_course(v_from_course)) and (v_course is null or can_edit_course(v_course)))) then
    raise exception 'forbidden';
  end if;
  update lessons set
    module_id = p_module,
    position = coalesce((select max(position) from lessons where module_id is not distinct from p_module), 0) + 1,
    visibility = case when p_module is null and visibility = 'program' then 'draft'::lesson_visibility
                      when p_module is not null and visibility = 'draft' then 'program'::lesson_visibility
                      else visibility end
  where id = p_lesson;
  if l.module_id is not null then perform private.renumber_lessons(l.module_id); end if;
  perform private.content_audit('move', 'lesson', p_lesson, jsonb_build_object('from', l.module_id, 'to', p_module));
end $$;

create function staff_delete_lesson(p_id uuid, p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l lessons;
begin
  perform private.require_staff();
  select * into l from lessons where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not can_edit_lesson(p_id) then raise exception 'forbidden'; end if;
  if p_confirm is distinct from l.slug then raise exception 'confirmation_required'; end if;
  if not is_founder() and private.lesson_has_progress(p_id) then raise exception 'lesson_in_use'; end if;
  delete from lessons where id = p_id;
  if l.module_id is not null then perform private.renumber_lessons(l.module_id); end if;
  perform private.content_audit('delete', 'lesson', p_id, jsonb_build_object('slug', l.slug, 'title', l.title));
  perform private.log_access('lesson_deleted', 'lesson', p_id, jsonb_build_object('slug', l.slug));
end $$;

-- Reordering modules and lessons is now open to the course owner, not only founders.
create or replace function reorder_items(p_table text, p_parent uuid, p_ordered_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_parent_col text;
  v_count int;
begin
  perform private.require_staff();
  v_parent_col := case p_table when 'modules' then 'course_id' when 'lessons' then 'module_id' when 'exercises' then 'lesson_id' else null end;
  if v_parent_col is null then raise exception 'invalid_table'; end if;
  if p_table = 'exercises' and not can_edit_lesson(p_parent) then raise exception 'forbidden'; end if;
  if p_table = 'modules' and not can_edit_course(p_parent) then raise exception 'forbidden'; end if;
  if p_table = 'lessons' and not can_edit_course((select course_id from modules where id = p_parent)) then raise exception 'forbidden'; end if;
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

do $$
declare f text;
begin
  foreach f in array array[
    'can_edit_course(uuid)',
    'staff_save_course(uuid,text,text,text,text)', 'staff_course_usage(uuid)', 'staff_delete_course(uuid,text,boolean)',
    'staff_save_module(uuid,uuid,text)', 'staff_delete_module(uuid,boolean)',
    'staff_move_lesson(uuid,uuid)', 'staff_delete_lesson(uuid,text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function private.slugify(text), private.content_audit(text,text,uuid,jsonb), private.renumber_lessons(uuid),
  private.renumber_modules(uuid), private.lesson_has_progress(uuid), private.release_lessons(uuid,boolean) from public, anon, authenticated;
