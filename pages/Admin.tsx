import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, updateDoc, doc, addDoc } from "firebase/firestore"; 
import { db } from '../firebase';
import { AppState, Injector, Order, OrderStatus } from '../types';
import { generateProductData, getAdminInsights, getTechnicalAdvice } from '../services/geminiService';
import { uploadImage } from '../services/storageService';
import { generateQuotePDF } from '../services/pdfService';

// --- LOGIN DEL ADMIN ---
export const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === 'panaven2024') onLogin();
    else alert('Código Incorrecto');
  };
  return (
    <div className="max-w-md mx-4 md:mx-auto mt-20 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100 text-center">
      <h2 className="text-2xl font-black brand-font italic uppercase mb-6 text-slate-900">Acceso Admin</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="Código de Acceso" className="w-full border-2 p-4 rounded-2xl text-center font-bold outline-none focus:border-blue-600" />
        <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition shadow-lg">Entrar</button>
      </form>
    </div>
  );
};

// --- DASHBOARD PRINCIPAL ---
export const AdminDashboard: React.FC<{ state: AppState, updateStatus: any, addChat: any, onLogout: () => void }> = ({ state, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'finances'>('inventory');
  
  // --- FINANZAS ---
  const finances = useMemo(() => {
    let income = 0;      
    let receivables = 0; 

    state.orders.forEach(order => {
      const totalOrder = order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const totalPaid = (order.payments || []).reduce((sum, p) => sum + p.amount, 0);
      
      income += totalPaid; // Dinero real

      if (order.status === OrderStatus.CREDIT_ACTIVE || order.status === OrderStatus.APPROVED || order.status === OrderStatus.SHIPPED) {
        const debt = totalOrder - totalPaid;
        if (debt > 0) receivables += debt;
      }
    });
    return { income, receivables };
  }, [state.orders]);

  // Estados de Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  
  // Estados Producto (Inventario)
  const [editingProduct, setEditingProduct] = useState<Injector | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState([false, false, false]);
  
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);
  const [formDesc, setFormDesc] = useState('');
  const [techHoles, setTechHoles] = useState('');
  const [techOhms, setTechOhms] = useState('');
  const [techFlow, setTechFlow] = useState('');
  const [formImages, setFormImages] = useState<string[]>(['', '', '']);

  // Estados Venta Manual (Cotización Premium)
  const [saleClientName, setSaleClientName] = useState('');
  const [saleClientRif, setSaleClientRif] = useState('');
  const [saleClientBusiness, setSaleClientBusiness] = useState('');
  // MODIFICADO: Ahora el carrito guarda un 'customPrice'
  const [saleCart, setSaleCart] = useState<{ product: Injector; quantity: number; customPrice: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- LOGICA INVENTARIO ---
  useEffect(() => {
    if (editingProduct) {
      setFormName(editingProduct.model); setFormBrand(editingProduct.brand); setFormSku(editingProduct.sku);
      setFormPrice(editingProduct.price); setFormStock(editingProduct.stock); setFormDesc(editingProduct.description);
      setTechHoles(editingProduct.specifications?.['Huecos'] || ''); setTechOhms(editingProduct.specifications?.['Ohmiage'] || ''); setTechFlow(editingProduct.specifications?.['Llenado'] || '');
      const imgs = editingProduct.images || []; setFormImages([imgs[0] || '', imgs[1] || '', imgs[2] || '']);
    } else {
      setFormName(''); setFormBrand(''); setFormSku(''); setFormPrice(0); setFormStock(0); setFormDesc('');
      setTechHoles(''); setTechOhms(''); setTechFlow(''); setFormImages(['', '', '']);
    }
  }, [editingProduct, showProductModal]);

  const saveProduct = async () => {
    const validImages = formImages.filter(img => img !== '');
    if (validImages.length === 0) { alert("Sube al menos la foto principal"); return; }
    const productData = {
      brand: formBrand, model: formName, sku: formSku, price: Number(formPrice), stock: Number(formStock), description: formDesc,
      specifications: { 'Huecos': techHoles, 'Ohmiage': techOhms, 'Llenado': techFlow }, images: validImages
    };
    if (editingProduct) await updateDoc(doc(db, "injectors", editingProduct.id), productData);
    else await addDoc(collection(db, "injectors"), productData);
    setShowProductModal(false); setEditingProduct(null);
  };

  const handleAiAutofill = async () => {
    if (!formName.trim()) return; setIsGenerating(true);
    const data = await generateProductData(formName);
    if (data) {
      setFormBrand(data.brand); setFormSku(data.sku); setFormPrice(data.price); setFormDesc(data.description);
      setTechHoles(data.specifications['Huecos'] || ''); setTechOhms(data.specifications['Resistencia'] || ''); setTechFlow(data.specifications['Caudal'] || '');
    }
    setIsGenerating(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const files = e.target.files; if (!files || !files.length) return;
    const newLoading = [...isUploading]; newLoading[index] = true; setIsUploading(newLoading);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const url = await uploadImage(`inventory/${Date.now()}_${index}`, reader.result as string);
        const newImages = [...formImages]; newImages[index] = url; setFormImages(newImages);
        newLoading[index] = false; setIsUploading(newLoading);
    };
    reader.readAsDataURL(files[0]);
  };

  // --- LOGICA VENTA MANUAL (PREMIUM) ---
  const addToSaleCart = (item: Injector) => {
    const existing = saleCart.find(i => i.product.id === item.id);
    if (existing) {
      setSaleCart(saleCart.map(i => i.product.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      // Al agregar, usamos el precio base, pero lo guardamos como 'customPrice' para poder editarlo luego
      setSaleCart([...saleCart, { product: item, quantity: 1, customPrice: item.price }]);
    }
  };

  // Función para modificar precio manualmente en el carrito
  const updateItemPrice = (id: string, newPrice: number) => {
    setSaleCart(saleCart.map(item => 
      item.product.id === id ? { ...item, customPrice: newPrice } : item
    ));
  };

  const removeFromSaleCart = (id: string) => {
    setSaleCart(saleCart.filter(i => i.product.id !== id));
  };

  const createPremiumOrder = async () => {
    if (!saleClientName || !saleClientRif || saleCart.length === 0) { 
      alert("Faltan datos del cliente o productos."); 
      return; 
    }

    // Transformamos el carrito para que el producto guardado tenga el precio modificado
    const itemsForDB = saleCart.map(item => ({
      quantity: item.quantity,
      product: {
        ...item.product,
        price: item.customPrice // Sobreescribimos el precio solo para esta orden
      }
    }));

    const orderData: Omit<Order, 'id'> = {
      items: itemsForDB,
      status: OrderStatus.CREDIT_ACTIVE,
      customerName: saleClientName,
      clientRIF: saleClientRif,
      clientBusinessName: saleClientBusiness,
      chat: [],
      createdAt: Date.now(),
      payments: []
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);
    
    // Para el PDF también usamos los items con precio modificado
    const orderForPdf = { ...orderData, id: docRef.id } as Order;
    generateQuotePDF(orderForPdf);

    setShowSaleModal(false);
    setSaleCart([]); setSaleClientName(''); setSaleClientRif(''); setSaleClientBusiness('');
    alert("Cotización generada con precios personalizados.");
  };

  // URL del Logo (Para mantener el diseño)
  const LOGO_URL = "https://i.postimg.cc/x1nHCVy8/unnamed_removebg_preview.png";

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center p-2 shadow-lg">
             <img src={LOGO_URL} className="w-full h-full object-contain" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Panel Admin</h1>
            <div className="flex gap-4 items-center justify-center md:justify-start mt-1">
              <button onClick={onLogout} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline">Cerrar Sesión</button>
              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">Caja: ${finances.income}</span>
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Inventario</button>
          <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Pedidos</button>
          <button onClick={() => setActiveTab('finances')} className={`px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeTab === 'finances' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Finanzas</button>
        </div>
      </header>

      {/* VISTA INVENTARIO */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-black text-slate-900 uppercase">Productos ({state.injectors.length})</h2>
             <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-blue-600 transition">+ Nuevo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.injectors.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-center group hover:border-blue-300 transition-all">
                <img src={item.images[0]} className="w-20 h-20 rounded-xl object-cover bg-slate-50" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-slate-900 uppercase truncate">{item.model}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{item.brand} | {item.sku}</p>
                  <div className="flex justify-between mt-1"><p className="text-lg font-black text-blue-600">${item.price}</p><span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{item.stock} Und.</span></div>
                </div>
                <button onClick={() => { setEditingProduct(item); setShowProductModal(true); }} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition">✎</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA PEDIDOS */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-black text-slate-900 uppercase">Bandeja de Pedidos</h2>
             <button onClick={() => setShowSaleModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition">📝 Nueva Cotización Premium</button>
          </div>
          <div className="space-y-3">
            {state.orders.map(order => {
                const total = order.items.reduce((a,b) => a + (b.product.price * b.quantity), 0);
                const paid = (order.payments || []).reduce((a,b) => a + b.amount, 0);
                const pending = total - paid;
                return (
                  <Link key={order.id} to={`/order/${order.id}`} className="block bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-lg text-slate-900 uppercase">#{order.id.slice(0,4)}</span>
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${order.status === OrderStatus.CREDIT_ACTIVE ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{order.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase">{order.customerName} {order.clientBusinessName ? `(${order.clientBusinessName})` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-slate-900">${total}</p>
                        {pending > 0 && <p className="text-[10px] font-bold text-red-500 uppercase">Resta: ${pending}</p>}
                      </div>
                    </div>
                  </Link>
                );
            })}
          </div>
        </div>
      )}

      {/* VISTA FINANZAS */}
      {activeTab === 'finances' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 flex flex-col justify-between h-48 relative overflow-hidden group">
              <div className="absolute right-[-20px] top-[-20px] text-9xl text-white/5 font-black z-0 group-hover:scale-110 transition-transform">$</div>
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Ingresos Reales</p>
                <h3 className="text-5xl font-black tracking-tighter">${finances.income}</h3>
              </div>
              <div className="relative z-10 mt-auto">
                <span className="text-[10px] bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">Dinero en Caja</span>
              </div>
            </div>
            <div className="bg-white text-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 flex flex-col justify-between h-48 relative overflow-hidden">
              <div className="absolute right-[-20px] top-[-20px] text-9xl text-slate-100 font-black z-0">?</div>
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Por Cobrar</p>
                <h3 className="text-5xl font-black tracking-tighter text-orange-500">${finances.receivables}</h3>
              </div>
              <div className="relative z-10 mt-auto">
                <span className="text-[10px] bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-bold uppercase tracking-widest">Crédito en Calle</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-6 flex items-center gap-2"><span>📉</span> Detalle de Cobros Pendientes</h3>
            <div className="space-y-4">
              {state.orders.map(order => {
                const total = order.items.reduce((a,b) => a + (b.product.price * b.quantity), 0);
                const paid = (order.payments || []).reduce((a,b) => a + b.amount, 0);
                const debt = total - paid;
                if (debt > 0 && (order.status === OrderStatus.CREDIT_ACTIVE || order.status === OrderStatus.APPROVED || order.status === OrderStatus.SHIPPED)) {
                    return (
                        <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-black text-xs">#{order.id.slice(0,4)}</div>
                            <div>
                              <p className="font-bold text-sm text-slate-900 uppercase">{order.customerName} {order.clientBusinessName ? `(${order.clientBusinessName})` : ''}</p>
                              <p className="text-[10px] text-slate-400 font-black uppercase">{new Date(order.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-orange-600">-${debt}</p>
                            <Link to={`/order/${order.id}`} className="text-[10px] text-blue-600 font-bold uppercase hover:underline">Registrar Pago</Link>
                          </div>
                        </div>
                    );
                }
                return null;
              })}
              {finances.receivables === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">🎉 Excelente. No hay cuentas por cobrar.</div>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COTIZACIÓN PREMIUM (VENTA MANUAL) */}
      {showSaleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 uppercase">Nota Cliente Premium</h3>
              <button onClick={() => setShowSaleModal(false)} className="text-2xl text-slate-400 hover:text-red-500">×</button>
            </div>
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
               {/* Selección de Productos */}
               <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50">
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar inyector..." className="w-full p-3 border-2 rounded-xl mb-4 text-sm font-bold outline-none" />
                  <div className="space-y-2">
                    {state.injectors.filter(i => i.model.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                        <div key={item.id} onClick={() => addToSaleCart(item)} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-400 flex items-center gap-3">
                            <img src={item.images[0]} className="w-10 h-10 rounded-lg object-cover" />
                            <div className="flex-1"><p className="text-[10px] font-black uppercase text-slate-900">{item.model}</p><p className="text-[9px] font-bold text-blue-600">${item.price}</p></div>
                            <span className="text-xl text-blue-600 font-bold">+</span>
                        </div>
                    ))}
                  </div>
               </div>
               
               {/* Datos Cliente y Generación PDF */}
               <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col">
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Datos del Cliente</h4>
                  <div className="space-y-3 mb-6">
                      <input value={saleClientName} onChange={e => setSaleClientName(e.target.value)} placeholder="Nombre Completo *" className="w-full border-2 p-3 rounded-xl text-sm font-bold outline-none" />
                      <input value={saleClientRif} onChange={e => setSaleClientRif(e.target.value)} placeholder="Cédula / RIF *" className="w-full border-2 p-3 rounded-xl text-sm font-bold outline-none" />
                      <input value={saleClientBusiness} onChange={e => setSaleClientBusiness(e.target.value)} placeholder="Nombre del Negocio (Opcional)" className="w-full border-2 p-3 rounded-xl text-sm font-bold outline-none" />
                  </div>
                  
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Items (Precio Editable)</h4>
                  <div className="space-y-2 mb-6 flex-1 overflow-y-auto">
                      {saleCart.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-bold p-2 bg-slate-50 rounded-lg group">
                              <span className="flex-1 mr-2">{item.quantity} x {item.product.model.substring(0, 15)}...</span>
                              <div className="flex items-center gap-2">
                                {/* INPUT DE PRECIO EDITABLE */}
                                <span className="text-slate-400">$</span>
                                <input 
                                  type="number" 
                                  value={item.customPrice} 
                                  onChange={(e) => updateItemPrice(item.product.id, Number(e.target.value))}
                                  className="w-16 border rounded p-1 text-right font-black text-blue-600 outline-none focus:border-blue-500"
                                />
                                <button onClick={() => removeFromSaleCart(item.product.id)} className="text-red-400 hover:text-red-600 ml-1">×</button>
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  <div className="mt-auto pt-4 border-t">
                      <div className="flex justify-between text-xl font-black text-slate-900 mb-4"><span>Total:</span><span>${saleCart.reduce((a,b) => a + (b.customPrice * b.quantity), 0)}</span></div>
                      
                      <button onClick={createPremiumOrder} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black flex items-center justify-center gap-2">
                         <span>📄 Generar PDF y Cargar Deuda</span>
                      </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO INVENTARIO */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
           <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 uppercase">{editingProduct ? 'Editar Inyector' : 'Nuevo Inyector'}</h3>
              <button onClick={() => setShowProductModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-400 hover:text-red-500 font-bold shadow-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div><label className="text-xs font-black uppercase text-slate-500 mb-3 block">1. Fotos (Obligatorias)</label><div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((index) => (<div key={index} className="space-y-2"><label className={`relative block w-full aspect-square border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${formImages[index] ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'}`}>{isUploading[index] ? <span className="text-blue-500 font-bold text-xs animate-pulse">Subiendo...</span> : formImages[index] ? <img src={formImages[index]} className="absolute inset-0 w-full h-full object-cover rounded-2xl" /> : <><span className="text-3xl text-slate-300 mb-1">+</span><span className="text-[9px] font-bold text-slate-400 uppercase">{index === 0 ? 'Frontal' : index === 1 ? 'Perfil' : 'Conector'}</span></>}<input type="file" className="hidden" onChange={(e) => handleImageUpload(e, index)} /></label></div>))}</div></div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4"><div className="flex justify-between items-center"><label className="text-xs font-black uppercase text-slate-500">2. Datos</label><button onClick={handleAiAutofill} disabled={isGenerating} className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-lg font-bold uppercase tracking-widest">{isGenerating ? '...' : 'IA Auto'}</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="text-[9px] font-bold uppercase text-slate-400">Nombre</label><input value={formName} onChange={e => setFormName(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div><div><label className="text-[9px] font-bold uppercase text-slate-400">Marca</label><input value={formBrand} onChange={e => setFormBrand(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div><div><label className="text-[9px] font-bold uppercase text-slate-400">SKU</label><input value={formSku} onChange={e => setFormSku(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div></div></div>
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-4"><label className="text-xs font-black uppercase text-blue-800">3. Specs</label><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><label className="text-[9px] font-bold uppercase text-blue-400">Stock</label><input type="number" value={formStock} onChange={e => setFormStock(Number(e.target.value))} className="w-full border-2 border-blue-200 p-3 rounded-xl font-black text-lg outline-none text-center" /></div><div><label className="text-[9px] font-bold uppercase text-blue-400">Ohms</label><input value={techOhms} onChange={e => setTechOhms(e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl font-bold text-sm outline-none text-center" /></div><div><label className="text-[9px] font-bold uppercase text-blue-400">Huecos</label><input value={techHoles} onChange={e => setTechHoles(e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl font-bold text-sm outline-none text-center" /></div><div><label className="text-[9px] font-bold uppercase text-blue-400">Caudal</label><input value={techFlow} onChange={e => setTechFlow(e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl font-bold text-sm outline-none text-center" /></div></div></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="md:col-span-1"><label className="text-[9px] font-bold uppercase text-slate-400">Precio</label><input type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} className="w-full border-2 border-green-200 bg-green-50 p-4 rounded-2xl font-black text-2xl outline-none text-green-700" /></div><div className="md:col-span-2"><label className="text-[9px] font-bold uppercase text-slate-400">Desc</label><textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none" /></div></div>
            </div>
            <div className="p-6 border-t bg-slate-50"><button onClick={saveProduct} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};