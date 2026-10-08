import type { EmoneyCustomization } from './emoney'

export type ProductType = 'standard' | 'emoney_card'

export type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  base_price: number
  weight_grams: number
  image_url: string | null
  colors: string[]
  sizes: string[]
  active: boolean
  featured: boolean
  specifications: Record<string, string>
  product_type: ProductType
  created_at: string
  updated_at: string
}

export type CartItem = {
  productId: string
  name: string
  imageUrl: string | null
  unitPrice: number
  qty: number
  color?: string
  size?: string
  weightGrams: number
  customization?: EmoneyCustomization | null
}

export type PickupSlot = {
  id: string
  location_id: string
  starts_at: string
  ends_at: string
  capacity: number | null
  active: boolean
}

export type PickupLocation = {
  id: string
  name: string
  address: string
  notes: string | null
  active: boolean
  slots?: PickupSlot[]
}

export type PaymentMethod = {
  id: string
  name: string
  type: 'bank_transfer' | 'qris' | 'other'
  account_name: string | null
  account_number: string | null
  instructions: string | null
  qr_image_url: string | null
  active: boolean
}

export type ShippingQuote = {
  courier: string
  service: string
  description?: string
  cost: number
  etd?: string
}

export type OrderStatus = 'new' | 'verified' | 'shipped' | 'completed'

export type OrderItem = {
  id: string
  product_name: string
  product_id: string | null
  variant_color: string | null
  variant_size: string | null
  unit_price: number
  quantity: number
  line_total: number
  customization?: EmoneyCustomization | Record<string, unknown> | null
  design_image_path?: string | null
  design_image_url?: string | null
}

export type Order = {
  id: string
  receipt_no: string
  status: OrderStatus
  full_name: string
  email: string
  phone: string
  address: string | null
  fulfillment_type: 'ship' | 'pickup'
  pickup_location_id: string | null
  pickup_slot_id: string | null
  shipping_destination_id: string | null
  shipping_courier: string | null
  shipping_service: string | null
  shipping_cost: number
  subtotal: number
  total: number
  payment_method_id: string
  payment_proof_path: string | null
  verified_at: string | null
  tracking_number: string | null
  tracking_courier: string | null
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
}
