
export interface Injector {
  id: string;
  brand: string;
  model: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  specifications: { [key: string]: string };
  images: string[];
  mlLink?: string;
}

export enum OrderStatus {
  QUOTE_REQUESTED = 'QUOTE_REQUESTED',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export interface ChatMessage {
  sender: 'client' | 'admin';
  text: string;
  timestamp: number;
}

export interface Order {
  id: string;
  items: { product: Injector; quantity: number }[];
  status: OrderStatus;
  customerName: string;
  paymentProof?: string; // Base64 or reference
  paymentReference?: string;
  shippingMethod?: 'pickup' | 'shipping';
  address?: string;
  courier?: string;
  shippingVoucher?: string;
  rating?: number;
  review?: string;
  chat: ChatMessage[];
  createdAt: number;
}

export interface AppState {
  injectors: Injector[];
  orders: Order[];
  cart: { product: Injector; quantity: number }[];
  userRole: 'client' | 'admin';
}
