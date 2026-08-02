/**
 * Shapes de fila en snake_case, iguales a las que exponía `lib/supabase/types.ts`,
 * para que las pantallas/actions/rutas existentes no tengan que cambiar su forma de
 * acceder a los campos (row.store_name, order.customer_email, etc.) al migrar de
 * Supabase a Drizzle. Los repositorios en `lib/db/repositories/*` devuelven estos
 * tipos, mapeando desde el resultado camelCase de Drizzle.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock: number;
  images: string[];
  category: string | null;
  tags: string[];
  variants: Json | null;
  has_variants: boolean;
  options: Json | null;
  meta_title: string | null;
  meta_desc: string | null;
  active: boolean;
  discount_enabled: boolean;
  discount_max_percent: number;
  discount_steps: Json;
  discount_label: string | null;
  product_sections: Json;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  title: string;
  option_values: Json;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock: number;
  image_url: string | null;
  badge_text: string | null;
  active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  status:
    | "awaiting_payment"
    | "pending"
    | "paid"
    | "preparing"
    | "shipped"
    | "delivered"
    | "cancelled";
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: Json;
  items: Json;
  subtotal: number;
  shipping_cost: number;
  total: number;
  flow_token: string | null;
  flow_order: string | null;
  display_code: string | null;
  notes: string | null;
  stock_discounted: boolean;
  client_ip_address: string | null;
  client_user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  order_id: string | null;
  author_name: string;
  author_email: string | null;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  verified: boolean;
  active: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  rut_numero: string | null;
  rut_dv: string | null;
  direccion: string | null;
  comuna: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  password_hash: string | null;
  registered_at: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  profile_recovery_ack_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteDireccion {
  id: string;
  cliente_id: string;
  nombre: string;
  direccion: string;
  comuna: string;
  region: string;
  referencia: string | null;
  telefono: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  role: "owner" | "admin" | "operator";
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  store_tagline: string | null;
  logo_url: string | null;
  logo_square_url: string | null;
  favicon_url: string | null;
  apple_icon_url: string | null;
  pwa_icon_512_url: string | null;
  brand_text_color: string;
  navbar_background_color: string;
  navbar_text_color: string;
  footer_background_color: string;
  footer_text_color: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  text_muted_color: string;
  border_color: string;
  theme_preset: string;
  branding_mode: string;
  logo_size_desktop: number;
  logo_size_mobile: number;
  brand_text_scale: number;
  navbar_brand_position: string;
  navbar_menu_position: string;
  font_heading: string;
  font_body: string;
  theme_manual_override: boolean;
  support_whatsapp: string | null;
  contact_email: string | null;
  support_instagram: string | null;
  support_tiktok: string | null;
  enable_whatsapp_checkout: boolean;
  hero_banner_desktop_url: string | null;
  hero_banner_mobile_url: string | null;
  hero_overlay_opacity: number | null;
  hero_overlay_mode: string | null;
  order_number_offset: number | null;
  shipping_cost_clp: number;
  shipping_free_threshold_clp: number;
  enable_whatsapp_fab: boolean;
  meta_pixel_id: string | null;
  meta_capi_access_token: string | null;
  meta_pixel_enabled: boolean;
  meta_test_event_code: string | null;
  clarity_project_id: string | null;
  clarity_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  region: string;
  zip: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
}
