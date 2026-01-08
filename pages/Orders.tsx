import React from 'react';
import { Link } from 'react-router-dom';
import { Order, OrderStatus } from '../types';

interface OrdersProps {
  orders: Order[];
  role: 'client' | 'admin';
}

export const Orders: React.FC<OrdersProps> = ({ orders }) => {
  return (
    <div className="space-y-6 md:space-y-10 animate-fadeIn pb-20">
      <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter brand-font italic uppercase">Mis Pedidos</h1>
      <div className="grid gap-4 md:gap-6">
        {orders.map(order => (
          <Link key={order.id} to={`/order/${order.id}`} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 md:p-8 bg-white rounded-2xl md:rounded-[2rem] border hover:border-blue-400 transition-all shadow-lg md:shadow-xl gap-4">
            <div className="flex items-center gap-4 md:gap-6"><div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center font-black border shadow-inner text-blue-600 italic uppercase text-xs md:text-base">#{order.id.substr(0,4)}</div><div><p className="font-black text-base md:text-xl text-slate-900 uppercase">{order.customerName}</p><p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p></div></div>
            <div className="flex justify-between w-full md:w-auto items-center md:block text-right"><span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] ${order.status === OrderStatus.COMPLETED ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>{order.status}</span><p className="font-black text-slate-900 text-2xl md:text-3xl mt-0 md:mt-3 tracking-tighter">${order.items.reduce((a, b) => a + (b.product.price * b.quantity), 0)}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
};