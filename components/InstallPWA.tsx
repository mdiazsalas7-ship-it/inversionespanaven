import React, { useEffect, useState } from 'react';

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showButton, setShowButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Detectar si es iOS (iPhone/iPad)
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
    }

    // 2. Detectar evento de instalación (Android/PC)
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowButton(false);
    }
  };

  if (!showButton && !isIOS) return null;

  return (
    <>
      {/* BOTÓN ANDROID / PC */}
      {showButton && (
        <button 
          onClick={handleInstallClick}
          className="fixed bottom-20 right-4 z-[9999] bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl shadow-blue-600/50 border-2 border-white/20 font-black uppercase tracking-widest text-xs flex items-center gap-2 animate-bounce hover:bg-black transition-colors"
        >
          📲 Instalar App
        </button>
      )}
      
      {/* AVISO IPHONE (Estilo iOS Nativo) */}
      {isIOS && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 backdrop-blur-md p-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] border-t border-slate-200 text-center animate-slideUp">
           <button onClick={() => setIsIOS(false)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 font-bold text-xl">✕</button>
           <div className="w-12 h-12 bg-slate-100 rounded-xl mx-auto mb-3 flex items-center justify-center shadow-sm">
              <img src="https://i.postimg.cc/x1nHCVy8/unnamed_removebg_preview.png" className="w-8 h-8 object-contain" />
           </div>
           <h3 className="font-black text-slate-900 text-sm uppercase mb-1">Instalar Panaven</h3>
           <p className="text-xs text-slate-500 mb-4 leading-relaxed">
             Para instalar la app en tu iPhone: <br/>
             1. Toca el botón <span className="text-xl inline-block align-middle text-blue-500">share</span> (Compartir) abajo.<br/>
             2. Selecciona <span className="font-bold text-slate-800">"Agregar a Inicio"</span>.
           </p>
           <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2"></div>
        </div>
      )}
    </>
  );
};