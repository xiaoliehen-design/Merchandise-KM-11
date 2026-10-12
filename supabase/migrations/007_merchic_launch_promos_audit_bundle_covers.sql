-- Merchic / KM11 : run AFTER migration 006, once in your production Supabase SQL Editor.
-- Additive migration: no existing orders, products, bundles, or admins are deleted.
begin;

alter table public.product_bundles add column if not exists cover_image_url text;
alter table public.product_bundles add column if not exists cover_image_path text;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,40}$'),
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  amount numeric(14,2) not null check (amount > 0),
  min_order_amount numeric(14,2) not null default 0 check (min_order_amount >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_dates check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint promo_percent check (discount_type <> 'percent' or amount <= 100)
);
create index if not exists idx_promo_code_active on public.promo_codes(code,active);
drop trigger if exists trg_promo_updated on public.promo_codes;
create trigger trg_promo_updated before update on public.promo_codes for each row execute function public.set_updated_at();
alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon,authenticated;
grant all on public.promo_codes to service_role;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admins(id) on delete set null,
  admin_username text not null,
  method text not null,
  action text not null,
  resource text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_log_time on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_log_admin on public.admin_audit_logs(admin_id,created_at desc);
alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon,authenticated;
grant all on public.admin_audit_logs to service_role;

alter table public.orders add column if not exists launch_discount numeric(14,2) not null default 0 check (launch_discount>=0);
alter table public.orders add column if not exists volume_discount numeric(14,2) not null default 0 check (volume_discount>=0);
alter table public.orders add column if not exists promo_discount numeric(14,2) not null default 0 check (promo_discount>=0);
alter table public.orders add column if not exists promo_code text;

insert into public.app_settings(key,value) values
  ('launch_enabled','true'),('launch_standard_percent','15'),('launch_bundle_percent','20'),('launch_end_at','')
on conflict(key) do nothing;

create or replace function public.create_order_atomic(p_order jsonb, p_items jsonb)
returns table(order_id uuid, receipt_no text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_receipt text;
  v_item jsonb;
  v_line_index integer := 0;
  v_pickup_name text;
  v_pickup_address text;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
begin
  v_receipt := 'KM11-' || to_char(now() at time zone 'Asia/Jakarta','YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  if p_order->>'fulfillment_type' = 'pickup' then
    select l.name,l.address,s.starts_at,s.ends_at
      into v_pickup_name,v_pickup_address,v_slot_start,v_slot_end
    from public.pickup_locations l
    join public.pickup_slots s on s.location_id=l.id
    where l.id=(p_order->>'pickup_location_id')::uuid
      and s.id=(p_order->>'pickup_slot_id')::uuid
      and l.active=true and s.active=true;
    if v_pickup_name is null then raise exception 'Pickup slot tidak tersedia'; end if;
  end if;

  insert into public.orders(
    id,receipt_no,status,full_name,email,phone,address,fulfillment_type,
    pickup_location_id,pickup_slot_id,pickup_location_name,pickup_location_address,pickup_slot_starts_at,pickup_slot_ends_at,
    shipping_destination_id,shipping_destination_label,shipping_courier,shipping_service,shipping_cost,
    subtotal,launch_discount,volume_discount,promo_discount,promo_code,total,payment_method_id,payment_method_name,payment_upload_token_hash
  ) values (
    v_id,v_receipt,'new',p_order->>'full_name',p_order->>'email',p_order->>'phone',nullif(p_order->>'address',''),(p_order->>'fulfillment_type')::public.fulfillment_type,
    nullif(p_order->>'pickup_location_id','')::uuid,nullif(p_order->>'pickup_slot_id','')::uuid,v_pickup_name,v_pickup_address,v_slot_start,v_slot_end,
    nullif(p_order->>'shipping_destination_id',''),nullif(p_order->>'shipping_destination_label',''),nullif(p_order->>'shipping_courier',''),nullif(p_order->>'shipping_service',''),coalesce((p_order->>'shipping_cost')::numeric,0),
    (p_order->>'subtotal')::numeric,coalesce((p_order->>'launch_discount')::numeric,0),coalesce((p_order->>'volume_discount')::numeric,0),coalesce((p_order->>'promo_discount')::numeric,0),nullif(p_order->>'promo_code',''),(p_order->>'total')::numeric,(p_order->>'payment_method_id')::uuid,p_order->>'payment_method_name',nullif(p_order->>'payment_upload_token_hash','')
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items(order_id,product_id,product_name,variant_color,variant_size,unit_price,quantity,line_total,checkout_line_index)
    values(v_id,(v_item->>'product_id')::uuid,v_item->>'product_name',nullif(v_item->>'variant_color',''),nullif(v_item->>'variant_size',''),(v_item->>'unit_price')::numeric,(v_item->>'quantity')::int,(v_item->>'line_total')::numeric,v_line_index);
    v_line_index := v_line_index + 1;
  end loop;

  insert into public.order_status_history(order_id,status,note) values(v_id,'new','Order dibuat');
  return query select v_id,v_receipt;
end $$;

revoke all on function public.create_order_atomic(jsonb,jsonb) from anon,authenticated;
grant execute on function public.create_order_atomic(jsonb,jsonb) to service_role;
commit;
notify pgrst,'reload schema';
