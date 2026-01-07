import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  orderBy, 
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from './firebase';
import { AppState, Injector, Order, OrderStatus, ChatMessage } from './types';
import { INITIAL_INJECTORS, WAZE_URL } from './constants';
import { getAdminInsights, getTechnicalAdvice, generateProductData } from './services/geminiService';
import { uploadImage } from './services/storageService';
import ChatWindow from './components/ChatWindow';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    injectors: [],
    orders: [],
    cart: [],
    userRole: 'client'
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "injectors"), (snapshot) => {
      const injectorsData: Injector[] = [];
      snapshot.forEach((doc) => {
        injectorsData.push({ id: doc.id, ...doc.data() } as Injector);
      });
      
      if (injectorsData.length === 0) {
        INITIAL_INJECTORS.forEach(async (inj) => {
          await setDoc(doc(db, "injectors", inj.id), inj);
        });
      } else {
        setState(prev => ({ ...prev, injectors: injectorsData }));
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() } as Order);
      });
      setState(prev => ({ ...prev, orders: ordersData }));
    });
    return () => unsub();
  }, []);

  const updateOrderStatus = async (orderId: string, status: OrderStatus, extra: Partial<Order> = {}) => {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { ...extra, status });
  };

  const addChatMessage = async (orderId: string, message: ChatMessage) => {
    const orderRef = doc(db, "orders", orderId);
    const order = state.orders.find(o => o.id === orderId);
    if (order) {
      await updateDoc(orderRef, {
        chat: [...order.chat, message]
      });
    }
  };

  const addToCart = (product: Injector) => {
    setState(prev => {
      const existing = prev.cart.find(item => item.product.id === product.id);
      if (existing) {
        return {
          ...prev,
          cart: prev.cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        };
      }
      return { ...prev, cart: [...prev.cart, { product, quantity: 1 }] };
    });
  };

  const removeFromCart = (productId: string) => {
    setState(prev => ({ ...prev, cart: prev.cart.filter(item => item.product.id !== productId) }));
  };

  const createOrder = async () => {
    const orderData: Omit<Order, 'id'> = {
      items: state.cart,
      status: OrderStatus.QUOTE_REQUESTED,
      customerName: 'Cliente Panaven',
      chat: [],
      createdAt: Date.now()
    };
    const docRef = await addDoc(collection(db, "orders"), orderData);
    setState(prev => ({ ...prev, cart: [] }));
    return docRef.id;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-20 h-20 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-white font-black tracking-widest brand-font italic uppercase">Panaven</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col font-['Outfit']">
        <nav className="bg-slate-950 text-white shadow-2xl sticky top-0 z-50 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 md:h-20">
            <Link to="/" className="flex flex-col group">
              <span className="text-xl md:text-2xl font-black tracking-tighter text-blue-500 brand-font italic uppercase">Panaven</span>
              <span className="text-[8px] md:text-[10px] font-black text-slate-500 -mt-1 uppercase tracking-[0.3em] text-center">Inyector</span>
            </Link>
            <div className="flex items-center gap-4 md:gap-8">
              <div className="hidden md:flex items-center gap-6">
                <Link to="/" className="hover:text-blue-500 transition text-xs font-black uppercase tracking-widest">Catálogo</Link>
                <Link to="/orders" className="hover:text-blue-500 transition text-xs font-black uppercase tracking-widest">Mis Pedidos</Link>
                <Link to="/admin" className="text-blue-500 font-black text-xs uppercase tracking-widest border-b-2 border-blue-500 pb-1">Admin</Link>
              </div>
              <div className="flex md:hidden gap-4 mr-2">
                 <Link to="/orders" className="text-slate-400 hover:text-white"><span className="text-xl">📦</span></Link>
                 <Link to="/admin" className="text-slate-400 hover:text-white"><span className="text-xl">🔧</span></Link>
              </div>
              <Link to="/cart" className="relative p-2 text-slate-400 hover:text-white transition group">
                <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                {state.cart.length > 0 && (
                  <span className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {state.cart.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </nav>

        <main className="flex-1 max-w-7xl mx-auto w-full p-3 md:p-8">
          <Routes>
            <Route path="/" element={<CatalogView injectors={state.injectors} addToCart={addToCart} />} />
            <Route path="/cart" element={<CartView cart={state.cart} removeFromCart={removeFromCart} createOrder={createOrder} />} />
            <Route path="/orders" element={<OrdersListView orders={state.orders} role="client" />} />
            <Route path="/order/:id" element={<OrderDetailView orders={state.orders} role={isAdminLoggedIn ? 'admin' : 'client'} updateStatus={updateOrderStatus} addChat={addChatMessage} />} />
            <Route path="/admin" element={isAdminLoggedIn ? <AdminDashboard state={state} updateStatus={updateOrderStatus} addChat={addChatMessage} onLogout={() => setIsAdminLoggedIn(false)} /> : <AdminLogin onLogin={() => setIsAdminLoggedIn(true)} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

const CatalogView: React.FC<{ injectors: Injector[], addToCart: (p: Injector) => void }> = ({ injectors, addToCart }) => {
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<Injector | null>(null);
  const brands = useMemo(() => ['All', ...Array.from(new Set(injectors.map(i => i.brand)))], [injectors]);
  const filtered = selectedBrand === 'All' ? injectors : injectors.filter(i => i.brand === selectedBrand);

  return (
    <div className="space-y-4 animate-fadeIn pb-24">
      {/* Filtros de Marcas (Compactos) */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm py-2 -mx-3 px-3 border-b border-slate-200 md:static md:bg-transparent md:border-0 md:p-0 md:mx-0">
         <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {brands.map(b => (
              <button 
                key={b} 
                onClick={() => setSelectedBrand(b)} 
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${selectedBrand === b ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
              >
                {b}
              </button>
            ))}
         </div>
      </div>

      {/* LISTA COMPACTA (Tipo Fila - Ideal para Repuestos) */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(item => (
          <div 
            key={item.id} 
            onClick={() => setSelectedProduct(item)}
            className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm flex items-center gap-3 active:scale-95 transition-all cursor-pointer relative group"
          >
            {/* 1. FOTO PEQUEÑA (Izquierda) */}
            <div className="relative w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-lg shrink-0 overflow-hidden border border-slate-100">
              <img src={item.images[0]} alt={item.model} className="w-full h-full object-cover" />
              {item.stock === 0 && <div className="absolute inset-0 bg-white/60 flex items-center justify-center font-black text-[8px] uppercase text-red-600 tracking-widest">Agotado</div>}
            </div>

            {/* 2. INFORMACIÓN (Centro) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.brand}</span>
              <h3 className="font-bold text-xs text-slate-900 leading-tight uppercase truncate">{item.model}</h3>
              <p className="text-[9px] text-slate-400 truncate mt-1">{item.sku}</p>
            </div>

            {/* 3. PRECIO Y ACCIÓN (Derecha) */}
            <div className="flex flex-col items-end justify-center gap-2 pl-2 border-l border-slate-50 h-12">
              <span className="text-sm font-black text-blue-600">${item.price}</span>
              
              <button 
                disabled={item.stock === 0} 
                onClick={(e) => {
                  e.stopPropagation(); 
                  addToCart(item);
                }} 
                className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition shadow-sm"
              >
                <span className="font-bold text-sm mb-[1px]">+</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL / FICHA TÉCNICA (Sin cambios, funciona bien) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedProduct(null)}></div>
          
          <div className="bg-white w-full max-w-4xl rounded-t-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden h-[70vh] md:max-h-[85vh] flex flex-col md:flex-row relative z-10 animate-slideUp">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-20 bg-slate-100 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">✕</button>
            
            <div className="w-full md:w-1/2 bg-slate-50 p-6 flex items-center justify-center h-1/3 md:h-auto">
               <img src={selectedProduct.images[0]} className="max-h-full max-w-full rounded-xl shadow-lg object-contain mix-blend-multiply" alt="Vista" />
            </div>
            
            <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto h-2/3 md:h-auto bg-white">
              <span className="text-blue-600 font-black text-[9px] uppercase tracking-widest">{selectedProduct.brand}</span>
              <h2 className="text-lg md:text-2xl font-black text-slate-900 uppercase leading-tight mt-1">{selectedProduct.model}</h2>
              <div className="text-2xl font-black text-slate-900 mt-2">${selectedProduct.price}</div>
              
              <div className="mt-4 space-y-3 flex-1">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 gap-2">
                    {Object.entries(selectedProduct.specifications).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-slate-400 block text-[7px] font-black uppercase">{key}</span>
                        <span className="text-slate-900 font-bold text-[10px]">{val}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 text-[10px] leading-relaxed">{selectedProduct.description}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                 <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/30 active:scale-95 transition-transform">
                    Agregar al Pedido
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === 'panaven2024') onLogin();
    else alert('Código Incorrecto');
  };
  return (
    <div className="max-w-md mx-4 md:mx-auto mt-10 md:mt-20 p-6 md:p-10 bg-white rounded-2xl md:rounded-[3rem] shadow-2xl border border-slate-100 text-center">
      <h2 className="text-xl md:text-2xl font-black brand-font italic uppercase mb-6">Acceso Administrador</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="Código de Acceso" className="w-full border-2 p-3 md:p-4 rounded-xl md:rounded-2xl text-center font-bold outline-none focus:border-blue-600" />
        <button type="submit" className="w-full py-3 md:py-4 bg-slate-950 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:bg-black transition">Entrar</button>
      </form>
    </div>
  );
};

const AdminDashboard: React.FC<{ state: AppState, updateStatus: any, addChat: any, onLogout: () => void }> = ({ state, updateStatus, addChat, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'accounting'>('inventory');
  // ... (States remain the same)
  const [orderFilter, setOrderFilter] = useState<'pending' | 'closed'>('pending');
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [technicalChat, setTechnicalChat] = useState<{ role: 'admin' | 'ai', text: string }[]>([]);
  const [techInput, setTechInput] = useState('');
  const [loadingTech, setLoadingTech] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Injector | null>(null);
  const [showAiTechnical, setShowAiTechnical] = useState(false);
  
  // Form State
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);
  const [formDesc, setFormDesc] = useState('');
  const [formSpecs, setFormSpecs] = useState({ Caudal: '', Resistencia: '', Huecos: '' });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setFormName(editingProduct.model);
      setFormBrand(editingProduct.brand);
      setFormSku(editingProduct.sku);
      setFormPrice(editingProduct.price);
      setFormStock(editingProduct.stock);
      setFormDesc(editingProduct.description);
      setFormSpecs(editingProduct.specifications as any);
      setFormImages(editingProduct.images);
    } else {
      setFormName('');
      setFormBrand('');
      setFormSku('');
      setFormPrice(0);
      setFormStock(0);
      setFormDesc('');
      setFormSpecs({ Caudal: '', Resistencia: '', Huecos: '' });
      setFormImages([]);
    }
  }, [editingProduct, showAddProduct]);

  useEffect(() => {
    if (showAiTechnical) {
      const fetchAi = async () => {
        setLoadingAi(true);
        const res = await getAdminInsights(state.injectors, state.orders);
        setAiInsight(res);
        setLoadingAi(false);
      };
      fetchAi();
    }
  }, [showAiTechnical]);

  const handleAiAutofill = async () => {
    if (!formName.trim()) {
      alert("Introduce un nombre (ej: Inyector Toyota Corolla 2010)");
      return;
    }
    setIsGenerating(true);
    const data = await generateProductData(formName);
    if (data) {
      setFormBrand(data.brand);
      setFormSku(data.sku);
      setFormPrice(data.price);
      setFormDesc(data.description);
      setFormSpecs(data.specifications);
    }
    setIsGenerating(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);
    const uploadedUrls: string[] = [...formImages];
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      const file = files[i];
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = await promise;
      const url = await uploadImage(`inventory/${Date.now()}_${i}`, base64);
      uploadedUrls.push(url);
    }
    setFormImages(uploadedUrls);
    setIsUploading(false);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      brand: formBrand,
      model: formName,
      sku: formSku,
      price: Number(formPrice),
      stock: Number(formStock),
      description: formDesc,
      specifications: formSpecs,
      images: formImages.length > 0 ? formImages : ["https://picsum.photos/800/600"]
    };
    if (editingProduct) await updateDoc(doc(db, "injectors", editingProduct.id), productData);
    else await addDoc(collection(db, "injectors"), productData);
    setShowAddProduct(false);
    setEditingProduct(null);
  };

  const handleTechQuery = async () => {
    if (!techInput.trim()) return;
    const userMsg = techInput;
    setTechInput('');
    setTechnicalChat(prev => [...prev, { role: 'admin', text: userMsg }]);
    setLoadingTech(true);
    const aiResp = await getTechnicalAdvice(userMsg);
    setTechnicalChat(prev => [...prev, { role: 'ai', text: aiResp }]);
    setLoadingTech(false);
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-fadeIn relative pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100 shadow-xl">
        <div className="mb-6 md:mb-0 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter brand-font italic uppercase leading-none">Admin Hub</h1>
          <button onClick={onLogout} className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 hover:underline">Cerrar Sesión</button>
        </div>
        <div className="flex bg-slate-100 p-2 rounded-2xl md:rounded-[2rem] gap-2 items-center flex-wrap justify-center">
          {['inventory', 'orders', 'accounting'].map((t) => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 md:px-8 md:py-3 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'inventory' ? 'Stock' : t === 'orders' ? 'Órdenes' : 'Finanzas'}
            </button>
          ))}
          <button onClick={() => setShowAiTechnical(true)} className="px-4 py-2 md:px-8 md:py-3 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition flex items-center gap-2">
            <span className="text-blue-500 animate-pulse">●</span> IA
          </button>
        </div>
      </header>

      <div className="grid gap-6 md:gap-10">
        {activeTab === 'inventory' && (
          <div className="bg-white p-4 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-10 gap-4">
              <h2 className="text-xl md:text-2xl font-black brand-font italic uppercase tracking-tighter">Inventario Central</h2>
              <button onClick={() => { setEditingProduct(null); setShowAddProduct(true); }} className="bg-blue-600 text-white px-6 py-3 md:px-8 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-700 Transition w-full md:w-auto">+ Nuevo Producto</button>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-0 md:pr-4 scrollbar-hide">
              {state.injectors.map(item => (
                <div key={item.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[2rem] border group hover:border-blue-400 transition-all gap-4">
                  <div className="flex items-center gap-4 md:gap-6">
                    <img src={item.images[0]} className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover shadow-xl border-2 border-white" />
                    <div>
                      <p className="font-black text-slate-900 uppercase text-sm md:text-base">{item.model}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.brand} | {item.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Stock</span>
                      <div className={`text-lg md:text-xl font-black ${item.stock < 5 ? 'text-red-600' : 'text-slate-900'}`}>{item.stock}</div>
                    </div>
                    <button onClick={() => { setEditingProduct(item); setShowAddProduct(true); }} className="px-4 py-2 md:px-6 md:py-3 bg-white rounded-xl md:rounded-2xl text-[10px] font-black uppercase text-blue-600 border shadow-sm">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Accounting and Orders tabs remain as they were for now to focus on the request */}
      </div>

      {/* AI PORTAL MODAL */}
      {showAiTechnical && (
        <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center md:p-4 bg-slate-950/95 backdrop-blur-xl animate-fadeIn">
          <div className="bg-white w-full max-w-7xl rounded-t-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh] border-4 border-slate-900">
            <div className="bg-slate-900 p-6 md:p-8 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-lg md:text-2xl tracking-tighter brand-font italic uppercase">Ingeniero Técnico IA</h3>
                <p className="text-[9px] md:text-[10px] text-blue-500 uppercase font-black tracking-[0.4em] mt-1">Conectado</p>
              </div>
              <button onClick={() => setShowAiTechnical(false)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition-all group">✕</button>
            </div>
            
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100">
              <div className="w-full lg:w-1/3 p-6 md:p-8 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 scrollbar-hide hidden lg:block">
                {/* Panel lateral IA solo visible en PC */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white italic brand-font">IA</div>
                  <h4 className="text-lg font-black brand-font italic uppercase text-slate-800">Estatus</h4>
                </div>
                {aiInsight ? (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-blue-600"><p className="text-xs font-bold text-slate-600 uppercase tracking-tighter">"{aiInsight.summary}"</p></div>
                    <div className="bg-red-950 text-white p-6 rounded-2xl border-2 border-red-500/50"><p className="font-black text-red-500 mb-2 uppercase tracking-widest text-[9px]">Alertas</p>{aiInsight.criticalStock.map((s: string, i: number) => <p key={i} className="text-[10px] font-bold uppercase mb-1">• {s}</p>)}</div>
                  </div>
                ) : (
                  <div className="flex justify-center py-20 animate-pulse text-blue-600 font-black brand-font uppercase">Auditando...</div>
                )}
              </div>
              <div className="flex-1 flex flex-col h-full bg-white relative">
                <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 md:space-y-6 scrollbar-hide">
                  {technicalChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                      <div className={`p-4 md:p-6 rounded-[2rem] max-w-[95%] text-xs md:text-[13px] font-medium leading-relaxed shadow-lg border ${msg.role === 'admin' ? 'bg-slate-900 text-white border-slate-800 rounded-br-none' : 'bg-slate-50 border-slate-200 text-slate-800 rounded-bl-none ai-response-content'}`}>
                        <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 md:p-8 bg-slate-50 border-t border-slate-100 shrink-0">
                  <div className="flex gap-2 md:gap-4">
                    <input type="text" className="flex-1 text-sm border-2 border-slate-200 rounded-xl md:rounded-2xl px-4 py-3 md:px-6 md:py-4 outline-none font-bold" value={techInput} onChange={e => setTechInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleTechQuery()} placeholder="Pregunta a la IA..." />
                    <button onClick={handleTechQuery} className="bg-slate-900 text-white w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl font-black text-xl md:text-2xl hover:bg-slate-800 transition">➔</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW/EDIT PRODUCT MODAL - RESTRUCTURED */}
      {showAddProduct && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-8 bg-slate-950/95 backdrop-blur-2xl">
          <div className="bg-white w-full max-w-5xl rounded-t-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] md:max-h-[90vh] border-4 border-slate-900">
            <div className="p-6 md:p-8 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 brand-font italic uppercase leading-none">{editingProduct ? 'Editar' : 'Nuevo'}</h2>
              <button onClick={() => setShowAddProduct(false)} className="text-slate-400 hover:text-red-500 text-2xl md:text-4xl">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 scrollbar-hide">
              <div className="bg-blue-600 text-white p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row gap-6 items-center shadow-xl shadow-blue-600/30">
                <div className="flex-1 w-full space-y-2">
                   <label className="text-[10px] font-black uppercase text-blue-200 ml-2">Nombre o Modelo</label>
                   <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Inyector Toyota Hilux..." className="w-full bg-white/10 border-2 border-white/20 p-4 rounded-2xl text-base md:text-lg font-black placeholder:text-white/40 outline-none focus:bg-white/20 transition-all" required />
                </div>
                <button type="button" onClick={handleAiAutofill} disabled={isGenerating || !formName} className="bg-white text-blue-600 px-6 py-4 md:px-10 md:py-6 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl disabled:bg-slate-200 shrink-0 w-full md:w-auto">
                  {isGenerating ? '...' : 'Autocompletar IA'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Marca</label><input value={formBrand} onChange={e => setFormBrand(e.target.value)} placeholder="Ej: Bosch" className="w-full border-2 p-3 md:p-4 rounded-xl text-sm font-bold outline-none focus:border-slate-900" required /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Part No.</label><input value={formSku} onChange={e => setFormSku(e.target.value)} placeholder="SKU" className="w-full border-2 p-3 md:p-4 rounded-xl text-sm font-bold outline-none font-mono uppercase focus:border-slate-900" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Precio</label><input type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} placeholder="0.00" className="w-full border-2 p-3 md:p-4 rounded-xl text-sm font-bold outline-none focus:border-slate-900" required /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Stock</label><input type="number" value={formStock} onChange={e => setFormStock(Number(e.target.value))} placeholder="Cant." className="w-full border-2 p-3 md:p-4 rounded-xl text-sm font-bold outline-none focus:border-slate-900" required /></div>
                  </div>
                </div>

                <div className="space-y-2 md:space-y-4">
                   <label className="text-[9px] font-black uppercase text-slate-400 ml-4">Descripción (IA)</label>
                   <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Generado automáticamente..." className="w-full border-2 p-4 md:p-6 rounded-[2rem] text-sm font-bold focus:border-slate-900 outline-none h-[150px] md:h-[220px]" rows={6}></textarea>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-slate-50 border-t shrink-0">
               <button onClick={saveProduct} className="w-full py-4 md:py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg md:text-xl uppercase tracking-widest shadow-2xl hover:bg-black transition-all transform active:scale-95">Guardar Producto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CartView: React.FC<{ cart: any[], removeFromCart: any, createOrder: any }> = ({ cart, removeFromCart, createOrder }) => {
  const navigate = useNavigate();
  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const [loadingOrder, setLoadingOrder] = useState(false);
  
  if (cart.length === 0) return <div className="text-center py-20 space-y-6"><div className="text-6xl md:text-8xl">🛒</div><h2 className="text-2xl md:text-3xl font-black brand-font uppercase italic">Carro Vacío</h2><Link to="/" className="px-8 py-3 md:px-10 md:py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest inline-block text-sm">Ver Catálogo</Link></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 animate-fadeIn pb-32">
      <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter brand-font italic uppercase text-center md:text-left">Tu Carro</h1>
      
      {/* VISTA MÓVIL (Tarjetas) */}
      <div className="space-y-4 md:hidden">
        {cart.map(item => (
          <div key={item.product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center">
            <img src={item.product.images[0]} className="w-20 h-20 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="font-black text-sm text-slate-900 uppercase leading-tight">{item.product.model}</div>
              <div className="flex justify-between items-center mt-2">
                 <span className="text-xs text-slate-500 font-bold">Cant: {item.quantity}</span>
                 <span className="text-lg font-black text-blue-600">${item.product.price * item.quantity}</span>
              </div>
            </div>
            <button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 hover:text-red-500 text-2xl px-2">×</button>
          </div>
        ))}
      </div>

      {/* VISTA ESCRITORIO (Tabla) */}
      <div className="hidden md:block bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {cart.map(item => (
              <tr key={item.product.id} className="hover:bg-slate-50 transition">
                <td className="p-8"><img src={item.product.images[0]} className="w-24 h-24 rounded-3xl object-cover shadow-xl border-4 border-white" /></td>
                <td className="p-8"><div className="font-black text-2xl text-slate-900 leading-none uppercase">{item.product.model}</div><div className="text-[10px] text-blue-600 uppercase font-black tracking-widest mt-2">{item.product.brand}</div></td>
                <td className="p-8 text-center font-black text-slate-400">{item.quantity} UND.</td>
                <td className="p-8 text-right font-black text-slate-900 text-3xl tracking-tighter">${item.product.price * item.quantity}</td>
                <td className="p-8 text-right"><button onClick={() => removeFromCart(item.product.id)} className="text-slate-200 hover:text-red-500 transition text-4xl">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RESUMEN TOTAL FIJO ABAJO EN MÓVIL */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 md:relative md:bg-slate-950 md:text-white md:p-12 md:rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] md:shadow-none">
        <div className="flex justify-between w-full md:block md:w-auto items-center">
            <span className="text-[10px] font-black text-slate-500 md:text-blue-500 uppercase tracking-widest brand-font italic block">Total</span>
            <div className="text-3xl md:text-7xl font-black tracking-tighter brand-font italic uppercase text-slate-900 md:text-white">${total}</div>
        </div>
        <button disabled={loadingOrder} onClick={async () => { setLoadingOrder(true); const id = await createOrder(); navigate(`/order/${id}`); }} className="w-full md:w-auto px-6 py-4 md:px-16 md:py-6 bg-blue-600 text-white rounded-xl md:rounded-3xl font-black text-lg md:text-2xl uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all transform active:scale-95">
            {loadingOrder ? '...' : 'Solicitar'}
        </button>
      </div>
    </div>
  );
};

const OrdersListView: React.FC<{ orders: Order[], role: 'client' | 'admin' }> = ({ orders, role }) => {
  return (
    <div className="space-y-6 md:space-y-10 animate-fadeIn pb-20">
      <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter brand-font italic uppercase">Mis Pedidos</h1>
      <div className="grid gap-4 md:gap-6">
        {orders.map(order => (
          <Link key={order.id} to={`/order/${order.id}`} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 md:p-8 bg-white rounded-2xl md:rounded-[2rem] border hover:border-blue-400 transition-all shadow-lg md:shadow-xl gap-4">
            <div className="flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center font-black border shadow-inner text-blue-600 italic uppercase text-xs md:text-base">#{order.id.substr(0,4)}</div>
                <div>
                    <p className="font-black text-base md:text-xl text-slate-900 uppercase">{order.customerName}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
            </div>
            <div className="flex justify-between w-full md:w-auto items-center md:block text-right">
                <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] ${order.status === OrderStatus.COMPLETED ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}`}>{order.status}</span>
                <p className="font-black text-slate-900 text-2xl md:text-3xl mt-0 md:mt-3 tracking-tighter">${order.items.reduce((a, b) => a + (b.product.price * b.quantity), 0)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const OrderDetailView: React.FC<{ orders: Order[], role: 'client' | 'admin', updateStatus: any, addChat: any }> = ({ orders, role, updateStatus, addChat }) => {
  const { id } = useParams<{ id: string }>();
  const order = orders.find(o => o.id === id);
  const [uploading, setUploading] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  if (!order) return <div className="text-center py-20 text-slate-500 font-black brand-font italic text-2xl uppercase">Pedido no Hallado</div>;
  const total = order.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const url = await uploadImage(`orders/${order.id}/${fieldName}`, reader.result as string);
      await updateStatus(order.id, order.status, { [fieldName]: url });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-10 animate-fadeIn pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter brand-font italic uppercase leading-none">Pedido #{order.id.slice(0,4)}</h1>
            <p className="text-slate-400 font-black text-[9px] md:text-[10px] mt-1 md:mt-2 uppercase tracking-[0.3em]">REF: {order.id}</p>
        </div>
        <div className={`px-4 py-2 md:px-8 md:py-3 rounded-full text-white font-black text-[10px] md:text-xs tracking-widest uppercase ${order.status === OrderStatus.COMPLETED ? 'bg-green-600' : 'bg-blue-600'}`}>{order.status}</div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
        <div className="lg:col-span-2 space-y-6 md:space-y-10">
          {/* Lista de productos */}
          <div className="bg-white rounded-2xl md:rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
             <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100"><h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest uppercase">Productos</h2></div>
             <div className="divide-y divide-slate-100">
               {order.items.map((item, idx) => (
                 <div key={idx} className="p-4 md:p-8 flex items-center justify-between">
                   <div className="flex items-center gap-4 md:gap-6">
                       <img src={item.product.images[0]} className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover border-2 border-white shadow-md" />
                       <div>
                           <p className="font-black text-slate-900 uppercase text-xs md:text-base">{item.product.model}</p>
                           <p className="text-[9px] md:text-[10px] text-slate-400 font-bold tracking-widest uppercase">{item.product.brand} × {item.quantity}</p>
                       </div>
                   </div>
                   <p className="font-black text-slate-900 text-lg md:text-xl tracking-tighter uppercase">${item.product.price * item.quantity}</p>
                 </div>
               ))}
             </div>
             <div className="p-6 md:p-10 bg-slate-950 text-white flex justify-between items-center">
                 <span className="text-slate-500 font-black text-[10px] uppercase tracking-widest uppercase">Subtotal</span>
                 <span className="text-3xl md:text-5xl font-black brand-font italic uppercase">${total}</span>
             </div>
          </div>
          
          {/* Gestión de Pago */}
          <div className="bg-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] shadow-xl border border-slate-100 space-y-6 md:space-y-8">
             <h3 className="text-xl md:text-2xl font-black brand-font italic uppercase tracking-tighter uppercase">Gestión</h3>
             {role === 'client' && order.status === OrderStatus.APPROVED && (
               <div className="bg-blue-50 border-2 border-blue-100 p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] space-y-4 md:space-y-6">
                 <p className="font-black text-blue-900 uppercase text-[9px] tracking-widest uppercase">Datos para Pago</p>
                 <div className="bg-white p-4 rounded-xl border font-mono text-[10px] md:text-xs leading-relaxed text-blue-800 break-all">BNC: 0191-0000-00-0000000000 <br/> RIF: J-000000-0</div>
                 <div className="space-y-4">
                   <input type="text" placeholder="# Referencia" className="w-full border p-4 rounded-xl md:rounded-2xl text-sm font-bold outline-none" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                   <input type="file" onChange={e => handleFileUpload(e, 'paymentProof')} className="block w-full text-xs" />
                   <button disabled={!paymentRef || uploading} onClick={() => updateStatus(order.id, OrderStatus.PAID, { paymentReference: paymentRef })} className="w-full py-4 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-[2rem] font-black uppercase tracking-widest shadow-xl">Informar Pago</button>
                 </div>
               </div>
             )}
             {order.status === OrderStatus.PAID && order.shippingMethod === 'pickup' && (
               <div className="p-6 md:p-10 bg-green-50 border-2 border-green-200 rounded-2xl md:rounded-[3rem] text-center space-y-4 md:space-y-6">
                 <div className="text-4xl md:text-5xl">✅</div>
                 <h3 className="text-lg md:text-xl font-black text-green-900 brand-font uppercase uppercase">Listo para Retiro</h3>
                 <a href={WAZE_URL} target="_blank" className="inline-block px-8 py-4 md:px-12 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-[2rem] font-black uppercase tracking-widest shadow-2xl text-xs md:text-base">Ruta Waze</a>
               </div>
             )}
          </div>
        </div>
        
        {/* Chat Lateral */}
        <aside className="space-y-6 md:space-y-10">
          <ChatWindow messages={order.chat} role={role} onSendMessage={(text) => addChat(order.id, { sender: role, text, timestamp: Date.now() })} />
          {role === 'admin' && (
             <div className="bg-slate-950 p-6 md:p-8 rounded-2xl md:rounded-[2rem] space-y-3">
               <h3 className="text-white font-black brand-font italic uppercase text-[10px] uppercase mb-4 tracking-widest">Controles Admin</h3>
               <button onClick={() => updateStatus(order.id, OrderStatus.APPROVED)} className="w-full py-3 md:py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest uppercase">Aprobar</button>
               <button onClick={() => updateStatus(order.id, OrderStatus.SHIPPED)} className="w-full py-3 md:py-4 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest uppercase">Enviado</button>
               <button onClick={() => updateStatus(order.id, OrderStatus.COMPLETED)} className="w-full py-3 md:py-4 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest uppercase">Completado</button>
             </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default App;