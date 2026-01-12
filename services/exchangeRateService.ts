// src/services/exchangeRateService.ts

export const getDolarRate = async (source: 'bcv' | 'paralelo' = 'bcv'): Promise<{ rate: number; source: string } | null> => {
  try {
    // Usamos DolarApi.com, que es más estable para el BCV
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    
    if (!response.ok) {
      throw new Error('Error conectando con DolarApi');
    }

    const data = await response.json();
    
    // La API devuelve un objeto con "promedio", "compra", "venta". 
    // Usamos "promedio" o "venta" como referencia.
    const rate = data.promedio || data.venta || 0;

    if (rate > 0) {
      console.log(`✅ Tasa BCV actualizada desde API: ${rate}`);
      return {
        rate: parseFloat(rate),
        source: 'DolarApi (BCV)'
      };
    }
    
    return null;

  } catch (error) {
    console.warn("⚠️ Falló la API principal. Intentando respaldo...", error);
    
    // INTENTO DE RESPALDO (API SECUNDARIA)
    try {
        const backupResponse = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?monitor=bcv&page=bcv');
        const backupData = await backupResponse.json();
        // Ajustamos según estructura típica de pydolarvenezuela
        const backupRate = backupData.price || backupData.monitors?.bcv?.price || 0;
        
        if (backupRate > 0) {
            console.log(`✅ Tasa recuperada desde API Respaldo: ${backupRate}`);
            return { rate: parseFloat(backupRate), source: 'API Respaldo' };
        }
    } catch (e) {
        console.error("❌ Todas las APIs fallaron.");
    }

    return null;
  }
};