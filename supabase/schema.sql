-- Sales, Profit & Order-MIS schema. Run the whole file in Supabase > SQL Editor.
-- 1) Set your fixed admin email in handle_new_user() below (replace admin@example.com).
-- 2) Upgrading from the previous version? Run this FIRST (deletes old sales rows):
--      drop table public.sales cascade;
-- 3) Create the admin user in Authentication > Users with that same email.

-- ---------- Profiles / roles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin','user'))
);
create unique index if not exists one_admin on public.profiles (role) where role = 'admin';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when lower(new.email) = 'jyotsna@199702.com' then 'admin' else 'user' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());

-- ---------- Sales (raw data, admin-managed) ----------
-- Generated columns can't reference other generated columns, so totals repeat the units expression.
create table public.sales (
  id bigint generated always as identity primary key,
  date date not null,
  month date generated always as
    (make_date(extract(year from date)::int, extract(month from date)::int, 1)) stored,
  state text not null, zone text not null, town_city text not null,
  company text not null, client text not null,
  sku text not null, category text not null, print_type text not null,
  order_qty bigint not null check (order_qty >= 0),
  dispatch_qty bigint not null check (dispatch_qty >= 0),
  pending_qty bigint generated always as (order_qty - dispatch_qty) stored,
  entry_mode text not null check (entry_mode in ('direct','bundle')),
  units_sold bigint check (units_sold >= 0),
  bundles bigint check (bundles >= 0),
  units_per_bundle bigint check (units_per_bundle >= 0),
  total_units bigint generated always as
    (case when entry_mode = 'bundle' then bundles * units_per_bundle else units_sold end) stored,
  cost_price_per_unit numeric(12,2) not null check (cost_price_per_unit >= 0),
  selling_price_per_unit numeric(12,2) not null check (selling_price_per_unit >= 0),
  total_cost numeric(18,2) generated always as
    ((case when entry_mode = 'bundle' then bundles * units_per_bundle else units_sold end) * cost_price_per_unit) stored,
  total_selling numeric(18,2) generated always as
    ((case when entry_mode = 'bundle' then bundles * units_per_bundle else units_sold end) * selling_price_per_unit) stored,
  gross_profit numeric(18,2) generated always as
    ((case when entry_mode = 'bundle' then bundles * units_per_bundle else units_sold end)
      * (selling_price_per_unit - cost_price_per_unit)) stored,
  created_at timestamptz not null default now(),
  constraint dispatch_le_order check (dispatch_qty <= order_qty),
  constraint mode_fields check (
    (entry_mode = 'direct' and units_sold is not null) or
    (entry_mode = 'bundle' and bundles is not null and units_per_bundle is not null))
);
create index sales_date_idx on public.sales (date);
create index sales_state_idx on public.sales (state);

alter table public.sales enable row level security;
create policy "logged-in users read all" on public.sales for select to authenticated using (true);
create policy "admin insert" on public.sales for insert to authenticated with check (public.is_admin());
create policy "admin update" on public.sales for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete" on public.sales for delete to authenticated using (public.is_admin());

-- ---------- Live views (always computed from sales; security_invoker => RLS applies) ----------
-- Grain includes date + state so the app can filter by date range / state, then sum.
create or replace view public.v_sales_daily with (security_invoker = true) as
select date, state, zone, town_city, company, client,
  count(*)::bigint as record_count, sum(total_units)::bigint as total_units,
  sum(total_cost) as total_cost, sum(total_selling) as total_selling, sum(gross_profit) as gross_profit
from public.sales group by date, state, zone, town_city, company, client;

create or replace view public.v_party_mis with (security_invoker = true) as
select date, state, client, sum(order_qty)::bigint as order_qty, sum(dispatch_qty)::bigint as dispatch_qty, sum(pending_qty)::bigint as pending_qty
from public.sales group by date, state, client;
create or replace view public.v_sku_mis with (security_invoker = true) as
select date, state, sku, sum(order_qty)::bigint as order_qty, sum(dispatch_qty)::bigint as dispatch_qty, sum(pending_qty)::bigint as pending_qty
from public.sales group by date, state, sku;
create or replace view public.v_category_mis with (security_invoker = true) as
select date, state, category, sum(order_qty)::bigint as order_qty, sum(dispatch_qty)::bigint as dispatch_qty, sum(pending_qty)::bigint as pending_qty
from public.sales group by date, state, category;
create or replace view public.v_print_mis with (security_invoker = true) as
select date, state, print_type, sum(order_qty)::bigint as order_qty, sum(dispatch_qty)::bigint as dispatch_qty, sum(pending_qty)::bigint as pending_qty
from public.sales group by date, state, print_type;
create or replace view public.v_overall_mis with (security_invoker = true) as
select date, state, sum(order_qty)::bigint as order_qty, sum(dispatch_qty)::bigint as dispatch_qty, sum(pending_qty)::bigint as pending_qty
from public.sales group by date, state;

revoke all on public.v_sales_daily, public.v_party_mis, public.v_sku_mis, public.v_category_mis, public.v_print_mis, public.v_overall_mis from anon;
grant select on public.v_sales_daily, public.v_party_mis, public.v_sku_mis, public.v_category_mis, public.v_print_mis, public.v_overall_mis to authenticated;

create or replace function public.distinct_states() returns setof text
language sql stable as $$ select distinct state from public.sales order by 1 $$;

-- ---------- Share requests ----------
create table public.share_requests (
  id bigint generated always as identity primary key,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requester_email text,
  target_label text,
  target_type text not null check (target_type in ('internal_user','external_email')),
  target_value text not null,
  data_scope_type text not null check (data_scope_type in ('filtered_view','raw_export')),
  data_scope_filters jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint ext_email_ok check (target_type <> 'external_email' or target_value ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create or replace function public.share_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select email into new.requester_email from public.profiles where id = new.requested_by;
  if new.target_type = 'internal_user' then
    select email into new.target_label from public.profiles where id::text = new.target_value and role = 'user';
    if new.target_label is null then raise exception 'Unknown target user'; end if;
  else
    new.target_label := new.target_value;
  end if;
  return new;
end $$;
create trigger share_fill_trg before insert on public.share_requests
for each row execute function public.share_fill();

alter table public.share_requests enable row level security;
create policy "see own, admin sees all, target sees approved" on public.share_requests
  for select to authenticated using (
    requested_by = auth.uid() or public.is_admin()
    or (status = 'approved' and target_type = 'internal_user' and target_value = auth.uid()::text));
create policy "users create pending requests" on public.share_requests
  for insert to authenticated with check (
    requested_by = auth.uid() and status = 'pending' and resolved_at is null and not public.is_admin());
-- No update/delete policies: approve/deny only happens in the share-resolve Edge Function (service role).

-- Other users the requester can share with (id + email only).
create or replace function public.share_targets() returns table(id uuid, email text)
language sql stable security definer set search_path = public as $$
  select id, email from public.profiles where role = 'user' and id <> auth.uid() order by email
$$;
revoke execute on function public.share_targets() from public, anon;
grant execute on function public.share_targets() to authenticated;
