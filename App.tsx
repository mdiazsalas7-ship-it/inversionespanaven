import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, orderBy, setDoc } from "firebase/firestore";
import { db } from './firebase';
import { AppState, Injector, Order, OrderStatus, ChatMessage } from './types';
import { INITIAL_INJECTORS } from './constants';

// Importamos las páginas limpias
import { Catalog } from './pages/Catalog';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { OrderDetail } from './pages/OrderDetail';
import { AdminLogin, AdminDashboard } from './pages/Admin';

// URL DEL LOGO
const LOGO_URL = "https://i.postimg.cc/x1nHCVy8/unnamed-removebg-preview.png";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({ injectors: [], orders: [], cart: [], userRole: 'client' });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Inyectores de la Base de Datos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "injectors"), (snapshot) => {
      const injectorsData: Injector[] = [];
      snapshot.forEach((doc) => injectorsData.push({ id: doc.id, ...doc.data() } as Injector));
      
      if (injectorsData.length === 0) {
        INITIAL_INJECTORS.forEach(async (inj) => await setDoc(doc(db, "injectors", inj.id), inj));
      } else {
        setState(prev => ({ ...prev, injectors: injectorsData }));
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Cargar Órdenes en tiempo real
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => ordersData.push({ id: doc.id, ...doc.data() } as Order));
      setState(prev => ({ ...prev, orders: ordersData }));
    });
    return () => unsub();
  }, []);

  // --- LÓGICA DEL CARRITO (Actualizada para soportar cantidades del modal) ---
  const addToCart = (product: Injector, quantity: number = 1) => {
    setState(prev => {
      const existing = prev.cart.find(item => item.product.id === product.id);
      if (existing) {
        return { 
          ...prev, 
          cart: prev.cart.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: item.quantity + quantity } 
              : item
          ) 
        };
      }
      return { ...prev, cart: [...prev.cart, { product, quantity }] };
    });
  };

  const removeFromCart = (id: string) => {
    setState(prev => ({ ...prev, cart: prev.cart.filter(item => item.product.id !== id) }));
  };

  // --- CREAR ORDEN (Solicitar Cotización) ---
  const createOrder = async () => {
    const orderData = { 
      items: state.cart, 
      status: OrderStatus.QUOTE_REQUESTED, 
      customerName: 'Cliente Panaven', 
      chat: [], 
      createdAt: Date.now() 
    };
    const docRef = await addDoc(collection(db, "orders"), orderData);
    setState(prev => ({ ...prev, cart: [] })); // Vaciamos carrito
    return docRef.id;
  };

  // Funciones auxiliares para Admin y Chat
  const updateStatus = async (id: string, status: OrderStatus, extra: any = {}) => { 
    await updateDoc(doc(db, "orders", id), { ...extra, status }); 
  };
  
  const addChat = async (id: string, msg: ChatMessage) => { 
    const order = state.orders.find(o => o.id === id);
    if(order) await updateDoc(doc(db, "orders", id), { chat: [...order.chat, msg] });
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <img src={LOGO_URL} className="w-32 h-32 animate-pulse object-contain" alt="Cargando" />
        <p className="font-black tracking-widest text-sm text-blue-500">CARGANDO...</p>
    </div>
  );

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col font-['Outfit']">
        {/* Barra de Navegación Fija */}
        <nav className="bg-slate-950 text-white shadow-2xl sticky top-0 z-50 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
            
            {/* LOGO DE LA MARCA */}
            <Link to="/" className="flex items-center gap-3 group">
              <img 
                src={LOGO_URL} 
                alt="Panaven Logo" 
                className="h-12 w-12 object-contain filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-transform group-hover:scale-110" 
              />
              <div className="flex flex-col">
                <span className="text-xl font-black text-white tracking-tighter italic leading-none">PANAVEN</span>
                <span className="text-[8px] text-blue-500 font-bold uppercase tracking-[0.4em]">Inyectores</span>
              </div>
            </Link>
            
            <div className="flex items-center gap-6">
              <Link to="/orders" className="text-slate-400 hover:text-white transition font-bold text-xs uppercase tracking-widest hidden md:block">Mis Pedidos</Link>
              
              {/* Iconos Móviles */}
              <div className="flex md:hidden gap-6 items-center">
                 <Link to="/orders" className="text-2xl text-slate-400 hover:text-white">📦</Link>
                 <Link to="/admin" className="text-2xl text-slate-400 hover:text-white">🔧</Link>
              </div>

              <Link to="/admin" className="text-blue-500 hover:text-blue-400 font-black text-xs uppercase tracking-widest hidden md:block">Admin</Link>
              
              <Link to="/cart" className="relative group">
                <span className="text-2xl">🛒</span>
                {state.cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg border-2 border-slate-950 animate-bounce">
                    {state.cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </nav>

        {/* Contenido Principal */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Catalog injectors={state.injectors} addToCart={addToCart} />} />
            <Route path="/cart" element={<Cart cart={state.cart} removeFromCart={removeFromCart} createOrder={createOrder} />} />
            <Route path="/orders" element={<Orders orders={state.orders} role="client" />} />
            <Route path="/order/:id" element={<OrderDetail orders={state.orders} role={isAdminLoggedIn ? 'admin' : 'client'} updateStatus={updateStatus} addChat={addChat} />} />
            <Route path="/admin" element={isAdminLoggedIn ? <AdminDashboard state={state} updateStatus={updateStatus} addChat={addChat} onLogout={() => setIsAdminLoggedIn(false)} /> : <AdminLogin onLogin={() => setIsAdminLoggedIn(true)} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;