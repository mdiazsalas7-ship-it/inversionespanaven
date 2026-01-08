import React, { useState, useMemo } from 'react';
import { Injector } from '../types';

interface CatalogProps {
  injectors: Injector[];
  addToCart: (product: Injector, quantity: number) => void;
}

export const Catalog: React.FC<CatalogProps> = ({ injectors, addToCart }) => {
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<Injector | null>(null);
  // Estado para la cantidad dentro del modal
  const [modalQty, setModalQty] = useState(1);

  const brands = useMemo(() => ['All', ...Array.from(new Set(injectors.map(i => i.brand)))], [injectors]);
  const filtered = selectedBrand === 'All' ? injectors : injectors.filter(i => i.brand === selectedBrand);

  const openModal = (product: Injector) => {
    setModalQty(1); // Resetear cantidad a 1 al abrir
    setSelectedProduct(product);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-24">
      {/* Filtros */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm py-2 -mx-3 px-3 border-b border-slate-200 md:static md:bg-transparent md:border-0 md:p-0 md:mx-0">
         <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {brands.map(b => (
              <button key={b} onClick={() => setSelectedBrand(b)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${selectedBrand === b ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{b}</button>
            ))}
         </div>
      </div>

      {/* Lista Compacta */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(item => (
          <div key={item.id} onClick={() => openModal(item)} className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm flex items-center gap-3 active:scale-95 transition-all cursor-pointer relative group">
            <div className="relative w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-lg shrink-0 overflow-hidden border border-slate-100">
              <img src={item.images[0]} alt={item.model} className="w-full h-full object-cover" />
              {item.stock === 0 && <div className="absolute inset-0 bg-white/60 flex items-center justify-center font-black text-[8px] uppercase text-red-600 tracking-widest">Agotado</div>}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.brand}</span>
              <h3 className="font-bold text-xs text-slate-900 leading-tight uppercase truncate">{item.model}</h3>
              <p className="text-[9px] text-slate-400 truncate mt-1">{item.sku}</p>
            </div>
            <div className="flex flex-col items-end justify-center gap-2 pl-2 border-l border-slate-50 h-12">
              <span className="text-sm font-black text-blue-600">${item.price}</span>
              {/* Botón rápido agrega 1 unidad */}
              <button disabled={item.stock === 0} onClick={(e) => { e.stopPropagation(); addToCart(item, 1); }} className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition shadow-sm"><span className="font-bold text-sm mb-[1px]">+</span></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Detalle (Ficha Técnica) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedProduct(null)}></div>
          <div className="bg-white w-full max-w-4xl rounded-t-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden h-[80vh] md:max-h-[85vh] flex flex-col md:flex-row relative z-10 animate-slideUp">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-20 bg-slate-100 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">✕</button>
            
            <div className="w-full md:w-1/2 bg-slate-50 p-6 flex items-center justify-center h-1/3 md:h-auto">
               <img src={selectedProduct.images[0]} className="max-h-full max-w-full rounded-xl shadow-lg object-contain mix-blend-multiply" />
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

              {/* Selector de Cantidad en el Modal */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                 <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                    <span className="text-xs font-bold text-slate-500">Cantidad:</span>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-white border shadow-sm font-bold">-</button>
                        <span className="font-black text-lg w-4 text-center">{modalQty}</span>
                        <button onClick={() => setModalQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-slate-900 text-white shadow-sm font-bold">+</button>
                    </div>
                 </div>
                 
                 <button 
                    onClick={() => { addToCart(selectedProduct, modalQty); setSelectedProduct(null); }} 
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
                 >
                    Agregar {modalQty} al Pedido
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};