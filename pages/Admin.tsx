import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, updateDoc, doc, addDoc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore"; 
import { db } from '../firebase';
import { AppState, Injector, Order, OrderStatus } from '../types';
// Asegúrate de que estos servicios existan, si no, comenta las líneas que dan error
import { generateProductData } from '../services/geminiService';
import { uploadImage } from '../services/storageService';
import { generateQuotePDF } from '../services/pdfService';
// NUEVO: Importamos servicio de tasa
import { getDolarRate } from '../services/exchangeRateService';

const LOGO_URL = "https://i.postimg.cc/x1nHCVy8/unnamed_removebg_preview.png";

// --- LOGIN DEL ADMIN ---
export const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Puedes cambiar este código por el que prefieras
    if (code === 'panaven2024') onLogin();
    else alert('Código Incorrecto');
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-slate-100 text-center animate-fadeIn">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <img src={LOGO_URL} className="w-20 h-20 object-contain" alt="Logo" />
          </div>
        </div>
        <h2 className="text-2xl font-black italic uppercase mb-6 text-slate-900">Acceso Admin</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="password" 
            value={code} 
            onChange={e => setCode(e.target.value)} 
            placeholder="Código de Acceso" 
            className="w-full border-2 p-4 rounded-2xl text-center font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition" 
          />
          <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition shadow-lg transform active:scale-95">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

// --- DASHBOARD PRINCIPAL ---
export const AdminDashboard: React.FC<{ state: AppState, updateStatus: any, addChat: any, onLogout: () => void }> = ({ state, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'debts'>('inventory');
  
  // --- NUEVO: GESTIÓN DE MONEDA Y TASA ---
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [newRate, setNewRate] = useState('');

  // Cargar tasa automática al iniciar
  useEffect(() => {
    const loadExchangeRate = async () => {
        // 1. Intentar API
        const autoRate = await getDolarRate('bcv');
        if (autoRate && autoRate.rate > 0) {
            setExchangeRate(autoRate.rate);
            setNewRate(autoRate.rate.toString());
            // Guardamos en Firebase para respaldo
            setDoc(doc(db, "settings", "global"), { exchangeRate: autoRate.rate }, { merge: true });
        } else {
            // 2. Si falla, usar Firebase
            onSnapshot(doc(db, "settings", "global"), (doc) => {
                if (doc.exists()) {
                    setExchangeRate(doc.data().exchangeRate || 1);
                    setNewRate(doc.data().exchangeRate?.toString() || '');
                }
            });
        }
    };
    loadExchangeRate();
  }, []);

  const updateExchangeRateManual = async () => {
    const rate = parseFloat(newRate);
    if (!rate || rate <= 0) return alert("Ingresa una tasa válida");
    await setDoc(doc(db, "settings", "global"), { exchangeRate: rate }, { merge: true });
    setExchangeRate(rate);
    alert(`Tasa actualizada manualmente a ${rate} Bs/$`);
  };

  // FUNCIÓN PARA FORMATEAR PRECIO
  const formatPrice = (priceUsd: number) => {
    if (currency === 'VES') {
        const bsPrice = priceUsd * exchangeRate;
        return `Bs ${bsPrice.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  // --- CÁLCULO DE DEUDAS Y CAJA ---
  const { debts, income } = useMemo(() => {
    let income = 0;
    const debtList: Order[] = [];
    state.orders.forEach(order => {
      const totalOrder = order.items.reduce((sum, item) => {
        const price = item.customPrice !== undefined ? item.customPrice : item.product.price;
        return sum + (price * item.quantity);
      }, 0);
      const totalPaid = (order.payments || []).reduce((sum, p) => sum + p.amount, 0);
      income += totalPaid;
      const remaining = totalOrder - totalPaid;
      // Consideramos deuda si hay saldo pendiente y el estatus es activo/aprobado/enviado
      if (remaining > 0 && (order.status === OrderStatus.CREDIT_ACTIVE || order.status === OrderStatus.APPROVED || order.status === OrderStatus.SHIPPED)) {
        debtList.push(order);
      }
    });
    return { debts: debtList, income };
  }, [state.orders]);

  // Estados Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  
  // Estados Producto (Formulario)
  const [editingProduct, setEditingProduct] = useState<Injector | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState([false, false, false]);
  
  // Campos del Formulario
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);
  const [formDesc, setFormDesc] = useState('');
  const [formVideo, setFormVideo] = useState('');
  const [techHoles, setTechHoles] = useState('');
  const [techOhms, setTechOhms] = useState('');
  const [techFlow, setTechFlow] = useState('');
  const [formImages, setFormImages] = useState<string[]>(['', '', '']);

  // ESTADOS NUEVA VENTA (COTIZACIÓN)
  const [saleStep, setSaleStep] = useState(1);
  const [saleClientName, setSaleClientName] = useState('');
  const [saleClientRif, setSaleClientRif] = useState('');
  const [saleClientPhone, setSaleClientPhone] = useState('');
  const [saleCart, setSaleCart] = useState<{ product: Injector; quantity: number; customPrice: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- CARGAR DATOS AL EDITAR ---
  useEffect(() => {
    if (editingProduct) {
      setFormName(editingProduct.model); 
      setFormBrand(editingProduct.brand); 
      setFormSku(editingProduct.sku);
      setFormPrice(editingProduct.price); 
      setFormStock(editingProduct.stock); 
      setFormDesc(editingProduct.description);
      setFormVideo(editingProduct.youtubeUrl || '');
      setTechHoles(editingProduct.specifications?.['Huecos'] || ''); 
      setTechOhms(editingProduct.specifications?.['Ohmiage'] || ''); 
      setTechFlow(editingProduct.specifications?.['Llenado'] || '');
      const imgs = editingProduct.images || []; 
      setFormImages([imgs[0] || '', imgs[1] || '', imgs[2] || '']);
    } else {
      // Limpiar formulario para nuevo producto
      setFormName(''); setFormBrand(''); setFormSku(''); setFormPrice(0); setFormStock(0); setFormDesc(''); setFormVideo('');
      setTechHoles(''); setTechOhms(''); setTechFlow(''); setFormImages(['', '', '']);
    }
  }, [editingProduct, showProductModal]);

  // --- GUARDAR PRODUCTO ---
  const saveProduct = async () => {
    const validImages = formImages.filter(img => img !== '');
    // Validación básica
    if (validImages.length === 0) { alert("Debes subir al menos una foto"); return; }
    if (!formName || !formPrice) { alert("Nombre y Precio son obligatorios"); return; }

    const productData = {
      brand: formBrand || 'GENÉRICO',
      model: formName, 
      sku: formSku || 'SKU-000', 
      price: Number(formPrice), 
      stock: Number(formStock), 
      description: formDesc,
      youtubeUrl: formVideo,
      specifications: { 'Huecos': techHoles, 'Ohmiage': techOhms, 'Llenado': techFlow }, 
      images: validImages
    };

    if (editingProduct) {
      await updateDoc(doc(db, "injectors", editingProduct.id), productData);
    } else {
      await addDoc(collection(db, "injectors"), productData);
    }
    setShowProductModal(false); setEditingProduct(null);
  };

  // --- ELIMINAR PRODUCTO ---
  const handleDeleteProduct = async (id: string) => {
    if(window.confirm("¿Estás seguro de borrar este producto?")) {
        await deleteDoc(doc(db, "injectors", id));
    }
  };

  // --- IA AUTOCOMPLETADO ---
  const handleAiAutofill = async () => {
    if (!formName.trim()) return; 
    setIsGenerating(true);
    try {
        const data = await generateProductData(formName);
        if (data) {
        setFormBrand(data.brand); setFormSku(data.sku); setFormPrice(data.price); setFormDesc(data.description);
        setTechHoles(data.specifications['Huecos'] || ''); setTechOhms(data.specifications['Resistencia'] || ''); setTechFlow(data.specifications['Caudal'] || '');
        }
    } catch (e) {
        console.error("Error IA", e);
    }
    setIsGenerating(false);
  };

  // --- SUBIDA DE IMÁGENES ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const files = e.target.files; if (!files || !files.length) return;
    const newLoading = [...isUploading]; newLoading[index] = true; setIsUploading(newLoading);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const url = await uploadImage(`inventory/${Date.now()}_${index}`, reader.result as string);
            const newImages = [...formImages]; newImages[index] = url; setFormImages(newImages);
        } catch (error) {
            alert("Error al subir imagen");
        }
        newLoading[index] = false; setIsUploading(newLoading);
    };
    reader.readAsDataURL(files[0]);
  };

  // --- LÓGICA DE VENTA MANUAL ---
  const updateSaleQuantity = (item: Injector, delta: number) => {
    setSaleCart(prev => {
      const existing = prev.find(i => i.product.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(i => i.product.id !== item.id);
        return prev.map(i => i.product.id === item.id ? { ...i, quantity: newQty } : i);
      } else if (delta > 0) {
        return [...prev, { product: item, quantity: 1, customPrice: item.price }];
      }
      return prev;
    });
  };

  const updateItemPrice = (id: string, newPrice: number) => {
    setSaleCart(saleCart.map(item => item.product.id === id ? { ...item, customPrice: newPrice } : item));
  };

  const createPremiumOrder = async () => {
    if (!saleClientName || !saleClientRif || saleCart.length === 0) { alert("Faltan datos"); return; }
    
    const itemsForDB = saleCart.map(item => ({
      quantity: item.quantity,
      product: item.product,
      customPrice: item.customPrice
    }));

    const orderData: Omit<Order, 'id'> = {
      items: itemsForDB as any,
      status: OrderStatus.CREDIT_ACTIVE,
      customerName: saleClientName,
      clientRIF: saleClientRif,
      clientBusinessName: "Venta Directa Admin",
      clientPhone: saleClientPhone,
      chat: [],
      createdAt: Date.now(),
      payments: []
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);
    const orderForPdf = { ...orderData, id: docRef.id } as Order;
    generateQuotePDF(orderForPdf);
    
    setShowSaleModal(false); setSaleCart([]); setSaleClientName(''); setSaleClientRif(''); setSaleClientPhone(''); setSaleStep(1);
    alert("Venta registrada y PDF generado.");
  };

  const getSaleQty = (id: string) => saleCart.find(i => i.product.id === id)?.quantity || 0;
  const saleTotal = saleCart.reduce((a,b) => a + (b.customPrice * b.quantity), 0);

  return (
    <div className="space-y-8 animate-fadeIn pb-24 bg-slate-50 min-h-screen">
      
      {/* HEADER (ACTUALIZADO CON MONEDA) */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-b-3xl md:rounded-3xl border border-slate-100 shadow-xl gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 rounded-2xl flex items-center justify-center p-2 shadow-lg">
             <img src={LOGO_URL} className="w-full h-full object-contain" alt="logo" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Panel Admin</h1>
            <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start mt-1">
              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">Caja: {formatPrice(income)}</span>
              
              {/* CONFIG TASA MANUAL */}
               <div className="flex items-center bg-slate-100 rounded-lg p-1">
                 <span className="text-[9px] font-bold text-slate-500 uppercase px-2">Tasa:</span>
                 <input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} className="w-16 bg-white border border-slate-300 rounded px-1 text-xs font-black text-center outline-none focus:border-blue-500" />
                 <button onClick={updateExchangeRateManual} className="text-[9px] bg-slate-200 text-slate-600 px-2 py-1 rounded ml-1 font-bold hover:bg-slate-300">✎</button>
               </div>

               {/* INTERRUPTOR DE MONEDA ADMIN */}
               <button onClick={() => setCurrency(prev => prev === 'USD' ? 'VES' : 'USD')} className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-lg hover:bg-black transition cursor-pointer">
                  <span className={`text-[10px] font-black ${currency === 'USD' ? 'text-green-400' : 'text-slate-400'}`}>$</span>
                  <div className={`w-6 h-3 rounded-full relative transition-colors ${currency === 'VES' ? 'bg-blue-500' : 'bg-slate-600'}`}>
                        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${currency === 'VES' ? 'left-3.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className={`text-[10px] font-black ${currency === 'VES' ? 'text-blue-300' : 'text-slate-400'}`}>Bs</span>
               </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={() => { setShowSaleModal(true); setSaleStep(1); }} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition flex items-center gap-2 transform active:scale-95">
             <span>📝 Nueva Venta</span>
          </button>
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Inventario</button>
            <button onClick={() => setActiveTab('debts')} className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'debts' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400'}`}>Deudas</button>
            <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Pedidos</button>
          </div>
          <button onClick={onLogout} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline px-2">Salir</button>
        </div>
      </header>

      {/* --- VISTA: INVENTARIO --- */}
      {activeTab === 'inventory' && (
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-black text-slate-900 uppercase">Inventario</h2>
             <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase shadow hover:bg-black">+ Agregar</button>
          </div>
          <div className="flex flex-col gap-3">
            {state.injectors.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex gap-3 relative hover:border-blue-300 transition-all group">
                <div className="w-20 h-20 bg-slate-100 rounded-xl flex-shrink-0 overflow-hidden border border-slate-100"><img src={item.images[0]} className="w-full h-full object-cover mix-blend-multiply" /></div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{item.brand} | {item.sku}</span><h3 className="font-bold text-sm text-slate-900 leading-tight truncate">{item.model}</h3></div>
                  <div className="flex justify-between items-end"><span className="text-lg font-black text-slate-900">{formatPrice(item.price)}</span><span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>Stock: {item.stock}</span></div>
                </div>
                <div className="flex flex-col justify-center pl-1"><button onClick={() => { setEditingProduct(item); setShowProductModal(true); }} className="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl flex items-center justify-center border border-slate-200">✎</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VISTA: DEUDAS --- */}
      {activeTab === 'debts' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-orange-500 text-white p-6 rounded-3xl shadow-lg flex justify-between items-center">
             <div><p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Total por Cobrar</p><h2 className="text-4xl font-black tracking-tighter">{formatPrice(debts.reduce((acc, order) => {
                const total = order.items.reduce((s, i) => s + ((i.customPrice||i.product.price) * i.quantity), 0);
                const paid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
                return acc + (total - paid);
             }, 0))}</h2></div>
             <div className="text-5xl opacity-50">📉</div>
          </div>
          <div className="space-y-4">
             {debts.map(order => {
                const total = order.items.reduce((s, i) => s + ((i.customPrice||i.product.price) * i.quantity), 0);
                const paid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
                const debt = total - paid;
                return (
                  <div key={order.id} className="bg-white p-4 rounded-2xl border-l-4 border-orange-500 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div><h3 className="font-black text-slate-900 uppercase">{order.customerName}</h3><p className="text-xs text-slate-500 font-bold uppercase">RIF: {order.clientRIF} {order.clientPhone && `• Tel: ${order.clientPhone}`}</p><p className="text-[10px] text-slate-400 mt-1">Pedido #{order.id.slice(0,4)} • {new Date(order.createdAt).toLocaleDateString()}</p></div>
                     <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end"><div className="text-right"><p className="text-[9px] font-bold text-slate-400 uppercase">Debe</p><p className="text-xl font-black text-red-600">-{formatPrice(debt)}</p></div><Link to={`/order/${order.id}`} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-black">Cobrar</Link></div>
                  </div>
                );
             })}
             {debts.length === 0 && <div className="text-center py-10 text-slate-400 font-bold uppercase">No hay deudas pendientes.</div>}
          </div>
        </div>
      )}

      {/* --- VISTA: PEDIDOS --- */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
           {state.orders.map(order => (
              <Link key={order.id} to={`/order/${order.id}`} className="block bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
                 <div className="flex justify-between items-center">
                    <div><span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1 ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>{order.status}</span><p className="font-bold text-sm text-slate-900 uppercase">{order.customerName}</p><p className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</p></div>
                    <div className="text-right font-black text-lg text-slate-900">{formatPrice(order.items.reduce((a,b) => a + ((b.customPrice||b.product.price) * b.quantity), 0))}</div>
                 </div>
              </Link>
           ))}
        </div>
      )}

      {/* --- MODAL NUEVA VENTA (WIZARD POR PASOS) --- */}
      {showSaleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden h-[90vh] flex flex-col">
            
            {/* Header Wizard */}
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 uppercase">
                  {saleStep === 1 ? '1. Escoger Productos' : '2. Datos y Cotización'}
              </h3>
              <button onClick={() => setShowSaleModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm">✕</button>
            </div>

            {/* PASO 1: SELECCIÓN DE PRODUCTOS */}
            {saleStep === 1 && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b">
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="🔍 Buscar repuesto..." className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 bg-slate-50" />
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {state.injectors.filter(i => i.model.toLowerCase().includes(searchTerm.toLowerCase()) || i.sku.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                            const qty = getSaleQty(item.id);
                            return (
                                <div key={item.id} className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex gap-3 items-center">
                                    <div className="w-14 h-14 bg-slate-100 rounded-lg overflow-hidden shrink-0"><img src={item.images[0]} className="w-full h-full object-cover mix-blend-multiply" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[8px] font-black uppercase text-slate-400">{item.sku}</p>
                                        <p className="text-xs font-bold text-slate-900 leading-tight truncate">{item.model}</p>
                                        <p className="text-xs font-black text-blue-600 mt-1">{formatPrice(item.price)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {qty > 0 && <button onClick={() => updateSaleQuantity(item, -1)} className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg font-bold hover:bg-slate-200">-</button>}
                                        {qty > 0 && <span className="font-black text-sm w-4 text-center">{qty}</span>}
                                        <button onClick={() => updateSaleQuantity(item, 1)} className={`w-8 h-8 rounded-lg font-bold transition ${qty > 0 ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`}>+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t bg-slate-50">
                        <button disabled={saleCart.length === 0} onClick={() => setSaleStep(2)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                            Añadir Productos ({saleCart.reduce((a,b) => a + b.quantity, 0)}) →
                        </button>
                    </div>
                </div>
            )}

            {/* PASO 2: DATOS Y CONFIRMACIÓN */}
            {saleStep === 2 && (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Columna Datos */}
                    <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50">
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Datos del Cliente</h4>
                        <div className="space-y-3">
                            <input value={saleClientName} onChange={e => setSaleClientName(e.target.value)} placeholder="Nombre Completo *" className="w-full border-2 p-3 rounded-xl text-sm font-bold outline-none focus:border-slate-900 bg-white" />
                            <input value={saleClientRif} onChange={e => setSaleClientRif(e.target.value)} placeholder="RIF / C.I. *" className="w-full border-2 p-3 rounded-xl text-sm font-bold outline-none focus:border-slate-900 bg-white" />
                            <input value={saleClientPhone} onChange={e => setSaleClientPhone(e.target.value)} placeholder="Teléfono *" className="w-full border-2 p-3 rounded-xl text-sm font-bold outline-none focus:border-slate-900 bg-white" />
                        </div>
                        <button onClick={() => setSaleStep(1)} className="mt-6 text-xs font-bold text-slate-400 underline hover:text-slate-600">← Volver a escoger productos</button>
                    </div>
                    
                    {/* Columna Resumen */}
                    <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col bg-white">
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-3">Resumen (Editar Precios en USD)</h4>
                        <div className="space-y-2 flex-1 overflow-y-auto min-h-[150px]">
                            {saleCart.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex-1 min-w-0 mr-2">
                                        <p className="text-[10px] font-bold uppercase text-slate-700 truncate">{item.product.model}</p>
                                        <p className="text-[9px] text-slate-400">Cant: {item.quantity}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-xs">$</span>
                                        <input type="number" value={item.customPrice} onChange={(e) => updateItemPrice(item.product.id, Number(e.target.value))} className="w-16 border rounded p-1 text-right font-black text-blue-600 text-xs outline-none focus:border-blue-500 bg-white" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto pt-4 border-t border-slate-100">
                            <div className="flex justify-between text-xl font-black text-slate-900 mb-4"><span>Total:</span><span>{formatPrice(saleTotal)}</span></div>
                            <button onClick={createPremiumOrder} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black flex items-center justify-center gap-2 transition active:scale-95">
                                <span>📄 Generar PDF y Cargar Deuda</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO (EDICIÓN) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
           <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 uppercase">{editingProduct ? 'Editar' : 'Nuevo'}</h3>
              <button onClick={() => setShowProductModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div><label className="text-xs font-black uppercase text-slate-500 mb-3 block">1. Fotos (Obligatorias)</label><div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((index) => (<div key={index} className="space-y-2"><label className={`relative block w-full aspect-square border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${formImages[index] ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'}`}>{isUploading[index] ? <span className="text-blue-500 font-bold text-xs animate-pulse">Subiendo...</span> : formImages[index] ? <img src={formImages[index]} className="absolute inset-0 w-full h-full object-cover rounded-2xl" /> : <><span className="text-3xl text-slate-300 mb-1">+</span><span className="text-[9px] font-bold text-slate-400 uppercase">{index === 0 ? 'Frontal' : index === 1 ? 'Perfil' : 'Conector'}</span></>}<input type="file" className="hidden" onChange={(e) => handleImageUpload(e, index)} /></label></div>))}</div></div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4"><div className="flex justify-between items-center"><label className="text-xs font-black uppercase text-slate-500">2. Datos</label><button onClick={handleAiAutofill} disabled={isGenerating} className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-lg font-bold uppercase tracking-widest">{isGenerating ? '...' : 'IA Auto'}</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="text-[9px] font-bold uppercase text-slate-400">Nombre</label><input value={formName} onChange={e => setFormName(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div><div><label className="text-[9px] font-bold uppercase text-slate-400">Marca</label><input value={formBrand} onChange={e => setFormBrand(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div><div><label className="text-[9px] font-bold uppercase text-slate-400">SKU</label><input value={formSku} onChange={e => setFormSku(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div></div></div>
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-4"><label className="text-xs font-black uppercase text-blue-800">3. Specs</label><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><label className="text-[9px] font-bold uppercase text-blue-400">Stock</label><input type="number" value={formStock} onChange={e => setFormStock(Number(e.target.value))} className="w-full border-2 border-blue-200 p-3 rounded-xl font-black text-lg outline-none text-center" /></div><div><label className="text-[9px] font-bold uppercase text-blue-400">Ohms</label><input value={techOhms} onChange={e => setTechOhms(e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl font-bold text-sm outline-none text-center" /></div><div><label className="text-[9px] font-bold uppercase text-blue-400">Huecos</label><input value={techHoles} onChange={e => setTechHoles(e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl font-bold text-sm outline-none text-center" /></div><div><label className="text-[9px] font-bold uppercase text-blue-400">Caudal</label><input value={techFlow} onChange={e => setTechFlow(e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl font-bold text-sm outline-none text-center" /></div></div></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="md:col-span-1"><label className="text-[9px] font-bold uppercase text-slate-400">Precio</label><input type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} className="w-full border-2 border-green-200 bg-green-50 p-4 rounded-2xl font-black text-2xl outline-none text-green-700" /></div><div className="md:col-span-2 space-y-2"><label className="text-[9px] font-bold uppercase text-slate-400">Video URL</label><input value={formVideo} onChange={e => setFormVideo(e.target.value)} className="w-full border-2 border-red-100 bg-red-50 p-3 rounded-xl font-bold text-sm outline-none text-red-800" /><label className="text-[9px] font-bold uppercase text-slate-400">Desc</label><textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div></div>
            </div>
            <div className="p-6 border-t bg-slate-50"><button onClick={saveProduct} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Guardar Producto</button></div>
          </div>
        </div>
      )}
    </div>
  );
};