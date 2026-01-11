// src/services/exchangeRateService.ts

export const getDolarRate = async (source: 'bcv' | 'paralelo' = 'bcv'): Promise<{ rate: number; source: string } | null> => {
    try {
      // Intentamos consultar una API pública de precios en Venezuela
      // Esta es una API común, si falla, usaremos un valor de respaldo o manual
      const response = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=bcv');
      
      if (!response.ok) {
        throw new Error('Error en API externa');
      }
  
      const data = await response.json();
      
      // La estructura de esta API suele devolver el precio del BCV
      // Ajustamos según la respuesta típica:
      const rate = data.monitors?.usd?.price || data.price || 0;
  
      if (rate > 0) {
        return {
          rate: parseFloat(rate),
          source: 'API BCV'
        };
      }
      
      return null;
  
    } catch (error) {
      console.warn("⚠️ No se pudo obtener la tasa automática. Usando manual/guardada.", error);
      // Si falla la API, retornamos null para que el sistema use la de Firebase (Manual)
      return null;
    }
  };