-- Warrio security test: tenant isolation (RLS), role checks, anon denial and
-- functional checks for RPCs from migration 025.
--
-- Safe to run on production: everything runs in one DO block that creates its own
-- test users/orgs and ends with RAISE EXCEPTION 'TESTOUT ...', which rolls back all
-- changes. The report is in the error message. Any line starting with FAIL is a defect.
-- Run in the Supabase SQL editor (role postgres).

do $t$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  oa uuid; ob uuid; ma uuid; mb uuid; d1 uuid; d2 uuid; db uuid;
  pid1 uuid; pid2 uuid; pid3 uuid; wid uuid; cid uuid; wi uuid; sid uuid;
  tag text := 'zz' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  res text := ''; s text; t text; fails int; passes int;
begin
  create function pg_temp.t_run(label text, uid uuid, rl text, q text, mode text)
  returns text language plpgsql as $f$
  declare n bigint;
  begin
    perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'role', rl)::text end, true);
    perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
    execute format('set local role %I', rl);
    begin
      execute 'select count(*) from (' || q || ') x' into n;
      execute 'reset role';
    exception when others then
      execute 'reset role';
      return case mode
        when 'ok' then 'FAIL: ' || label || ' -> ' || left(sqlerrm, 120)
        when 'deny' then 'PASS: ' || label || ' (error: ' || left(sqlerrm, 50) || ')'
        when 'err' then 'PASS: ' || label || ' (' || left(sqlerrm, 50) || ')'
        when 'pos' then 'FAIL: ' || label || ' -> ' || left(sqlerrm, 120)
      end;
    end;
    return case mode
      when 'ok' then 'PASS: ' || label
      when 'err' then 'FAIL(no error): ' || label
      when 'deny' then case when n = 0 then 'PASS: ' || label || ' (0 rows)' else 'FAIL(allowed, rows=' || n || '): ' || label end
      when 'pos' then case when n > 0 then 'PASS: ' || label else 'FAIL(0 rows): ' || label end
    end;
  end $f$;

  insert into auth.users(id, aud, role, email) values
    (ua, 'authenticated', 'authenticated', tag || 'a@test.invalid'),
    (ub, 'authenticated', 'authenticated', tag || 'b@test.invalid'),
    (uc, 'authenticated', 'authenticated', tag || 'c@test.invalid');

  -- ===== setup =====
  res := res || pg_temp.t_run('setup: A creates org', ua, 'authenticated', format('select public.create_warrio_organization(%L,%L)', tag || ' A', tag || '-a'), 'ok') || E'\n';
  res := res || pg_temp.t_run('setup: B creates org', ub, 'authenticated', format('select public.create_warrio_organization(%L,%L)', tag || ' B', tag || '-b'), 'ok') || E'\n';
  select id into oa from public.organizations where slug = tag || '-a';
  select id into ob from public.organizations where slug = tag || '-b';
  res := res || pg_temp.t_run('setup: A model', ua, 'authenticated', format('select public.manage_warrio_product_model(%L, NULL::uuid, %L, %L, 24, true)', oa, 'TST1', 'Test model'), 'ok') || E'\n';
  res := res || pg_temp.t_run('setup: B model', ub, 'authenticated', format('select public.manage_warrio_product_model(%L, NULL::uuid, %L, %L, 24, true)', ob, 'TST1', 'Test model'), 'ok') || E'\n';
  select id into ma from public.product_models where organization_id = oa and code = 'TST1';
  select id into mb from public.product_models where organization_id = ob and code = 'TST1';
  insert into public.dealers(organization_id, code, name) values (oa, 'ZD1', 'Dealer One') returning id into d1;
  insert into public.dealers(organization_id, code, name) values (oa, 'ZD2', 'Dealer Two') returning id into d2;
  insert into public.dealers(organization_id, code, name) values (ob, 'ZDB', 'Dealer B') returning id into db;
  res := res || pg_temp.t_run('setup: A stock', ua, 'authenticated', format('select public.receive_warrio_stock(%L, %L, array[%L,%L,%L], %L)', oa, ma, 'ZZ-A-0001', 'ZZ-A-0002', 'ZZ-A-0003', 'n'), 'ok') || E'\n';
  res := res || pg_temp.t_run('setup: B stock', ub, 'authenticated', format('select public.receive_warrio_stock(%L, %L, array[%L], %L)', ob, mb, 'ZZ-B-0001', 'n'), 'ok') || E'\n';
  select id into pid1 from public.products where organization_id = oa and serial_number = 'ZZ-A-0001';
  select id into pid2 from public.products where organization_id = oa and serial_number = 'ZZ-A-0002';
  select id into pid3 from public.products where organization_id = oa and serial_number = 'ZZ-A-0003';
  res := res || pg_temp.t_run('setup: A sale', ua, 'authenticated', format('select public.register_warrio_sale(%L, %L, %L, %L, NULL, current_date)', oa, 'ZZ-A-0001', 'TST1', d1), 'ok') || E'\n';
  res := res || pg_temp.t_run('setup: A activation', ua, 'authenticated', format('select public.activate_warrio_warranty(%L, %L, %L, %L, %L, %L)', oa, 'ZZ-A-0001', 'Test Buyer', '+380501112233', 'buyer@test.invalid', 'Kyiv, Test St 1'), 'ok') || E'\n';
  select w.id, w.customer_id into wid, cid from public.warranties w where w.organization_id = oa limit 1;
  select id into sid from public.sales where organization_id = oa limit 1;
  insert into public.organization_members(organization_id, user_id, role) values (oa, uc, 'dealer');
  res := res || pg_temp.t_run('plan installation (owner A)', ua, 'authenticated', format('select * from public.plan_warrio_installation(%L, %L, current_date + 1, NULL, %L, %L, %L, %L)', oa, wid, 'Ivan', '+380501234567', 'Firm', 'n'), 'ok') || E'\n';
  select id into wi from public.work_items where warranty_id = wid and item_type = 'installation' order by created_at desc limit 1;

  -- ===== positive controls (tests are not vacuous) =====
  res := res || pg_temp.t_run('control: A sees own products', ua, 'authenticated', format('select 1 from public.products where organization_id = %L', oa), 'pos') || E'\n';
  res := res || pg_temp.t_run('control: B sees own products', ub, 'authenticated', format('select 1 from public.products where organization_id = %L', ob), 'pos') || E'\n';

  -- ===== tenant isolation: B must see nothing of A =====
  foreach t in array array['products','sales','dealers','customers','product_models','warranties','installations','work_items','audit_events','service_requests','email_jobs','organization_members','product_events','warranty_documents'] loop
    res := res || pg_temp.t_run('B cannot read ' || t || ' of A', ub, 'authenticated', format('select 1 from public.%I where organization_id = %L', t, oa), 'deny') || E'\n';
  end loop;
  res := res || pg_temp.t_run('B cannot read org A', ub, 'authenticated', format('select 1 from public.organizations where id = %L', oa), 'deny') || E'\n';
  res := res || pg_temp.t_run('B cannot read profile of A user', ub, 'authenticated', format('select 1 from public.profiles where user_id = %L', ua), 'deny') || E'\n';

  -- ===== tenant isolation: B calling RPCs against org A =====
  foreach s in array array[
    format('select * from public.get_warrio_stock(%L, NULL, NULL, 50)', oa),
    format('select public.get_warrio_product_history(%L)', pid1),
    format('select public.receive_warrio_stock(%L, %L, array[%L], %L)', oa, ma, 'ZZ-X-0001', 'n'),
    format('select public.register_warrio_sale(%L, %L, %L, %L, NULL, current_date)', oa, 'ZZ-A-0002', 'TST1', d1),
    format('select public.update_warrio_dealer(%L, %L, %L, %L, NULL, NULL, true)', oa, d2, 'hack', 'ZHK'),
    format('select public.delete_warrio_dealer(%L, %L)', oa, d2),
    format('select public.update_warrio_customer(%L, %L, %L, NULL, NULL, NULL)', oa, cid, 'hack'),
    format('select public.delete_warrio_customer(%L, %L)', oa, cid),
    format('select public.update_warrio_stock_item(%L, %L, %L, %L, current_date, %L)', oa, pid2, ma, 'ZZ-A-9999', 'x'),
    format('select public.delete_warrio_stock_item(%L, %L)', oa, pid3),
    format('select public.write_off_warrio_stock_item(%L, %L)', pid3, 'x'),
    format('select * from public.plan_warrio_installation(%L, %L, current_date, NULL, %L, %L, %L, %L)', oa, wid, 'x', '1', 'x', 'x'),
    format('select public.confirm_warrio_installation_item(%L, %L, current_date, %L)', oa, wi, 'x'),
    format('select public.confirm_warrio_installation(%L, %L, current_date, %L, %L)', oa, 'ZZ-A-0001', 'x', 'x'),
    format('select public.create_warrio_work_item(%L, %L, NULL, %L::public.warrio_work_item_type, %L::public.warrio_work_item_priority, NULL, NULL, NULL, NULL)', oa, 'x', 'follow_up', 'normal'),
    format('select public.update_warrio_organization_settings(%L, %L, NULL, NULL, NULL, NULL)', oa, 'hack'),
    format('select public.set_warrio_access_settings(%L, true, true)', oa),
    format('select public.update_warrio_warranty_policy(%L, %L, false)', oa, 'sale_date'),
    format('select public.issue_warrio_activation_token(%L, %L)', oa, sid),
    format('select public.manage_warrio_product_model(%L, NULL::uuid, %L, %L, 1, true)', oa, 'HK', 'h'),
    format('select public.create_warrio_telegram_link_code(%L)', oa),
    format('select public.archive_warrio_record(%L, %L, %L, %L)', oa, 'sale', sid, 'x'),
    'select * from public.get_warrio_platform_overview()'
  ] loop
    res := res || pg_temp.t_run('B denied: ' || left(s, 70), ub, 'authenticated', s, 'deny') || E'\n';
  end loop;

  -- ===== direct DML =====
  res := res || pg_temp.t_run('B cannot update dealer of A', ub, 'authenticated', format('with w as (update public.dealers set name = %L where organization_id = %L returning 1) select * from w', 'hack', oa), 'deny') || E'\n';
  res := res || pg_temp.t_run('B cannot insert dealer into A', ub, 'authenticated', format('with w as (insert into public.dealers(organization_id, code, name) values (%L, %L, %L) returning 1) select * from w', oa, 'HK', 'h'), 'deny') || E'\n';
  res := res || pg_temp.t_run('A cannot move dealer to org B', ua, 'authenticated', format('with w as (update public.dealers set organization_id = %L where id = %L returning 1) select * from w', ob, d2), 'deny') || E'\n';
  res := res || pg_temp.t_run('A cannot move product to org B', ua, 'authenticated', format('with w as (update public.products set organization_id = %L where id = %L returning 1) select * from w', ob, pid3), 'deny') || E'\n';
  res := res || pg_temp.t_run('B cannot update profile of A', ub, 'authenticated', format('with w as (update public.profiles set display_name = %L where user_id = %L returning 1) select * from w', 'hack', ua), 'deny') || E'\n';
  res := res || pg_temp.t_run('B cannot add itself to org A', ub, 'authenticated', format('with w as (insert into public.organization_members(organization_id, user_id, role) values (%L, %L, %L) returning 1) select * from w', oa, ub, 'owner'), 'deny') || E'\n';
  res := res || pg_temp.t_run('dealer C cannot promote itself', uc, 'authenticated', format('with w as (update public.organization_members set role = %L where user_id = %L returning 1) select * from w', 'owner', uc), 'deny') || E'\n';

  -- ===== anon and service-only functions =====
  foreach t in array array['products','sales','customers','warranties','organizations','organization_members','audit_events','dealers'] loop
    res := res || pg_temp.t_run('anon cannot read ' || t, null, 'anon', format('select 1 from public.%I', t), 'deny') || E'\n';
  end loop;
  foreach s in array array[
    'select * from public.claim_warrio_notifications(5)',
    'select public.finish_warrio_notification(1, NULL)',
    format('select * from public.get_warrio_stock(%L, NULL, NULL, 5)', oa),
    format('select public.update_warrio_dealer(%L, %L, %L, %L, NULL, NULL, true)', oa, d2, 'hack', 'ZHK'),
    format('select public.delete_warrio_stock_item(%L, %L)', oa, pid3)
  ] loop
    res := res || pg_temp.t_run('anon denied: ' || left(s, 60), null, 'anon', s, 'deny') || E'\n';
  end loop;
  foreach s in array array[
    'select * from public.claim_warrio_notifications(5)',
    'select public.finish_warrio_notification(1, NULL)',
    format('select * from public.redeem_warrio_telegram_code(%L, 1, %L)', 'ABCDEFGH', 'x')
  ] loop
    res := res || pg_temp.t_run('authenticated denied (service-only): ' || left(s, 50), ub, 'authenticated', s, 'deny') || E'\n';
  end loop;

  -- ===== role checks: dealer member of A =====
  foreach s in array array[
    format('select public.delete_warrio_stock_item(%L, %L)', oa, pid3),
    format('select public.update_warrio_stock_item(%L, %L, %L, %L, current_date, %L)', oa, pid2, ma, 'ZZ-A-9998', 'x'),
    format('select public.receive_warrio_stock(%L, %L, array[%L], %L)', oa, ma, 'ZZ-X-0002', 'n'),
    format('select public.delete_warrio_dealer(%L, %L)', oa, d2),
    format('select public.update_warrio_dealer(%L, %L, %L, %L, NULL, NULL, true)', oa, d2, 'hack', 'ZHK'),
    format('select public.update_warrio_customer(%L, %L, %L, NULL, NULL, NULL)', oa, cid, 'hack'),
    format('select public.delete_warrio_customer(%L, %L)', oa, cid),
    format('select * from public.plan_warrio_installation(%L, %L, current_date, NULL, %L, %L, %L, %L)', oa, wid, 'x', '1', 'x', 'x'),
    format('select public.update_warrio_organization_settings(%L, %L, NULL, NULL, NULL, NULL)', oa, 'hack'),
    format('select public.set_warrio_access_settings(%L, true, true)', oa),
    format('select public.manage_warrio_product_model(%L, NULL::uuid, %L, %L, 1, true)', oa, 'HK', 'h')
  ] loop
    res := res || pg_temp.t_run('dealer role denied: ' || left(s, 60), uc, 'authenticated', s, 'deny') || E'\n';
  end loop;

  -- ===== functional checks of migration 025 (owner A) =====
  res := res || pg_temp.t_run('update_warrio_dealer', ua, 'authenticated', format('select public.update_warrio_dealer(%L, %L, %L, %L, NULL, NULL, true)', oa, d2, 'Dealer Two B', 'ZD2B'), 'ok') || E'\n';
  select name into s from public.dealers where id = d2;
  res := res || case when s = 'Dealer Two B' then 'PASS' else 'FAIL' end || ': dealer name changed' || E'\n';
  res := res || pg_temp.t_run('delete_warrio_dealer (no sales)', ua, 'authenticated', format('select public.delete_warrio_dealer(%L, %L)', oa, d2), 'ok') || E'\n';
  res := res || case when not exists (select 1 from public.dealers where id = d2) then 'PASS' else 'FAIL' end || ': dealer without sales deleted' || E'\n';
  res := res || pg_temp.t_run('delete_warrio_dealer (with sales)', ua, 'authenticated', format('select public.delete_warrio_dealer(%L, %L)', oa, d1), 'ok') || E'\n';
  res := res || case when exists (select 1 from public.dealers where id = d1 and not is_active) then 'PASS' else 'FAIL' end || ': dealer with sales deactivated, not deleted' || E'\n';
  res := res || pg_temp.t_run('delete sold stock blocked', ua, 'authenticated', format('select public.delete_warrio_stock_item(%L, %L)', oa, pid1), 'err') || E'\n';
  res := res || pg_temp.t_run('edit sold stock blocked', ua, 'authenticated', format('select public.update_warrio_stock_item(%L, %L, %L, %L, current_date, %L)', oa, pid1, ma, 'ZZ-A-7777', 'x'), 'err') || E'\n';
  res := res || pg_temp.t_run('update_warrio_stock_item', ua, 'authenticated', format('select public.update_warrio_stock_item(%L, %L, %L, %L, current_date, %L)', oa, pid2, ma, 'ZZ-A-0002B', 'n'), 'ok') || E'\n';
  res := res || case when exists (select 1 from public.products where id = pid2 and serial_number = 'ZZ-A-0002B') then 'PASS' else 'FAIL' end || ': stock serial changed' || E'\n';
  res := res || pg_temp.t_run('delete_warrio_stock_item (unsold)', ua, 'authenticated', format('select public.delete_warrio_stock_item(%L, %L)', oa, pid3), 'ok') || E'\n';
  res := res || case when not exists (select 1 from public.products where id = pid3) then 'PASS' else 'FAIL' end || ': unsold stock deleted' || E'\n';
  res := res || case when exists (select 1 from public.work_items where id = wi and item_no is not null and executor_name = 'Ivan' and executor_company = 'Firm') then 'PASS' else 'FAIL' end || ': planned installation has number and executor' || E'\n';
  res := res || pg_temp.t_run('plan installation twice blocked', ua, 'authenticated', format('select * from public.plan_warrio_installation(%L, %L, current_date + 2, NULL, %L, %L, %L, %L)', oa, wid, 'Ivan', '+380501234567', 'Firm', 'n'), 'err') || E'\n';
  res := res || pg_temp.t_run('confirm_warrio_installation_item', ua, 'authenticated', format('select public.confirm_warrio_installation_item(%L, %L, current_date, %L)', oa, wi, 'ok'), 'ok') || E'\n';
  res := res || case when exists (select 1 from public.work_items where id = wi and status = 'done') then 'PASS' else 'FAIL' end || ': work item closed after confirmation' || E'\n';
  res := res || case when exists (select 1 from public.installations where warranty_id = wid) then 'PASS' else 'FAIL' end || ': installation recorded' || E'\n';
  res := res || pg_temp.t_run('confirm installation twice blocked', ua, 'authenticated', format('select public.confirm_warrio_installation_item(%L, %L, current_date, %L)', oa, wi, 'ok'), 'err') || E'\n';
  res := res || pg_temp.t_run('delete customer with warranty blocked', ua, 'authenticated', format('select public.delete_warrio_customer(%L, %L)', oa, cid), 'err') || E'\n';
  res := res || pg_temp.t_run('update_warrio_customer', ua, 'authenticated', format('select public.update_warrio_customer(%L, %L, %L, %L, %L, %L)', oa, cid, 'New Name', '+380509998877', 'new@test.invalid', 'Lviv'), 'ok') || E'\n';
  res := res || case when exists (select 1 from public.customers where id = cid and full_name = 'New Name') then 'PASS' else 'FAIL' end || ': customer updated' || E'\n';

  select count(*) filter (where l like 'FAIL%'), count(*) filter (where l like 'PASS%') into fails, passes from unnest(string_to_array(res, E'\n')) l;
  raise exception E'TESTOUT passes=% fails=%\n%', passes, fails, res;
end
$t$;
