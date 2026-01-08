import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartItem } from '../types';

interface CartProps {
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  createOrder: () => Promise<string>;
}

export const Cart: React.FC<CartProps> = ({ cart, removeFromCart, createOrder }) => {
  const navigate = useNavigate();
  // Calculamos un estimado, aunque es una cotización
  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const [loadingOrder, setLoadingOrder] = useState(false);
  
  // Si no hay nada, mostramos mensaje de vacío
  if (cart.length === 0) return (
    <div className="text-center py-20 space-y-6 animate-fadeIn">
      <div className="text-6xl md:text-8xl">🛒</div>
      <h2 className="text-2xl md:text-3xl font-black brand-font uppercase italic text-slate-300">Carro Vacío</h2>
      <Link to="/" className="px-8 py-3 md:px-10 md:py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest inline-block text-sm shadow-lg shadow-blue-600/20">
        Ir al Catálogo
      </Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-12 animate-fadeIn pb-32">
      <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter brand-font italic uppercase text-center md:text-left">Tu Pedido</h1>
      
      {/* VISTA MÓVIL (Lista de Tarjetas) */}
      <div className="space-y-3 md:hidden">
        {cart.map(item => (
          <div key={item.product.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-3 items-center">
            <img src={item.product.images[0]} className="w-16 h-16 rounded-xl object-cover bg-slate-50" />
            <div className="flex-1 min-w-0">
              <div className="font-black text-xs text-slate-900 uppercase leading-tight truncate">{item.product.model}</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">{item.product.brand}</div>
              <div className="flex justify-between items-center mt-1">
                 <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-md">x{item.quantity}</span>
                 <span className="text-sm font-black text-blue-600">${item.product.price * item.quantity}</span>
              </div>
            </div>
            <button onClick={() => removeFromCart(item.product.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 text-xl">×</button>
          </div>
        ))}
      </div>

      {/* VISTA PC (Tabla Clásica) */}
      <div className="hidden md:block bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Producto</th>
              <th className="p-6 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Cant.</th>
              <th className="p-6 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Total</th>
              <th className="p-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cart.map(item => (
              <tr key={item.product.id} className="hover:bg-slate-50 transition">
                <td className="p-6 flex items-center gap-4">
                  <img src={item.product.images[0]} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-white" />
                  <div>
                    <div className="font-black text-sm text-slate-900 uppercase">{item.product.model}</div>
                    <div className="text-[10px] text-blue-600 uppercase font-black tracking-widest">{item.product.brand}</div>
                  </div>
                </td>
                <td className="p-6 text-center font-black text-slate-600">{item.quantity}</td>
                <td className="p-6 text-right font-black text-slate-900 text-lg tracking-tighter">${item.product.price * item.quantity}</td>
                <td className="p-6 text-right"><button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 hover:text-red-500 transition text-2xl">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* BARRA DE ACCIÓN FIJA (Footer en móvil) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 md:relative md:bg-slate-950 md:text-white md:p-12 md:rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] md:shadow-none">
        <div className="flex justify-between w-full md:block md:w-auto items-center">
            <span className="text-[10px] font-black text-slate-500 md:text-blue-500 uppercase tracking-widest brand-font italic block">Monto Estimado</span>
            <div className="text-3xl md:text-6xl font-black tracking-tighter brand-font italic uppercase text-slate-900 md:text-white">${total}</div>
        </div>
        <button 
          disabled={loadingOrder} 
          onClick={async () => { 
            setLoadingOrder(true); 
            // 1. Crea la orden en Firebase
            const id = await createOrder(); 
            // 2. Redirige a la pantalla de "Detalle de Orden"
            navigate(`/order/${id}`); 
          }} 
          className="w-full md:w-auto px-6 py-4 md:px-12 md:py-6 bg-blue-600 text-white rounded-xl md:rounded-3xl font-black text-sm md:text-xl uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all transform active:scale-95"
        >
            {loadingOrder ? 'Enviando...' : 'Solicitar Cotización'}
        </button>
      </div>
    </div>
  );
};