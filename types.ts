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
}

export interface ChatMessage {
  sender: 'client' | 'admin' | 'system';
  text: string;
  timestamp: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: number;
  reference: string;
  note?: string;
}

export enum OrderStatus {
  QUOTE_REQUESTED = 'COTIZANDO',
  APPROVED = 'APROBADO',
  PAID = 'PAGADO',
  SHIPPED = 'ENVIADO',
  COMPLETED = 'ENTREGADO',
  CREDIT_ACTIVE = 'CRÉDITO ACTIVO' // Nuevo estado para cuentas por cobrar
}

export interface Order {
  id: string;
  items: { product: Injector; quantity: number }[];
  status: OrderStatus;
  customerName: string;
  chat: ChatMessage[];
  createdAt: number;
  
  // Datos del Cliente (Crédito)
  clientRIF?: string;
  clientBusinessName?: string;
  clientPhone?: string;
  
  // Datos de Envío y Pago
  shippingAddress?: string;
  paymentReference?: string;
  paymentProof?: string;
  shippingReceipt?: string;
  
  // Sistema de Abonos
  payments?: Payment[]; // Lista de abonos realizados
  
  // Calificación
  rating?: number;
  review?: string;
}

export interface CartItem {
  product: Injector;
  quantity: number;
}

export interface AppState {
  injectors: Injector[];
  orders: Order[];
  cart: CartItem[];
  userRole: 'client' | 'admin';
}