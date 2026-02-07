import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, orderBy, setDoc } from "firebase/firestore";
import { db } from './firebase';
import { AppState, Injector, Order, OrderStatus, ChatMessage } from './types';
import { INITIAL_INJECTORS } from './constants';
import { getDolarRate } from './services/exchangeRateService';

// Páginas
import { Catalog } from './pages/Catalog';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { OrderDetail } from './pages/OrderDetail';
import { AdminLogin, AdminDashboard } from './pages/Admin';

// Componentes Nuevos
import { InstallPWA } from './components/InstallPWA';
// IMPORTAMOS EL PROVEEDOR DE NOTIFICACIONES (NUEVO)
import { ToastProvider } from './context/ToastContext';

const LOGO_URL = "https://i.postimg.cc/x1nHCVy8/unnamed_removebg_preview.png";

// COMPONENTE WRAPPER PARA EL NAVBAR
const Layout: React.FC<{ 
    children: React.ReactNode, 
    cartCount: number, 
    showNav: boolean,
    currency: 'USD' | 'VES', 
    toggleCurrency: () => void,
    exchangeRate: number 
}> = ({ children, cartCount, showNav, currency, toggleCurrency, exchangeRate }) => {
  return (
    <div className="min-h-screen flex flex-col font-['Outfit']">
      
      {/* BOTÓN DE INSTALACIÓN PWA */}
      <InstallPWA />

      {showNav && (
        <nav className="bg-slate-950 text-white shadow-2xl sticky top-0 z-50 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
            <Link to="/catalog" className="flex items-center gap-3 group">
              <img src={LOGO_URL} alt="Logo" className="h-12 w-12 object-contain filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-transform group-hover:scale-110" />
              <div className="flex flex-col">
                <span className="text-xl font-black text-white tracking-tighter italic leading-none">PANAVEN</span>
                <span className="text-[8px] text-blue-500 font-bold uppercase tracking-[0.4em]">Inyectores</span>
              </div>
            </Link>
            <div className="flex items-center gap-6">
              
              {/* INTERRUPTOR DE MONEDA (AHORA VISIBLE SIEMPRE) */}
              <button 
                onClick={toggleCurrency} 
                className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/20 transition"
              >
                <span className={`text-[10px] font-black ${currency === 'USD' ? 'text-green-400' : 'text-slate-400'}`}>USD</span>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${currency === 'VES' ? 'bg-blue-600' : 'bg-slate-600'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${currency === 'VES' ? 'left-4.5' : 'left-0.5'}`}></div>
                </div>
                <span className={`text-[10px] font-black ${currency === 'VES' ? 'text-blue-400' : 'text-slate-400'}`}>Bs</span>
              </button>

              <Link to="/orders" className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest hidden md:block">Mis Pedidos</Link>
              <Link to="/" className="text-red-500 hover:text-red-400 font-black text-[10px] uppercase tracking-widest border border-red-900/30 px-3 py-1 rounded-full bg-red-900/10">Salir</Link>
              <Link to="/cart" className="relative text-2xl">
                🛒
                {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-bounce">{cartCount}</span>}
              </Link>
            </div>
          </div>
        </nav>
      )}
      <main className={`flex-1 w-full ${showNav ? 'max-w-7xl mx-auto p-4 md:p-8' : ''}`}>
        {children}
      </main>
    </div>
  );
};

// PANTALLA DE BIENVENIDA (LANDING)
const WelcomeScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-fadeIn relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 bg-slate-900 rounded-b-[3rem] shadow-2xl z-0"></div>
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 text-center mt-10">
        <div className="w-32 h-32 bg-white rounded-full mx-auto -mt-24 flex items-center justify-center shadow-lg border-4 border-slate-50 p-4">
           <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mt-6 uppercase italic tracking-tighter">Panaven</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-10">Repuestos Diesel & Inyección</p>
        <div className="space-y-4">
          <Link to="/catalog" className="w-full group relative bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all transform hover:scale-[1.02] flex items-center justify-between overflow-hidden block">
            <div className="absolute right-[-20px] bottom-[-20px] text-8xl text-white/10 group-hover:scale-110 transition-transform">🛒</div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Entrar como</p>
              <h3 className="text-2xl font-black uppercase">Cliente</h3>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">→</div>
          </Link>
          <div className="flex items-center gap-4 py-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-xs text-slate-300 font-black uppercase">O</span><div className="h-px bg-slate-200 flex-1"></div></div>
          <Link to="/admin" className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 p-4 rounded-xl border-2 border-slate-200 font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 block">
            <span>🔒</span> Gestión Administrativa
          </Link>
        </div>
        <p className="mt-8 text-[10px] text-slate-300 font-bold uppercase">© 2024 Panaven App</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({ injectors: [], orders: [], cart: [], userRole: 'client' });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // ESTADOS DE MONEDA Y TASA
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState(1);

  useEffect(() => {
    // 1. Cargar Inyectores
    const unsubInv = onSnapshot(collection(db, "injectors"), (snapshot) => {
      const injectorsData: Injector[] = [];
      snapshot.forEach((doc) => injectorsData.push({ id: doc.id, ...doc.data() } as Injector));
      if (injectorsData.length === 0) INITIAL_INJECTORS.forEach(async (inj) => await setDoc(doc(db, "injectors", inj.id), inj));
      else setState(prev => ({ ...prev, injectors: injectorsData }));
      setLoading(false);
    });
    
    // 2. Cargar Órdenes
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => ordersData.push({ id: doc.id, ...doc.data() } as Order));
      setState(prev => ({ ...prev, orders: ordersData }));
    });

    // 3. CARGAR TASA (AUTOMÁTICA CON FALLBACK)
    const loadExchangeRate = async () => {
         // Intento obtener tasa automática del BCV
         const autoRate = await getDolarRate('bcv');
         
         if (autoRate && autoRate.rate > 0) {
            console.log(`💵 Tasa Auto-actualizada: ${autoRate.rate} (${autoRate.source})`);
            setExchangeRate(autoRate.rate);
         } else {
            // Si falla API, uso la de Firebase
            onSnapshot(doc(db, "settings", "global"), (docSnap) => {
              if (docSnap.exists()) setExchangeRate(docSnap.data().exchangeRate || 1);
            });
         }
    };
    loadExchangeRate();

    return () => { unsubInv(); unsubOrders(); };
  }, []);

  // Funciones Carrito y Pedidos
  const addToCart = (product: Injector, quantity: number = 1) => {
    setState(prev => {
      const existing = prev.cart.find(item => item.product.id === product.id);
      if (existing) return { ...prev, cart: prev.cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item) };
      return { ...prev, cart: [...prev.cart, { product, quantity }] };
    });
  };

  const decrementCartItem = (productId: string) => {
    setState(prev => {
      const existing = prev.cart.find(item => item.product.id === productId);
      if (existing?.quantity === 1) return { ...prev, cart: prev.cart.filter(item => item.product.id !== productId) };
      return { ...prev, cart: prev.cart.map(item => item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item) };
    });
  };

  const createOrder = async () => {
    const orderData = { items: state.cart, status: OrderStatus.QUOTE_REQUESTED, customerName: 'Cliente Panaven', chat: [], createdAt: Date.now() };
    const docRef = await addDoc(collection(db, "orders"), orderData);
    setState(prev => ({ ...prev, cart: [] }));
    return docRef.id;
  };

  const updateStatus = async (id: string, status: OrderStatus, extra: any = {}) => await updateDoc(doc(db, "orders", id), { ...extra, status }); 
  const addChat = async (id: string, msg: ChatMessage) => { const order = state.orders.find(o => o.id === id); if(order) await updateDoc(doc(db, "orders", id), { chat: [...order.chat, msg] }); };

  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4"><img src={LOGO_URL} className="w-32 h-32 animate-pulse object-contain" /><p className="font-black tracking-widest text-sm text-blue-500">CARGANDO...</p></div>;

  return (
    // AQUÍ ENVOLVEMOS TODA LA APP CON EL PROVEEDOR DE NOTIFICACIONES (TOAST)
    <ToastProvider>
        <HashRouter>
        <RoutesWrapper 
            state={state} 
            isAdminLoggedIn={isAdminLoggedIn} 
            setIsAdminLoggedIn={setIsAdminLoggedIn}
            addToCart={addToCart}
            decrementCartItem={decrementCartItem}
            createOrder={createOrder}
            updateStatus={updateStatus}
            addChat={addChat}
            removeFromCart={(id) => setState(p => ({...p, cart: p.cart.filter(i => i.product.id !== id)}))}
            currency={currency}
            toggleCurrency={() => setCurrency(prev => prev === 'USD' ? 'VES' : 'USD')}
            exchangeRate={exchangeRate}
        />
        </HashRouter>
    </ToastProvider>
  );
};

// Componente separado para poder usar useLocation()
const RoutesWrapper: React.FC<any> = (props) => {
  const location = useLocation();
  const showNav = location.pathname !== '/' && (location.pathname !== '/admin' || props.isAdminLoggedIn);

  // Props para el catálogo con moneda
  const catalogProps = { 
      injectors: props.state.injectors, 
      cart: props.state.cart, 
      addToCart: props.addToCart, 
      removeFromCart: props.decrementCartItem,
      currency: props.currency,
      exchangeRate: props.exchangeRate
  };

  return (
    <Layout 
        cartCount={props.state.cart.reduce((a:any, b:any) => a + b.quantity, 0)} 
        showNav={showNav}
        currency={props.currency} 
        toggleCurrency={props.toggleCurrency} 
        exchangeRate={props.exchangeRate}
    >
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        {/* Catálogo actualizado con props */}
        <Route path="/catalog" element={<Catalog {...catalogProps} />} />
        <Route path="/cart" element={<Cart cart={props.state.cart} removeFromCart={props.removeFromCart} createOrder={props.createOrder} />} />
        <Route path="/orders" element={<Orders orders={props.state.orders} role="client" />} />
        <Route path="/order/:id" element={<OrderDetail orders={props.state.orders} role={props.isAdminLoggedIn ? 'admin' : 'client'} updateStatus={props.updateStatus} addChat={props.addChat} />} />
        <Route path="/admin" element={props.isAdminLoggedIn ? <AdminDashboard state={props.state} updateStatus={props.updateStatus} addChat={props.addChat} onLogout={() => props.setIsAdminLoggedIn(false)} /> : <AdminLogin onLogin={() => props.setIsAdminLoggedIn(true)} />} />
      </Routes>
    </Layout>
  );
};

export default App;