-- WAJIB DIJALANKAN di Supabase SQL Editor sebelum deploy kode baru.
-- Aman untuk produk dan pesanan historis: default diskon individual nonaktif/0.
begin;
alter table public.products add column if not exists item_discount_enabled boolean not null default false;
alter table public.products add column if not exists item_discount_type text not null default 'percent';
alter table public.products add column if not exists item_discount_amount numeric(14,2) not null default 0;
alter table public.products drop constraint if exists products_item_discount_type_check;
alter table public.products add constraint products_item_discount_type_check check (item_discount_type in ('percent','fixed'));
alter table public.products drop constraint if exists products_item_discount_amount_check;
alter table public.products add constraint products_item_discount_amount_check check (item_discount_amount >= 0 and item_discount_amount = trunc(item_discount_amount) and (item_discount_type <> 'percent' or item_discount_amount <= 100));
alter table public.orders add column if not exists item_discount numeric(14,2) not null default 0;
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
    subtotal,launch_discount,item_discount,volume_discount,promo_discount,promo_code,total,payment_method_id,payment_method_name,payment_upload_token_hash
  ) values (
    v_id,v_receipt,'new',p_order->>'full_name',p_order->>'email',p_order->>'phone',nullif(p_order->>'address',''),(p_order->>'fulfillment_type')::public.fulfillment_type,
    nullif(p_order->>'pickup_location_id','')::uuid,nullif(p_order->>'pickup_slot_id','')::uuid,v_pickup_name,v_pickup_address,v_slot_start,v_slot_end,
    nullif(p_order->>'shipping_destination_id',''),nullif(p_order->>'shipping_destination_label',''),nullif(p_order->>'shipping_courier',''),nullif(p_order->>'shipping_service',''),coalesce((p_order->>'shipping_cost')::numeric,0),
    (p_order->>'subtotal')::numeric,coalesce((p_order->>'launch_discount')::numeric,0),coalesce((p_order->>'item_discount')::numeric,0),coalesce((p_order->>'volume_discount')::numeric,0),coalesce((p_order->>'promo_discount')::numeric,0),nullif(p_order->>'promo_code',''),(p_order->>'total')::numeric,(p_order->>'payment_method_id')::uuid,p_order->>'payment_method_name',nullif(p_order->>'payment_upload_token_hash','')
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
