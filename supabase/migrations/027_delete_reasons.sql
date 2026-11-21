-- Deleting a dealer, customer or stock item now requires a reason (min 5 characters),
-- stored in the audit journal together with the name of the deleted record.
drop function if exists public.delete_warrio_dealer(uuid, uuid);
drop function if exists public.delete_warrio_customer(uuid, uuid);
drop function if exists public.delete_warrio_stock_item(uuid, uuid);

create or replace function public.delete_warrio_dealer(p_organization_id uuid, p_dealer_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); result text := 'deleted'; dealer_name text; why text := btrim(coalesce(p_reason, ''));
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if char_length(why) < 5 or char_length(why) > 500 then raise exception 'reason_required' using errcode = '22023'; end if;
  select d.name into dealer_name from public.dealers d where d.id = p_dealer_id and d.organization_id = p_organization_id;
  if not found then raise exception 'dealer_not_found' using errcode = 'P0002'; end if;
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
  values (p_organization_id, caller, 'dealer.' || result, 'dealer', p_dealer_id,
          jsonb_build_object('reason', why, 'name', dealer_name));
  return result;
end $$;

create or replace function public.delete_warrio_customer(p_organization_id uuid, p_customer_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); cust_name text; why text := btrim(coalesce(p_reason, ''));
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.warrio_member_role[]) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if char_length(why) < 5 or char_length(why) > 500 then raise exception 'reason_required' using errcode = '22023'; end if;
  select c.full_name into cust_name from public.customers c where c.id = p_customer_id and c.organization_id = p_organization_id;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.warranties w where w.customer_id = p_customer_id and w.organization_id = p_organization_id) then
    raise exception 'customer_has_warranties' using errcode = '23503';
  end if;
  delete from public.customers where id = p_customer_id and organization_id = p_organization_id;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'customer.deleted', 'customer', p_customer_id,
          jsonb_build_object('reason', why, 'name', cust_name));
end $$;

create or replace function public.delete_warrio_stock_item(p_organization_id uuid, p_product_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare caller uuid := (select auth.uid()); sn text; why text := btrim(coalesce(p_reason, ''));
begin
  if caller is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.warrio_can_manage_stock(p_organization_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if char_length(why) < 5 or char_length(why) > 500 then raise exception 'reason_required' using errcode = '22023'; end if;
  select p.serial_number into sn from public.products p where p.id = p_product_id and p.organization_id = p_organization_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.sales s where s.product_id = p_product_id) then
    raise exception 'product_already_sold' using errcode = '23503';
  end if;
  delete from public.product_events where product_id = p_product_id and organization_id = p_organization_id;
  delete from public.products where id = p_product_id and organization_id = p_organization_id;
  insert into public.audit_events(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, caller, 'stock.deleted', 'product', p_product_id,
          jsonb_build_object('reason', why, 'serial_number', sn));
end $$;

revoke all on function public.delete_warrio_dealer(uuid, uuid, text) from public, anon;
revoke all on function public.delete_warrio_customer(uuid, uuid, text) from public, anon;
revoke all on function public.delete_warrio_stock_item(uuid, uuid, text) from public, anon;
grant execute on function public.delete_warrio_dealer(uuid, uuid, text) to authenticated;
grant execute on function public.delete_warrio_customer(uuid, uuid, text) to authenticated;
grant execute on function public.delete_warrio_stock_item(uuid, uuid, text) to authenticated;
