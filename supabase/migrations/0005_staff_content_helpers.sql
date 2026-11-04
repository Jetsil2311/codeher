-- Content helpers the lesson editor needs that plain RLS writes cannot do safely:
-- exercises, tests, hints and solutions have no write policies (all writes go through
-- SECURITY DEFINER functions that check can_edit_lesson and leave an audit trail).

create function staff_delete_exercise(p_lesson uuid, p_exercise uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  if not can_edit_lesson(p_lesson) then raise exception 'forbidden'; end if;
  delete from exercises where id = p_exercise and lesson_id = p_lesson;
  if not found then raise exception 'exercise_not_found'; end if;
  -- Close the gap left in positions (deferrable unique constraint allows the swap).
  update exercises e set position = o.rn
  from (select id, row_number() over (order by position) as rn from exercises where lesson_id = p_lesson) o
  where e.id = o.id and e.position <> o.rn;
  insert into content_audit_log (actor_id, actor_kind, action, entity_type, entity_id, payload)
  values (auth.uid(), 'user', 'archive', 'exercise', p_exercise, jsonb_build_object('lesson_id', p_lesson));
end $$;

create function staff_duplicate_lesson(p_lesson uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l lessons;
  v_slug text;
  v_id uuid;
  i int := 2;
  e record;
  v_new_ex uuid;
begin
  perform private.require_staff();
  select * into l from lessons where id = p_lesson;
  if not found or not (is_founder() or l.status = 'published' or l.created_by = auth.uid()) then raise exception 'not_found'; end if;
  v_slug := l.slug || '-copia';
  while exists (select 1 from lessons where slug = v_slug) loop
    v_slug := l.slug || '-copia-' || i;
    i := i + 1;
  end loop;
  insert into lessons (module_id, slug, title, summary, content_md, language, visibility, position, estimated_minutes, xp_reward, status, created_by)
  values (l.module_id, v_slug, left(l.title || ' (copia)', 160), l.summary, l.content_md, l.language,
          case when l.visibility = 'public' then 'draft'::lesson_visibility else l.visibility end,
          coalesce((select max(position) from lessons where module_id is not distinct from l.module_id), 0) + 1,
          l.estimated_minutes, l.xp_reward, 'draft', auth.uid())
  returning id into v_id;
  for e in select * from exercises where lesson_id = p_lesson order by position loop
    insert into exercises (lesson_id, slug, position, type, title, instructions_md, starter_code, config, xp_reward, required, timeout_ms)
    values (v_id, e.slug, e.position, e.type, e.title, e.instructions_md, e.starter_code, e.config, e.xp_reward, e.required, e.timeout_ms)
    returning id into v_new_ex;
    insert into exercise_tests (exercise_id, position, kind, description, spec, hidden)
      select v_new_ex, position, kind, description, spec, hidden from exercise_tests where exercise_id = e.id;
    insert into exercise_hints (exercise_id, position, content_md)
      select v_new_ex, position, content_md from exercise_hints where exercise_id = e.id;
    insert into exercise_solutions (exercise_id, solution_code, answer, explanation_md, known_wrong_solutions, validated_at, validated_fingerprint)
      select v_new_ex, solution_code, answer, explanation_md, known_wrong_solutions, validated_at, validated_fingerprint
      from exercise_solutions where exercise_id = e.id;
  end loop;
  insert into content_audit_log (actor_id, actor_kind, action, entity_type, entity_id, payload)
  values (auth.uid(), 'user', 'duplicate', 'lesson', v_id, jsonb_build_object('from', p_lesson));
  return v_id;
end $$;

revoke all on function staff_delete_exercise(uuid, uuid) from public, anon;
revoke all on function staff_duplicate_lesson(uuid) from public, anon;
grant execute on function staff_delete_exercise(uuid, uuid) to authenticated;
grant execute on function staff_duplicate_lesson(uuid) to authenticated;
