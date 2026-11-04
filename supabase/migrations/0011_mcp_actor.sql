-- MCP authoring with full control: the MCP server authenticates a staff API key and then
-- calls these wrappers with the service-role key. Each wrapper first impersonates the key's
-- owner for the rest of the transaction (auth.uid() reads request.jwt.claims), then calls
-- the same SECURITY DEFINER function the website uses. Permissions, publish rules, position
-- bookkeeping and the audit trail are therefore identical to the platform.
-- Only service_role can execute them (never anon/authenticated).

create function private.act_as(p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_actor is null or not exists (select 1 from profiles where id = p_actor and active and role in ('educator', 'founder')) then
    raise exception 'forbidden';
  end if;
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
end $$;

create function mcp_save_course(p_actor uuid, p_id uuid, p_slug text, p_title text, p_description text, p_first_module text) returns uuid
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); return staff_save_course(p_id, p_slug, p_title, p_description, p_first_module); end $$;

create function mcp_course_usage(p_actor uuid, p_course uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); return staff_course_usage(p_course); end $$;

create function mcp_delete_course(p_actor uuid, p_id uuid, p_confirm text, p_delete_lessons boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); return staff_delete_course(p_id, p_confirm, p_delete_lessons); end $$;

create function mcp_save_module(p_actor uuid, p_id uuid, p_course uuid, p_title text) returns uuid
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); return staff_save_module(p_id, p_course, p_title); end $$;

create function mcp_delete_module(p_actor uuid, p_id uuid, p_delete_lessons boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); return staff_delete_module(p_id, p_delete_lessons); end $$;

create function mcp_reorder(p_actor uuid, p_table text, p_parent uuid, p_ordered_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); perform reorder_items(p_table, p_parent, p_ordered_ids); end $$;

create function mcp_move_lesson(p_actor uuid, p_lesson uuid, p_module uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); perform staff_move_lesson(p_lesson, p_module); end $$;

create function mcp_delete_lesson(p_actor uuid, p_id uuid, p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); perform staff_delete_lesson(p_id, p_confirm); end $$;

create function mcp_set_status(p_actor uuid, p_entity text, p_id uuid, p_status content_status) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); perform staff_set_status(p_entity, p_id, p_status); end $$;

create function mcp_delete_exercise(p_actor uuid, p_lesson uuid, p_exercise uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); perform staff_delete_exercise(p_lesson, p_exercise); end $$;

create function mcp_duplicate_lesson(p_actor uuid, p_lesson uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin perform private.act_as(p_actor); return staff_duplicate_lesson(p_lesson); end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.act_as(uuid)',
    'mcp_save_course(uuid,uuid,text,text,text,text)', 'mcp_course_usage(uuid,uuid)', 'mcp_delete_course(uuid,uuid,text,boolean)',
    'mcp_save_module(uuid,uuid,uuid,text)', 'mcp_delete_module(uuid,uuid,boolean)', 'mcp_reorder(uuid,text,uuid,uuid[])',
    'mcp_move_lesson(uuid,uuid,uuid)', 'mcp_delete_lesson(uuid,uuid,text)', 'mcp_set_status(uuid,text,uuid,content_status)',
    'mcp_delete_exercise(uuid,uuid,uuid)', 'mcp_duplicate_lesson(uuid,uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if f not like 'private.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end $$;
