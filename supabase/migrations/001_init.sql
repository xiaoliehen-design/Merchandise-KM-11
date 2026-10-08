-- KM11 Merchandise - initial schema
-- Run in Supabase SQL editor or with Supabase CLI.

create extension if not exists pgcrypto;

create type public.order_status as enum ('new','verified','shipped','completed');
create type public.fulfillment_type as enum ('ship','pickup');
create type public.payment_type as enum ('bank_transfer','qris','other');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  username_lower text generated always as (lower(username)) stored unique,
  auth_email text not null unique,
  auth_user_id uuid unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(14,2) not null check (base_price >= 0),
  weight_grams integer not null default 500 check (weight_grams > 0),
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  specifications jsonb not null default '{}'::jsonb,
  image_path text,
  image_url text,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pickup_slots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.pickup_locations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pickup_slot_valid_time check (ends_at > starts_at)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.payment_type not null default 'bank_transfer',
  account_name text,
  account_number text,
  instructions text,
  qr_image_path text,
  qr_image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.anonymous_carts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  ip_hash text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  status public.order_status not null default 'new',
  full_name text not null,
  email text not null,
  phone text not null,
  address text,
  fulfillment_type public.fulfillment_type not null,
  pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  pickup_slot_id uuid references public.pickup_slots(id) on delete set null,
  pickup_location_name text,
  pickup_location_address text,
  pickup_slot_starts_at timestamptz,
  pickup_slot_ends_at timestamptz,
  shipping_destination_id text,
  shipping_destination_label text,
  shipping_courier text,
  shipping_service text,
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  payment_method_name text not null,
  payment_proof_path text,
  payment_upload_token_hash text,
  verified_at timestamptz,
  verified_by uuid references public.admins(id) on delete set null,
  tracking_number text,
  tracking_courier text,
  shipped_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fulfillment_fields check (
    (fulfillment_type = 'ship' and address is not null)
    or (fulfillment_type = 'pickup')
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  variant_color text,
  variant_size text,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create index idx_products_active on public.products(active, featured);
create index idx_pickup_slots_location_time on public.pickup_slots(location_id, starts_at);
create index idx_orders_status_created on public.orders(status, created_at desc);
create index idx_orders_receipt on public.orders(receipt_no);
create index idx_orders_tracking on public.orders(tracking_number) where tracking_number is not null;
create index idx_order_items_order on public.order_items(order_id);
create index idx_carts_updated on public.anonymous_carts(updated_at);

create trigger trg_admins_updated before update on public.admins for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger trg_pickup_locations_updated before update on public.pickup_locations for each row execute function public.set_updated_at();
create trigger trg_payment_methods_updated before update on public.payment_methods for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();

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
    subtotal,total,payment_method_id,payment_method_name,payment_upload_token_hash
  ) values (
    v_id,v_receipt,'new',p_order->>'full_name',p_order->>'email',p_order->>'phone',nullif(p_order->>'address',''),(p_order->>'fulfillment_type')::public.fulfillment_type,
    nullif(p_order->>'pickup_location_id','')::uuid,nullif(p_order->>'pickup_slot_id','')::uuid,v_pickup_name,v_pickup_address,v_slot_start,v_slot_end,
    nullif(p_order->>'shipping_destination_id',''),nullif(p_order->>'shipping_destination_label',''),nullif(p_order->>'shipping_courier',''),nullif(p_order->>'shipping_service',''),coalesce((p_order->>'shipping_cost')::numeric,0),
    (p_order->>'subtotal')::numeric,(p_order->>'total')::numeric,(p_order->>'payment_method_id')::uuid,p_order->>'payment_method_name',nullif(p_order->>'payment_upload_token_hash','')
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items(order_id,product_id,product_name,variant_color,variant_size,unit_price,quantity,line_total)
    values(v_id,(v_item->>'product_id')::uuid,v_item->>'product_name',nullif(v_item->>'variant_color',''),nullif(v_item->>'variant_size',''),(v_item->>'unit_price')::numeric,(v_item->>'quantity')::int,(v_item->>'line_total')::numeric);
  end loop;

  insert into public.order_status_history(order_id,status,note) values(v_id,'new','Order dibuat');
  return query select v_id,v_receipt;
end $$;

-- Only the Worker (service role) is allowed to access these tables directly.
alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.pickup_slots enable row level security;
alter table public.payment_methods enable row level security;
alter table public.anonymous_carts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.app_settings enable row level security;

-- Revoke direct anonymous/authenticated access. Service role bypasses RLS.
revoke all on all tables in schema public from anon, authenticated;
revoke all on function public.create_order_atomic(jsonb,jsonb) from anon, authenticated;
grant execute on function public.create_order_atomic(jsonb,jsonb) to service_role;

-- Storage buckets. Product/payment QR are public; payment proofs stay private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('payment-assets','payment-assets',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.app_settings(key,value) values
 ('shipping_origin_id',''),
 ('shipping_origin_label',''),
 ('shipping_couriers','jne:sicepat:jnt:ninja:tiki:anteraja:pos')
on conflict (key) do nothing;

-- Inactive demo records based on the provided KM11 umbrella references.
insert into public.products(name,slug,description,base_price,weight_grams,colors,sizes,image_url,active,featured)
values
 ('Payung KM11 Biru','payung-km11-biru','Contoh produk. Atur harga/spesifikasi lalu aktifkan dari dashboard admin.',0,500,array['Biru'],array[]::text[],'/theme/payung-biru.png',false,true),
 ('Payung KM11 Putih','payung-km11-putih','Contoh produk. Atur harga/spesifikasi lalu aktifkan dari dashboard admin.',0,500,array['Putih'],array[]::text[],'/theme/payung-putih.png',false,true)
on conflict (slug) do nothing;

-- E-money customization support
alter table public.products add column if not exists product_type text not null default 'standard';
alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check check (product_type in ('standard','emoney_card'));

alter table public.order_items add column if not exists customization jsonb not null default '{}'::jsonb;
alter table public.order_items add column if not exists design_image_path text;
alter table public.order_items add column if not exists design_image_url text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('design-assets','design-assets',true,5242880,array['image/png'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

update public.products set product_type='standard' where product_type is null;

insert into public.products(name,slug,description,base_price,weight_grams,colors,sizes,image_url,active,featured,product_type,specifications)
values (
  'Kartu e-Money Custom KM11',
  'kartu-emoney-custom-km11',
  'Katalog kartu e-money custom. Customer dapat memilih 1 dari 4 template, upload foto, mengatur posisi foto/nama, menyetujui preview, lalu hasil PNG final akan tersimpan untuk admin cetak.',
  0,
  50,
  array[]::text[],
  array[]::text[],
  '/emoney/front-templates.png',
  false,
  true,
  'emoney_card',
  jsonb_build_object('Format','Custom e-money card','Preview','PNG final tersimpan','Template','4 pilihan template')
)
on conflict (slug) do nothing;

-- Admin profile support (editable display name; username/password managed from app)
alter table public.admins add column if not exists display_name text;
update public.admins set display_name = username where display_name is null or btrim(display_name) = '';
