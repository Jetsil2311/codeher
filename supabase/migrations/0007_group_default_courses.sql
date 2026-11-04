-- New groups get every published course by default (same as the local adapter).

create or replace function staff_create_group(
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
  -- New groups start with every published course; staff can unassign from the group page.
  insert into group_courses (group_id, course_id, position)
    select v_group, c.id, row_number() over (order by c.position) - 1 from courses c where c.status = 'published';
  v_students := private.insert_students(v_group, p_students);
  perform private.log_access('group_created', 'group', v_group,
    jsonb_build_object('prefix', private.group_prefix(p_year, p_month, v_letter), 'students', jsonb_array_length(v_students)));
  return jsonb_build_object('group_id', v_group, 'prefix', private.group_prefix(p_year, p_month, v_letter), 'students', v_students);
end $$;
