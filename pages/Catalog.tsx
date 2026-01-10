import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // <--- ESTA LÍNEA ES LA QUE FALTABA
import { Injector, CartItem } from '../types';

interface CatalogProps {
  injectors: Injector[];
  cart: CartItem[];
  addToCart: (product: Injector, quantity: number) => void;
  removeFromCart: (productId: string) => void;
}

export const Catalog: React.FC<CatalogProps> = ({ injectors, cart, addToCart, removeFromCart }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<Injector | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [searchTerm, setSearchTerm] = useState(''); 
  
  const [activeMedia, setActiveMedia] = useState<string | 'video' | null>(null);

  const categories = ['All', 'INYECTORES'];

  // LÓGICA DE FILTRADO (CATEGORÍA + BÚSQUEDA)
  const filtered = injectors.filter(item => {
    const categoryMatch = selectedCategory === 'All' ? true : true; 
    const term = searchTerm.toLowerCase();
    const searchMatch = 
        item.model.toLowerCase().includes(term) || 
        item.brand.toLowerCase().includes(term) || 
        item.sku.toLowerCase().includes(term);

    return categoryMatch && searchMatch;
  });

  const totalAmount = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const getQuantity = (id: string) => {
    return cart.find(item => item.product.id === id)?.quantity || 0;
  };

  const openModal = (product: Injector) => {
    setModalQty(1);
    setSelectedProduct(product);
    setActiveMedia(product.images[0]); 
  };

  // --- REPRODUCTOR HÍBRIDO (YouTube + MP4) ---
  const renderMediaPlayer = (url: string) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})(?:\S+)?/);
    const youtubeId = ytMatch ? ytMatch[1] : null;

    if (youtubeId) {
      return (
        <iframe 
            className="w-full h-full rounded-2xl" 
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&autoplay=1&mute=1&modestbranding=1&playsinline=1`} 
            title="Video"
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
        ></iframe>
      );
    } else {
      return (
        <video 
          className="w-full h-full rounded-2xl object-cover bg-black" 
          controls 
          autoPlay 
          muted 
          playsInline 
          loop
        >
          <source src={url} type="video/mp4" />
          Tu navegador no soporta este video.
        </video>
      );
    }
  };

  return (
    <div className="pb-32 animate-fadeIn bg-slate-50 min-h-screen">
      
      {/* HEADER FIJO: BUSCADOR + CATEGORÍAS */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md pb-2 border-b border-slate-200 shadow-sm">
         
         {/* 1. BARRA DE BÚSQUEDA */}
         <div className="p-4 pb-2">
            <div className="relative group">
                <span className="absolute left-4 top-3.5 text-slate-400 text-lg group-focus-within:text-blue-500 transition-colors">🔍</span>
                <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, marca o código..." 
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border-none shadow-sm bg-white font-bold text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300 placeholder:font-medium"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-4 top-3.5 text-slate-300 hover:text-slate-500 font-bold">✕</button>
                )}
            </div>
         </div>

         {/* 2. PILLS DE CATEGORÍAS */}
         <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex-shrink-0 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{cat}</button>
            ))}
            <div className="w-2 flex-shrink-0"></div>
         </div>
      </div>

      {/* LISTA DE PRODUCTOS */}
      <div className="px-4 flex flex-col gap-3 mt-4">
        {filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-2">😕</p>
                <p className="font-bold text-sm">No encontramos "{searchTerm}"</p>
            </div>
        ) : (
            filtered.map(item => {
            const qty = getQuantity(item.id);
            return (
                <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex gap-3 relative animate-slideUp">
                <div className="w-24 h-24 bg-slate-100 rounded-xl flex-shrink-0 overflow-hidden border border-slate-100 cursor-pointer" onClick={() => openModal(item)}>
                    <img src={item.images[0]} alt={item.model} className="w-full h-full object-cover mix-blend-multiply" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div onClick={() => openModal(item)} className="cursor-pointer">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block">{item.brand}</span>
                        <h3 className="font-bold text-sm text-slate-800 leading-tight mb-1 line-clamp-2">{item.model}</h3>
                        {item.stock === 0 ? <span className="inline-block bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-100">Agotado</span> : item.stock < 5 ? <span className="inline-block bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-100">Quedan {item.stock}</span> : <span className="inline-block bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-green-100">Disponible</span>}
                    </div>
                    <div className="flex items-end justify-between mt-2"><span className="text-lg font-black text-slate-900">${item.price}</span></div>
                </div>
                <div className="flex flex-col justify-between items-end pl-1">
                    <button onClick={() => openModal(item)} className="text-blue-400 hover:text-blue-600 p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>
                    {item.stock > 0 && (
                        <div className="flex items-center border border-slate-300 rounded-full h-8 min-w-[90px] bg-white mt-auto shadow-sm">
                            <button onClick={() => removeFromCart(item.id)} className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-red-500 text-lg font-bold pb-1 active:scale-90 transition-transform">−</button>
                            <span className="flex-1 text-center font-black text-sm text-slate-900 px-1">{qty}</span>
                            <button onClick={() => addToCart(item, 1)} className="w-8 h-full flex items-center justify-center text-slate-900 hover:text-blue-600 text-lg font-bold pb-1 active:scale-90 transition-transform">+</button>
                        </div>
                    )}
                </div>
                </div>
            );
            })
        )}
      </div>

      {/* BARRA INFERIOR */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-slideUp">
            <Link to="/cart" className="bg-slate-200 text-slate-900 w-full p-1 pl-4 pr-1 rounded-full flex justify-between items-center shadow-2xl border border-slate-300 backdrop-blur-md bg-opacity-90">
                <span className="font-bold text-slate-600 text-sm">Ver Pedido ({totalItems})</span>
                <div className="flex items-center gap-2"><span className="font-black text-slate-900 text-lg mr-2">${totalAmount}</span><div className="bg-slate-900 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></div></div>
            </Link>
        </div>
      )}

      {/* MODAL DETALLE */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedProduct(null)}></div>
          <div className="bg-white w-full max-w-4xl rounded-t-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col md:flex-row relative z-10 animate-slideUp">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-20 bg-slate-100 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md hover:bg-red-100 hover:text-red-600 transition">✕</button>
            
            {/* LADO IZQUIERDO: VISOR MULTIMEDIA */}
            <div className="w-full md:w-1/2 bg-slate-100 p-4 flex flex-col justify-center items-center h-auto">
                <div className="flex items-center justify-center w-full h-48 md:h-80 relative mb-4">
                    {activeMedia === 'video' && selectedProduct.youtubeUrl ? (
                        renderMediaPlayer(selectedProduct.youtubeUrl)
                    ) : (
                        <img 
                            src={activeMedia !== 'video' && activeMedia ? activeMedia : selectedProduct.images[0]} 
                            className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-300 hover:scale-110 cursor-zoom-in" 
                        />
                    )}
                </div>
                <div className="flex gap-2 mt-4 overflow-x-auto justify-center w-full px-2">
                    {selectedProduct.images.map((img, idx) => (
                        <button key={idx} onClick={() => setActiveMedia(img)} className={`w-12 h-12 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${activeMedia === img ? 'border-blue-600 shadow-md scale-105' : 'border-slate-300 opacity-60 hover:opacity-100'}`}>
                            <img src={img} className="w-full h-full object-cover" />
                        </button>
                    ))}
                    {selectedProduct.youtubeUrl && (
                        <button onClick={() => setActiveMedia('video')} className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all bg-red-600 text-white ${activeMedia === 'video' ? 'border-red-800 shadow-md scale-105 ring-2 ring-red-300' : 'border-red-600 opacity-80 hover:opacity-100'}`}>
                            <span className="text-sm">▶</span>
                        </button>
                    )}
                </div>
            </div>
            
            {/* LADO DERECHO: DATOS */}
            <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto bg-white">
              <span className="text-blue-600 font-black text-[9px] uppercase tracking-widest">{selectedProduct.brand}</span>
              <h2 className="text-xl font-black text-slate-900 uppercase leading-tight mt-1">{selectedProduct.model}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">{selectedProduct.sku}</p>
              
              <div className="my-3 flex items-center gap-3">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">${selectedProduct.price}</span>
                  {selectedProduct.stock > 0 && <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-1 rounded-lg uppercase">Disponible</span>}
              </div>
              
              <div className="space-y-3 flex-1">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3">
                    
                    {/* --- MARCA DESTACADA --- */}
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[8px] font-black uppercase tracking-wider mb-0.5">MARCA</span>
                        <span className="text-blue-600 font-black text-sm uppercase">{selectedProduct.brand}</span>
                    </div>

                    {Object.entries(selectedProduct.specifications).map(([key, val]) => (
                      <div key={key} className="bg-white p-2 rounded-xl border border-slate-100">
                          <span className="text-slate-400 block text-[8px] font-black uppercase tracking-wider mb-0.5">{key}</span>
                          <span className="text-slate-900 font-bold text-xs">{val}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">{selectedProduct.description}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                 <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                    <span className="text-xs font-bold text-slate-500 ml-2">Cantidad:</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm font-black text-slate-500 hover:text-slate-900">-</button>
                        <span className="font-black text-lg w-6 text-center text-slate-900">{modalQty}</span>
                        <button onClick={() => setModalQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-slate-900 text-white shadow-lg shadow-slate-900/30 font-black hover:bg-black transition">+</button>
                    </div>
                 </div>
                 <button onClick={() => { addToCart(selectedProduct, modalQty); setSelectedProduct(null); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition active:scale-95 text-xs">
                    Agregar al Pedido (${(selectedProduct.price * modalQty).toFixed(2)})
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};