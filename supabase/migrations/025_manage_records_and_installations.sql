-- 025: fix mistakes (edit/delete dealers, customers, stock items) and plan installations with an executor.

-- ---------- dealers ----------
create or replace function public.update_warrio_dealer(
  p_organization_id uuid, p_dealer_id uuid, p_name text, p_code text,
  p_phone text, p_email text, p_is_active boolean default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'invalid_dealer' using errcode = '22023';
  end if;
  update public.dealers
     set name = btrim(p_name),
         code = nullif(btrim(coalesce(p_code, '')), ''),
         phone = nullif(btrim(coalesce(p_phone, '')), ''),
         email = nullif(lower(btrim(coalesce(p_email, ''))), ''),
         is_active = coalesce(p_is_active, is_active),
         updated_at = now()
   where id = p_dealer_id and organization_id = p_organization_id;
  if not found then raise exception 'dealer_not_found' using errcode = 'P0002'; end if;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'dealer.updated', 'dealer', p_dealer_id, '{}'::jsonb);
end $$;

create or replace function public.delete_warrio_dealer(p_organization_id uuid, p_dealer_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); result text := 'deleted';
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.dealers d where d.id = p_dealer_id and d.organization_id = p_organization_id) then
    raise exception 'dealer_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.sales s where s.dealer_id = p_dealer_id and s.organization_id = p_organization_id) then
    result := 'deactivated';
  else
    begin
      delete from public.dealers where id = p_dealer_id and organization_id = p_organization_id;
    exception when foreign_key_violation then
      result := 'deactivated';
    end;
  end if;
  if result = 'deactivated' then
    update public.dealers set is_active = false, updated_at = now()
     where id = p_dealer_id and organization_id = p_organization_id;
  end if;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'dealer.' || result, 'dealer', p_dealer_id, '{}'::jsonb);
  return result;
end $$;

-- ---------- customers ----------
create or replace function public.update_warrio_customer(
  p_organization_id uuid, p_customer_id uuid, p_full_name text, p_phone text, p_email text, p_address text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 200
     or char_length(btrim(coalesce(p_phone, ''))) not between 5 and 40 then
    raise exception 'invalid_customer' using errcode = '22023';
  end if;
  update public.customers
     set full_name = btrim(p_full_name), phone = btrim(p_phone),
         email = lower(btrim(coalesce(p_email, ''))),
         installation_address = btrim(coalesce(p_address, '')), updated_at = now()
   where id = p_customer_id and organization_id = p_organization_id;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'customer.updated', 'customer', p_customer_id, '{}'::jsonb);
end $$;

create or replace function public.delete_warrio_customer(p_organization_id uuid, p_customer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.organization_id = p_organization_id) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.warranties w where w.customer_id = p_customer_id and w.organization_id = p_organization_id) then
    raise exception 'customer_has_warranties' using errcode = '23503';
  end if;
  delete from public.customers where id = p_customer_id and organization_id = p_organization_id;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'customer.deleted', 'customer', p_customer_id, '{}'::jsonb);
end $$;

-- ---------- stock ----------
create or replace function public.update_warrio_stock_item(
  p_organization_id uuid, p_product_id uuid, p_model_id uuid, p_serial_number text,
  p_received_on date default null, p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  normalized text := upper(btrim(coalesce(p_serial_number, '')));
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.warrio_can_manage_stock(p_organization_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if normalized !~ '^[A-Z0-9][A-Z0-9._/-]{2,63}$' then raise exception 'invalid_serial' using errcode = '22023'; end if;
  if not exists (select 1 from public.product_models m where m.id = p_model_id and m.organization_id = p_organization_id) then
    raise exception 'model_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id and p.organization_id = p_organization_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.sales s where s.product_id = p_product_id) then
    raise exception 'product_already_sold' using errcode = '23503';
  end if;
  update public.products
     set model_id = p_model_id, serial_number = normalized,
         received_at = coalesce((p_received_on::timestamp at time zone 'Europe/Kyiv'), received_at),
         receive_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''), updated_at = now()
   where id = p_product_id and organization_id = p_organization_id;
  insert into public.product_events(organization_id, product_id, event_type, note, actor_user_id)
  values (p_organization_id, p_product_id, 'edited', null, caller);
end $$;

create or replace function public.delete_warrio_stock_item(p_organization_id uuid, p_product_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.warrio_can_manage_stock(p_organization_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id and p.organization_id = p_organization_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.sales s where s.product_id = p_product_id) then
    raise exception 'product_already_sold' using errcode = '23503';
  end if;
  delete from public.product_events where product_id = p_product_id and organization_id = p_organization_id;
  delete from public.products where id = p_product_id and organization_id = p_organization_id;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'stock.deleted', 'product', p_product_id, '{}'::jsonb);
end $$;

-- ---------- installations: planned job with number and executor ----------
alter table public.work_items
  add column if not exists item_no bigint generated by default as identity,
  add column if not exists executor_name text,
  add column if not exists executor_phone text,
  add column if not exists executor_company text;
create unique index if not exists work_items_item_no_key on public.work_items(item_no);

create or replace function public.plan_warrio_installation(
  p_organization_id uuid, p_warranty_id uuid, p_planned_for date default null,
  p_assigned_user_id uuid default null, p_executor_name text default null,
  p_executor_phone text default null, p_executor_company text default null, p_note text default ''
) returns table (work_item_id uuid, number bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  w_number text; w_sale uuid; new_id uuid; new_no bigint;
  ex_name text := nullif(btrim(coalesce(p_executor_name, '')), '');
  ex_phone text := nullif(btrim(coalesce(p_executor_phone, '')), '');
  ex_company text := nullif(btrim(coalesce(p_executor_company, '')), '');
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select w.warranty_number, w.sale_id into w_number, w_sale
    from public.warranties w where w.id = p_warranty_id and w.organization_id = p_organization_id;
  if w_number is null then raise exception 'warranty_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.installations i where i.warranty_id = p_warranty_id) then
    raise exception 'installation_already_exists' using errcode = '23505';
  end if;
  if exists (select 1 from public.work_items wi where wi.warranty_id = p_warranty_id
               and wi.item_type = 'installation' and wi.status in ('open','in_progress')) then
    raise exception 'installation_already_planned' using errcode = '23505';
  end if;
  if p_assigned_user_id is not null then
    if not exists (select 1 from public.organization_members m
                    where m.organization_id = p_organization_id and m.user_id = p_assigned_user_id
                      and m.is_active and m.role in ('installer','admin','owner')) then
      raise exception 'assignee_not_found' using errcode = 'P0002';
    end if;
    ex_name := null; ex_phone := null; ex_company := null;
  else
    if ex_name is null or char_length(ex_name) not between 2 and 120
       or ex_phone is null or char_length(ex_phone) not between 5 and 40 then
      raise exception 'executor_required' using errcode = '22023';
    end if;
  end if;
  insert into public.work_items(organization_id, title, description, item_type, status, priority, due_at,
                                sale_id, warranty_id, assigned_user_id, created_by,
                                executor_name, executor_phone, executor_company)
  values (p_organization_id, 'Монтаж ' || w_number, left(coalesce(btrim(p_note), ''), 2000), 'installation', 'open', 'normal',
          p_planned_for::timestamp at time zone 'Europe/Kyiv', w_sale, p_warranty_id, p_assigned_user_id, caller,
          ex_name, ex_phone, ex_company)
  returning id, item_no into new_id, new_no;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'installation.planned', 'work_item', new_id, jsonb_build_object('number', new_no));
  work_item_id := new_id; number := new_no; return next;
end $$;

create or replace function public.confirm_warrio_installation_item(
  p_organization_id uuid, p_work_item_id uuid, p_installed_on date default null, p_comment text default ''
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  it public.work_items%rowtype;
  serial text; who text;
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into it from public.work_items wi
   where wi.id = p_work_item_id and wi.organization_id = p_organization_id and wi.item_type = 'installation'
   for update;
  if it.id is null then raise exception 'work_item_not_found' using errcode = 'P0002'; end if;
  if it.status not in ('open','in_progress') then raise exception 'work_item_closed' using errcode = '22023'; end if;
  select p.serial_number into serial
    from public.warranties w
    join public.sales s on s.id = w.sale_id and s.organization_id = w.organization_id
    join public.products p on p.id = s.product_id and p.organization_id = s.organization_id
   where w.id = it.warranty_id and w.organization_id = p_organization_id;
  if serial is null then raise exception 'warranty_not_found' using errcode = 'P0002'; end if;
  select coalesce(nullif(btrim(pr.display_name), ''), it.executor_name, 'Монтажник') into who
    from (select 1) x left join public.profiles pr on pr.user_id = it.assigned_user_id;
  perform public.confirm_warrio_installation(
    p_organization_id, serial,
    coalesce(p_installed_on, (clock_timestamp() at time zone 'Europe/Kyiv')::date),
    coalesce(who, 'Монтажник'), coalesce(p_comment, ''));
  update public.work_items set status = 'done', completed_at = now(), updated_at = now() where id = it.id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'update_warrio_dealer(uuid,uuid,text,text,text,text,boolean)',
    'delete_warrio_dealer(uuid,uuid)',
    'update_warrio_customer(uuid,uuid,text,text,text,text)',
    'delete_warrio_customer(uuid,uuid)',
    'update_warrio_stock_item(uuid,uuid,uuid,text,date,text)',
    'delete_warrio_stock_item(uuid,uuid)',
    'plan_warrio_installation(uuid,uuid,date,uuid,text,text,text,text)',
    'confirm_warrio_installation_item(uuid,uuid,date,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
