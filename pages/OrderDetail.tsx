import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Order, OrderStatus, ChatMessage } from '../types';
import ChatWindow from '../components/ChatWindow';
import { uploadImage } from '../services/storageService';
import { WAZE_URL } from '../constants';
import { useToast } from '../context/ToastContext';
import { generateQuotePDF } from '../services/pdfService';

interface DetailProps {
  orders: Order[];
  role: 'client' | 'admin';
  updateStatus: (id: string, status: OrderStatus, extra?: any) => Promise<void>;
  addChat: (id: string, msg: ChatMessage) => Promise<void>;
}

export const OrderDetail: React.FC<DetailProps> = ({ orders, role, updateStatus, addChat }) => {
  const { id } = useParams<{ id: string }>();
  const order = orders.find(o => o.id === id);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [addressInput, setAddressInput] = useState(order?.shippingAddress || '');
  const [paymentRefInput, setPaymentRefInput] = useState(order?.paymentReference || '');
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewInput, setReviewInput] = useState('');

  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoRef, setAbonoRef] = useState('');

  useEffect(() => {
    if (order?.shippingAddress) {
      if (order.shippingAddress === 'RETIRO EN TIENDA') {
        setDeliveryMethod('pickup');
      } else {
        setDeliveryMethod('shipping');
        setAddressInput(order.shippingAddress);
      }
    }
    if (order?.paymentReference) setPaymentRefInput(order.paymentReference);
  }, [order]);

  if (!order) return <div className="text-center py-20 font-black text-slate-400">Pedido no encontrado</div>;
  
  // --- CÁLCULOS FINANCIEROS CORREGIDOS (USANDO PRECIO MANUAL) ---
  const totalAmount = order.items.reduce((acc, item) => {
      // Si existe un precio manual (customPrice), úsalo. Si no, usa el del producto.
      const finalPrice = item.customPrice !== undefined ? item.customPrice : item.product.price;
      return acc + (finalPrice * item.quantity);
  }, 0);

  const totalPaid = (order.payments || []).reduce((acc, p) => acc + p.amount, 0);
  const remainingBalance = totalAmount - totalPaid;

  const handleDownloadPDF = () => {
    generateQuotePDF(order);
    toast('📄 Descargando documento...', 'success');
  };

  const registerAbono = async () => {
    if (!abonoAmount || !abonoRef) { 
        toast("⚠️ Falta monto o referencia", 'error'); 
        return; 
    }
    
    const newPayment = {
      id: Date.now().toString(),
      amount: Number(abonoAmount),
      date: Date.now(),
      reference: abonoRef
    };

    const currentPayments = order.payments || [];
    const updatedPayments = [...currentPayments, newPayment];
    
    let newStatus = order.status;
    const newTotalPaid = totalPaid + Number(abonoAmount);
    
    if (newTotalPaid >= totalAmount && order.status === OrderStatus.CREDIT_ACTIVE) {
        newStatus = OrderStatus.PAID; 
    }

    await updateStatus(order.id, newStatus, { payments: updatedPayments });
    toast('💵 Abono registrado con éxito', 'success');
    setAbonoAmount(''); 
    setAbonoRef('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, nextStatus?: OrderStatus) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (fieldName === 'paymentProof') {
      if (!paymentRefInput.trim()) { toast("⚠️ Falta referencia", 'error'); e.target.value = ''; return; }
      if (deliveryMethod === 'shipping' && !addressInput.trim()) { toast("⚠️ Falta dirección", 'error'); e.target.value = ''; return; }
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
          const url = await uploadImage(`orders/${order.id}/${fieldName}`, reader.result as string);
          const updateData: any = { [fieldName]: url };
          
          if (fieldName === 'paymentProof') {
            updateData.paymentReference = paymentRefInput;
            updateData.shippingAddress = deliveryMethod === 'pickup' ? 'RETIRO EN TIENDA' : addressInput;
            
            if (!order.payments || order.payments.length === 0) {
                updateData.payments = [{
                    id: Date.now().toString(),
                    amount: totalAmount,
                    date: Date.now(),
                    reference: paymentRefInput
                }];
            }

            if (nextStatus) updateStatus(order.id, nextStatus, updateData);
            toast('📸 Comprobante subido', 'success');
          } 
          else if (fieldName === 'shippingReceipt' && nextStatus) {
            updateStatus(order.id, nextStatus, updateData);
            toast('🚚 Guía enviada al cliente', 'success');
          }
      } catch (error) {
          toast('❌ Error al subir la imagen', 'error');
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const updateQuantity = async (productId: string, newQty: number) => {
    if (newQty < 1) {
      const newItems = order.items.filter(i => i.product.id !== productId);
      await updateStatus(order.id, order.status, { items: newItems });
    } else {
      const newItems = order.items.map(i => i.product.id === productId ? { ...i, quantity: newQty } : i);
      await updateStatus(order.id, order.status, { items: newItems });
    }
  };

  const submitRating = async () => {
    await updateStatus(order.id, OrderStatus.COMPLETED, { rating: ratingInput, review: reviewInput });
    toast('⭐ ¡Gracias por calificar!', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-10 animate-fadeIn pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <Link to={role === 'admin' ? '/admin' : '/orders'} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition text-slate-600 font-black text-lg">←</Link>
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter brand-font italic uppercase leading-none">Pedido #{order.id.slice(0,4)}</h1>
                    <button onClick={handleDownloadPDF} className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-black transition shadow-md"><span>📄 PDF</span></button>
                </div>
                <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-widest">
                    Estado: <span className="text-blue-600">{order.status}</span>
                    {order.clientBusinessName && <span className="text-slate-500"> • {order.clientBusinessName}</span>}
                </p>
            </div>
        </div>
        
        {/* BARRA DE DEUDA VISUAL (CORREGIDA) */}
        <div className="bg-slate-100 rounded-xl p-2 flex gap-4 text-center w-full md:w-auto justify-between md:justify-end">
            <div><p className="text-[9px] font-black uppercase text-slate-400">Total</p><p className="text-lg font-black text-slate-900">${totalAmount.toFixed(2)}</p></div>
            <div><p className="text-[9px] font-black uppercase text-slate-400">Abonado</p><p className="text-lg font-black text-green-600">${totalPaid.toFixed(2)}</p></div>
            <div><p className="text-[9px] font-black uppercase text-slate-400">Resta</p><p className={`text-lg font-black ${remainingBalance > 0 ? 'text-red-500' : 'text-slate-300'}`}>${Math.max(0, remainingBalance).toFixed(2)}</p></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          {/* TABLA DE PRODUCTOS (CORREGIDA) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Productos</h2>
               {role === 'admin' && order.status === OrderStatus.QUOTE_REQUESTED && <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">MODO EDICIÓN</span>}
             </div>
             <div className="divide-y divide-slate-100">
               {order.items.map((item, idx) => {
                 // LÓGICA DE PRECIO MANUAL
                 const finalPrice = item.customPrice !== undefined ? item.customPrice : item.product.price;
                 const isCustom = item.customPrice !== undefined && item.customPrice !== item.product.price;

                 return (
                   <div key={idx} className="p-4 flex items-center gap-3 md:gap-4">
                     <img src={item.product.images[0]} className="w-12 h-12 rounded-lg object-cover border border-slate-100" />
                     <div className="flex-1">
                         <p className="font-bold text-slate-900 text-xs uppercase">{item.product.model}</p>
                         <div className="flex items-center gap-2">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{item.product.brand}</p>
                            {isCustom && <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 rounded-full font-bold">Precio Especial</span>}
                         </div>
                     </div>
                     {role === 'admin' && order.status === OrderStatus.QUOTE_REQUESTED ? (
                       <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                         <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center font-bold hover:bg-white rounded shadow-sm">-</button>
                         <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center font-bold hover:bg-white rounded shadow-sm">+</button>
                       </div>
                     ) : (<div className="text-right"><span className="text-xs font-bold text-slate-500">x{item.quantity}</span></div>)}
                     <div className="text-right">
                        <p className="font-black text-slate-900 text-sm w-16">${(finalPrice * item.quantity).toFixed(2)}</p>
                        {isCustom && <p className="text-[9px] text-slate-400 line-through">${(item.product.price * item.quantity).toFixed(2)}</p>}
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>

          {/* HISTORIAL Y DEMÁS COMPONENTES (INTACTOS) */}
          {(order.payments && order.payments.length > 0) || role === 'admin' ? (
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 space-y-6">
                <h3 className="font-black text-slate-900 uppercase flex items-center gap-2">📒 Historial de Pagos</h3>
                <div className="space-y-2">
                    {(order.payments || []).map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                            <div><p className="text-xs font-bold text-green-800 uppercase">Pago Recibido</p><p className="text-[10px] text-green-600 font-mono">Ref: {p.reference} • {new Date(p.date).toLocaleDateString()}</p></div>
                            <p className="text-lg font-black text-green-700">+${p.amount}</p>
                        </div>
                    ))}
                    {(order.payments || []).length === 0 && <p className="text-center text-xs text-slate-400 italic">No hay pagos registrados aún.</p>}
                </div>
                {role === 'admin' && remainingBalance > 0 && (
                    <div className="bg-slate-900 p-4 rounded-xl text-white mt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Registrar Nuevo Abono (Manual)</p>
                        <div className="flex gap-2">
                            <input type="number" value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} placeholder="$ Monto" className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none" />
                            <input type="text" value={abonoRef} onChange={e => setAbonoRef(e.target.value)} placeholder="Ref / Efectivo / Zelle" className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none" />
                            <button onClick={registerAbono} className="bg-blue-600 px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-blue-500">Registrar</button>
                        </div>
                    </div>
                )}
             </div>
          ) : null}

          {/* ESTADOS DEL PEDIDO */}
          {order.status === OrderStatus.QUOTE_REQUESTED && (
               <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 text-center space-y-4">
                 <h3 className="font-black text-slate-900 uppercase">Cotización en Revisión</h3>
                 {role === 'admin' ? (
                   <div className="bg-blue-50 p-4 rounded-xl">
                     <p className="text-xs text-blue-800 mb-3">Revisa las cantidades arriba. Si todo está correcto, aprueba.</p>
                     <button onClick={() => { updateStatus(order.id, OrderStatus.APPROVED); toast('✅ Cotización aprobada', 'success'); }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-700">Aprobar Cotización</button>
                   </div>
                 ) : (<p className="text-xs text-slate-500">Tu cotización está siendo revisada...</p>)}
               </div>
          )}

          {order.status === OrderStatus.APPROVED && role === 'client' && (
               <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 space-y-4">
                 <div className="flex items-center gap-3 border-b pb-2"><div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm">💰</div><h3 className="font-black text-slate-900 uppercase text-sm">Zona de Pago</h3></div>
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cuentas Panaven</p><div className="font-mono text-xs text-slate-800 space-y-1"><p>• BNC: 0191-0052-12-1234567890</p><p>• Pago Móvil: 0412-1234567 (V-12345678)</p><p>• Zelle: pagos@panaven.com</p></div></div>
                 <div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setDeliveryMethod('shipping')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${deliveryMethod === 'shipping' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>🚚 Envío</button><button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${deliveryMethod === 'pickup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>🏪 Retiro</button></div>
                 {deliveryMethod === 'shipping' ? (<div><label className="text-[10px] font-black uppercase text-slate-500 ml-1">Dirección</label><textarea value={addressInput} onChange={e => setAddressInput(e.target.value)} placeholder="Datos exactos de envío..." className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold focus:border-blue-600 outline-none h-20 resize-none" /></div>) : (<div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="text-xs font-bold text-blue-900 mb-2">📍 Te esperamos en nuestra sede</p><a href={WAZE_URL} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700">Ver en Waze</a></div>)}
                 <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase text-slate-500 ml-1"># Referencia</label><input value={paymentRefInput} onChange={e => setPaymentRefInput(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold focus:border-blue-600 outline-none" /></div><div><label className="text-[10px] font-black uppercase text-slate-500 ml-1">Capture</label><label className={`block w-full border-2 border-dashed ${paymentRefInput ? 'border-blue-400 bg-blue-50 cursor-pointer' : 'border-slate-200 bg-slate-50 cursor-not-allowed'} p-3 rounded-xl text-center transition-all`}><input type="file" disabled={!paymentRefInput} onChange={e => handleFileUpload(e, 'paymentProof', OrderStatus.PAID)} className="hidden" /><span className="text-[10px] font-black uppercase text-blue-600">{uploading ? 'Subiendo...' : 'Subir y Pagar'}</span></label></div></div>
               </div>
          )}

          {(order.status === OrderStatus.PAID || order.status === OrderStatus.CREDIT_ACTIVE) && (
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 space-y-6">
                 {order.paymentProof && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><span className="text-[9px] font-black uppercase text-slate-400">Comprobante</span><a href={order.paymentProof} target="_blank" className="block relative h-32 rounded-xl overflow-hidden border border-slate-200 group"><img src={order.paymentProof} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-xs font-bold">Ver</div></a></div><div className="space-y-2"><span className="text-[9px] font-black uppercase text-slate-400">Entrega</span>{order.shippingAddress === 'RETIRO EN TIENDA' ? (<div className="h-32 bg-blue-50 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center p-4"><span className="text-2xl">🏪</span><p className="text-xs font-black text-blue-900 uppercase mt-2">Retiro en Tienda</p></div>) : (<div className="bg-slate-50 p-3 rounded-xl border border-slate-200 h-32 overflow-y-auto text-xs font-bold text-slate-700">{order.shippingAddress}</div>)}</div></div>)}
                 {role === 'admin' ? (<div className="border-t pt-4 mt-4"><label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-2 block">{order.shippingAddress === 'RETIRO EN TIENDA' ? 'Confirmar Entrega:' : 'Subir Guía para Enviar:'}</label><label className="flex items-center justify-center w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-black cursor-pointer gap-2"><span>📤 {order.shippingAddress === 'RETIRO EN TIENDA' ? 'Marcar Entregado' : 'Subir Guía y Enviar'}</span><input type="file" onChange={e => handleFileUpload(e, 'shippingReceipt', OrderStatus.SHIPPED)} className="hidden" /></label>{uploading && <p className="text-center text-xs text-blue-600 font-bold mt-2">Procesando...</p>}</div>) : (order.status === OrderStatus.PAID && <p className="text-center text-xs text-slate-500 italic">Pago en verificación.</p>)}
             </div>
          )}

          {order.status === OrderStatus.SHIPPED && (
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 text-center space-y-6">
                 <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-3xl">{order.shippingAddress === 'RETIRO EN TIENDA' ? '🛍️' : '🚚'}</div>
                 <h3 className="font-black text-slate-900 uppercase text-lg">{order.shippingAddress === 'RETIRO EN TIENDA' ? '¡Listo para Retirar!' : '¡En Camino!'}</h3>
                 {order.shippingReceipt && order.shippingAddress !== 'RETIRO EN TIENDA' && (<div className="max-w-xs mx-auto"><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Guía de Envío</p><a href={order.shippingReceipt} target="_blank" className="block rounded-xl overflow-hidden border-2 border-blue-200 shadow-md"><img src={order.shippingReceipt} className="w-full object-cover" /></a></div>)}
                 {role === 'client' ? (<div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mt-6"><p className="text-xs font-bold text-slate-900 uppercase mb-4">¿Ya tienes tu producto?</p><div className="flex justify-center gap-2 mb-4 text-2xl">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => setRatingInput(star)} className={`transition ${star <= ratingInput ? 'text-yellow-400 scale-110' : 'text-slate-300'}`}>★</button>))}</div><textarea value={reviewInput} onChange={e => setReviewInput(e.target.value)} placeholder="Comentario..." className="w-full p-3 border border-slate-200 rounded-xl text-xs mb-4 outline-none focus:border-blue-500" /><button onClick={submitRating} className="w-full py-3 bg-green-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-green-700">Confirmar Recepción</button></div>) : (<p className="text-xs text-slate-500">Esperando confirmación del cliente...</p>)}
             </div>
          )}

          {order.status === OrderStatus.COMPLETED && (
             <div className="text-center py-8 bg-white rounded-2xl shadow-lg border border-slate-100">
                 <div className="text-4xl mb-2">⭐</div>
                 <h3 className="font-black text-slate-900 uppercase">Orden Completada</h3>
                 <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100 inline-block text-left"><div className="flex text-yellow-500 text-lg mb-1">{'★'.repeat(order.rating || 5)}{'☆'.repeat(5 - (order.rating || 5))}</div><p className="text-xs font-bold text-slate-700 italic">"{order.review || 'Sin comentarios'}"</p></div>
             </div>
          )}
        </div>
        
        <aside className="space-y-4"><div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col"><h3 className="font-black text-slate-900 text-xs uppercase mb-4 tracking-widest">Chat con Soporte</h3><div className="flex-1"><ChatWindow messages={order.chat} role={role} onSendMessage={(text) => addChat(order.id, { sender: role, text, timestamp: Date.now() })} /></div></div></aside>
      </div>
    </div>
  );
};