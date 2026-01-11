import React, { createContext, useContext, useState, useCallback } from 'react';

// Tipos de notificación
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextProps {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-eliminar a los 3 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      
      {/* CONTENEDOR DE NOTIFICACIONES (Visual) */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`
                animate-slideUp shadow-2xl rounded-2xl p-4 flex items-center gap-3 border pointer-events-auto backdrop-blur-md
                ${t.type === 'success' ? 'bg-slate-900/95 text-white border-slate-700' : ''}
                ${t.type === 'error' ? 'bg-red-600/95 text-white border-red-400' : ''}
                ${t.type === 'info' ? 'bg-blue-600/95 text-white border-blue-400' : ''}
            `}
          >
            <div className="text-xl">
                {t.type === 'success' && '✅'}
                {t.type === 'error' && '⚠️'}
                {t.type === 'info' && 'ℹ️'}
            </div>
            <div>
                <p className="font-black text-xs uppercase tracking-widest opacity-70">
                    {t.type === 'success' ? 'Éxito' : t.type === 'error' ? 'Error' : 'Info'}
                </p>
                <p className="font-bold text-sm leading-tight">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Hook para usarlo en cualquier lado
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context.toast; // Devuelve la función directamente
};