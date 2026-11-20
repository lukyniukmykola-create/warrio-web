-- Fix: update_warrio_stock_item (025) writes product_events.event_type = 'edited',
-- which the check constraint did not allow, so editing a stock item failed.
-- Found by supabase/tests/security_isolation_rpc025.sql.
alter table public.product_events drop constraint if exists product_event_type_valid;
alter table public.product_events add constraint product_event_type_valid check (event_type in (
  'received', 'sold', 'warranty_issued', 'service_opened', 'service_closed', 'written_off', 'edited'));
