export type UserRole = 'owner' | 'shop' | 'driver' | 'developer';
export type OrderStatus = 'pending' | 'assigned' | 'delivered' | 'cancelled';

export interface User {
  id: string;
  role: UserRole;
  approved: boolean;
  online_status: boolean;
  last_seen_at: string | null;
  active: boolean;
  can_view_orders: boolean;
  email: string | null;
}

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
}

export interface DirectoryEntry {
  id: string;
  role: 'shop' | 'driver';
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  online_status: boolean;
  last_seen_at: string | null;
  can_view_orders: boolean;
}

export interface Order {
  id: string;
  shop_id: string;
  driver_id: string | null;
  street: string;
  phone: string | null;
  customer_name: string | null;
  bell: string | null;
  floor: string | null;
  notes: string | null;
  amount: number | null;
  cancel_reason: string | null;
  status: OrderStatus;
  created_at: string;
  assigned_at: string | null;
  delivered_at: string | null;
  created_by_owner: boolean;
  is_open_order: boolean;
}

export interface OrderTimeline {
  id: string;
  order_id: string;
  event: string;
  created_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  phone: string;
  name: string | null;
  address: string | null;
  bell: string | null;
  floor: string | null;
}

export interface SupportMessage {
  id: string;
  user_id: string;
  sender_role: 'user' | 'developer';
  message: string;
  read: boolean;
  created_at: string;
}

export interface AccountEntry {
  id: string;
  role: UserRole;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  approved: boolean;
  online_status: boolean;
  last_seen_at: string | null;
}
