-- Align staff read models with the shapes the web app renders (same as the local adapter):
-- * groups carry the community name plus its id,
-- * the dashboard includes totals and, for founders, every group (tech spec 4.2),
-- * audit rows carry their id.

create or replace function private.group_json(g groups) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id, 'prefix', private.group_prefix(g.year, g.month, g.letter), 'year', g.year, 'month', g.month,
    'letter', g.letter, 'label', g.label, 'status', g.status, 'ends_on', g.ends_on, 'created_at', g.created_at,
    'community', coalesce((select c.name from communities c where c.id = g.community_id), ''),
    'community_id', g.community_id,
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

create or replace function staff_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'groups', (select coalesce(jsonb_agg(private.group_json(g) order by g.created_at desc), '[]'::jsonb)
               from groups g where g.status = 'active' and educator_can_see_group(g.id)),
    'inactive', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select s.id, s.nickname, s.code, s.last_active_at, private.group_prefix(g.year, g.month, g.letter) as prefix
        from students s join groups g on g.id = s.group_id
        where s.status = 'active' and g.status = 'active' and educator_can_see_group(g.id)
          and (s.last_active_at is null or s.last_active_at < now() - interval '7 days')
        order by s.last_active_at nulls first limit 12) x),
    'locked', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select s.id, s.nickname, s.code, s.hard_locked, s.locked_until
        from students s where educator_can_see_group(s.group_id)
          and (s.hard_locked or s.locked_until > now()) limit 12) x),
    'recent', (select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) from (
        (select 'lesson_completed' as kind, s.id as student_id, s.nickname, l.title, lp.completed_at as at
         from lesson_progress lp join students s on s.id = lp.student_id join lessons l on l.id = lp.lesson_id
         where lp.status = 'completed' and lp.completed_at > now() - interval '14 days' and educator_can_see_group(s.group_id)
         order by lp.completed_at desc limit 12)
        union all
        (select 'project_created', s.id, s.nickname, p.name, p.created_at
         from projects p join students s on s.id = p.student_id
         where p.created_at > now() - interval '14 days' and educator_can_see_group(s.group_id)
         order by p.created_at desc limit 8)
        union all
        (select 'nomination', s.id, s.nickname, a.title, a.nominated_at
         from accomplishments a join students s on s.id = a.student_id
         where a.status = 'nominated' and educator_can_see_group(s.group_id)
         order by a.nominated_at desc limit 6)
      ) x),
    'totals', (select jsonb_build_object(
        'students', count(*),
        'active_week', count(*) filter (where s.last_active_at > now() - interval '7 days'))
      from students s where educator_can_see_group(s.group_id))
  );
end $$;

create or replace function founder_audit(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_founder();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    (select 'access' as source, a.id::text as id, a.action, a.entity_type, a.entity_id, a.payload, a.created_at, a.actor_kind, a.actor_id,
            coalesce((select display_name from profiles where id = a.actor_id), (select nickname from students where id = a.actor_id)) as actor
     from access_log a order by a.created_at desc limit p_limit)
    union all
    (select 'content', c.id::text, c.action, c.entity_type, c.entity_id, c.payload, c.created_at, c.actor_kind, c.actor_id,
            (select display_name from profiles where id = c.actor_id)
     from content_audit_log c order by c.created_at desc limit p_limit)
  ) x limit p_limit), '[]'::jsonb);
end $$;
