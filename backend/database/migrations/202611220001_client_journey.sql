create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  division text not null,
  description text not null default '',
  image_urls text[] not null default '{}',
  amount_kes integer not null check (amount_kes >= 0),
  status text not null default 'available'
    check (status in ('available', 'sold', 'booked', 'unavailable')),
  purchasable boolean not null default false,
  booking_kind text not null default 'none'
    check (booking_kind in ('none', 'car', 'short_stay')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null default 1 check (quantity between 1 and 20),
  booking_details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('YEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid not null references public.profiles(id),
  checkout_key uuid not null,
  status text not null default 'Pending payment'
    check (status in ('Pending payment', 'Placed', 'Confirmed', 'In progress', 'Completed', 'Cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  currency text not null default 'KES' check (currency = 'KES'),
  total_amount integer not null check (total_amount > 0),
  cancel_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checkout_key)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_amount integer not null check (unit_amount >= 0),
  booking_details jsonb not null default '{}'
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  user_id uuid not null references auth.users(id),
  provider text not null check (provider in ('mpesa', 'flutterwave')),
  reference text not null unique,
  provider_transaction_id text unique,
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'successful', 'failed', 'cancelled')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_pending_payment_per_order
  on public.payments(order_id) where status = 'pending';

create table if not exists public.saved_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.client_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.phone, '')
  )
  on conflict (id) do nothing;
  insert into public.carts (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.saved_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.client_alerts enable row level security;

create policy "Clients read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Clients update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Anyone reads available products" on public.products for select to anon, authenticated using (status = 'available' and purchasable = true);
create policy "Clients access own cart" on public.carts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Clients access own cart items" on public.cart_items for all to authenticated using (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
);
create policy "Clients read own orders" on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy "Clients read own order items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
);
create policy "Clients read own payments" on public.payments for select to authenticated using (user_id = (select auth.uid()));
create policy "Clients access own saved items" on public.saved_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Clients read own order timeline" on public.order_status_events for select to authenticated using (user_id = (select auth.uid()));
create policy "Clients read and update own alerts" on public.client_alerts for select to authenticated using (user_id = (select auth.uid()));
create policy "Clients mark own alerts read" on public.client_alerts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.order_status_events from anon, authenticated;

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_reference text,
  p_provider text,
  p_provider_transaction_id text,
  p_amount integer,
  p_metadata jsonb default '{}'
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or p_amount is null or v_order.total_amount <> p_amount then
    raise exception 'Order missing or amount mismatch';
  end if;

  select * into v_payment from public.payments where reference = p_reference for update;
  if not found or v_payment.order_id <> p_order_id or v_payment.provider <> p_provider
    or v_payment.amount <> p_amount or p_provider_transaction_id is null
    or length(trim(p_provider_transaction_id)) = 0 then
    raise exception 'Payment attempt missing';
  end if;
  if v_payment.status = 'successful' then
    return false;
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Payment attempt is no longer active';
  end if;
  if v_order.payment_status = 'paid' then
    return false;
  end if;

  update public.payments
  set status = 'successful',
      provider_transaction_id = p_provider_transaction_id,
      metadata = p_metadata,
      updated_at = now()
  where id = v_payment.id;

  update public.orders
  set status = 'Placed', payment_status = 'paid', updated_at = now()
  where id = p_order_id and payment_status <> 'paid';

  insert into public.order_status_events (order_id, user_id, status, note)
  values (p_order_id, v_order.user_id, 'Placed', 'Payment confirmed');
  insert into public.client_alerts (user_id, order_id, message)
  values (v_order.user_id, p_order_id, 'Payment received. Order ' || v_order.order_number || ' is placed.');
  delete from public.cart_items ci
  using public.carts c, public.order_items oi
  where ci.cart_id = c.id
    and c.user_id = v_order.user_id
    and oi.order_id = p_order_id
    and ci.product_id = oi.product_id;
  return true;
end;
$$;

create or replace function public.fail_order_payment(
  p_reference text,
  p_status text,
  p_metadata jsonb default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.payments
  set status = p_status, metadata = p_metadata, updated_at = now()
  where reference = p_reference and status = 'pending';
  update public.orders o
  set payment_status = p_status, updated_at = now()
  from public.payments p
  where p.reference = p_reference and p.order_id = o.id and o.payment_status <> 'paid';
end;
$$;

create or replace function public.mark_client_alert_read(p_alert_id uuid, p_user_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.client_alerts
  set read_at = now()
  where id = p_alert_id and user_id = p_user_id and p_user_id = auth.uid();
$$;

create or replace function public.update_client_order_status(
  p_order_id uuid,
  p_status text,
  p_staff_name text
) returns table(order_number text, user_id uuid, alert_message text)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_message text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('Completed', 'Cancelled') then
    raise exception 'Order is already in a final status';
  end if;
  if p_status = v_order.status then raise exception 'Order already has this status'; end if;
  if p_status = 'Cancelled' then
    v_message := 'Your cancellation for order ' || v_order.order_number || ' has been approved.';
  else
    if v_order.payment_status <> 'paid' then
      raise exception 'A pending payment order cannot move to fulfilment';
    end if;
    if not (
      (v_order.status = 'Placed' and p_status = 'Confirmed') or
      (v_order.status = 'Confirmed' and p_status = 'In progress') or
      (v_order.status = 'In progress' and p_status = 'Completed')
    ) then
      raise exception 'Invalid order status transition';
    end if;
    v_message := 'Order ' || v_order.order_number || ' is now ' || lower(p_status) || '.';
  end if;
  if p_status not in ('Confirmed', 'In progress', 'Completed', 'Cancelled') then
    raise exception 'Invalid order status';
  end if;

  update public.orders
  set status = p_status, updated_at = now()
  where id = p_order_id;
  insert into public.order_status_events (order_id, user_id, status, note)
  values (
    p_order_id, v_order.user_id, p_status,
    case when p_status = 'Cancelled' then 'Cancellation approved by Youamy staff' else 'Status updated by ' || p_staff_name end
  );
  insert into public.client_alerts (user_id, order_id, message)
  values (v_order.user_id, p_order_id, v_message);
  return query select v_order.order_number, v_order.user_id, v_message;
end;
$$;

create or replace function public.create_checkout_order(
  p_user_id uuid,
  p_checkout_key uuid,
  p_items jsonb
) returns table(order_id uuid, order_number text, total_amount integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_total integer := 0;
  v_item_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and status = 'available' and purchasable = true
    for share;
    if not found then raise exception 'A cart item is unavailable'; end if;
    v_item_count := coalesce((v_item ->> 'quantity')::integer, 1);
    if v_item_count < 1 or v_item_count > 20 then raise exception 'Invalid quantity'; end if;
    v_total := v_total + v_product.amount_kes * v_item_count;
  end loop;

  if v_total <= 0 then raise exception 'Order total must be positive'; end if;

  insert into public.orders (user_id, checkout_key, total_amount)
  values (p_user_id, p_checkout_key, v_total)
  on conflict (user_id, checkout_key) do nothing;

  select * into v_order from public.orders
  where user_id = p_user_id and checkout_key = p_checkout_key
  for update;

  if v_order.payment_status = 'paid' then
    return query select v_order.id, v_order.order_number, v_order.total_amount;
    return;
  end if;

  if not exists (select 1 from public.order_items where order_items.order_id = v_order.id) then
    for v_item in select * from jsonb_array_elements(p_items) loop
      select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and status = 'available' and purchasable = true;
      insert into public.order_items (order_id, product_id, title, quantity, unit_amount, booking_details)
      values (
        v_order.id,
        v_product.id,
        v_product.title,
        coalesce((v_item ->> 'quantity')::integer, 1),
        v_product.amount_kes,
        coalesce(v_item -> 'booking_details', '{}')
      );
    end loop;
  elsif v_order.payment_status = 'pending' then
    select coalesce(sum(unit_amount * quantity), 0) into v_total
    from public.order_items where order_items.order_id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number, v_order.total_amount;
end;
$$;

revoke all on function public.confirm_order_payment(uuid, text, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.fail_order_payment(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_checkout_order(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_client_order_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text, text, text, integer, jsonb) to service_role;
grant execute on function public.fail_order_payment(text, text, jsonb) to service_role;
grant execute on function public.create_checkout_order(uuid, uuid, jsonb) to service_role;
grant execute on function public.update_client_order_status(uuid, text, text) to service_role;
revoke update on public.client_alerts from anon, authenticated;
revoke all on function public.mark_client_alert_read(uuid, uuid) from public, anon;
grant execute on function public.mark_client_alert_read(uuid, uuid) to authenticated, service_role;
