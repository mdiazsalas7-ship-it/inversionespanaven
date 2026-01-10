// Servicio para obtener la tasa del BCV o Paralelo automáticamente
// Fuente: DolarApi.com (API Gratuita para Venezuela)

export const getDolarRate = async (type: 'bcv' | 'paralelo' = 'bcv') => {
    try {
      // type puede ser 'oficial' (BCV) o 'paralelo' (Monitor)
      const endpoint = type === 'bcv' ? 'oficial' : 'paralelo';
      
      const response = await fetch(`https://ve.dolarapi.com/v1/dolares/${endpoint}`);
      
      if (!response.ok) {
        throw new Error('Error conectando con la API del Dólar');
      }
  
      const data = await response.json();
      
      // La API devuelve un objeto con varios campos, usamos 'promedio'
      return {
        rate: data.promedio,
        lastUpdate: data.fechaActualizacion,
        source: type === 'bcv' ? 'BCV' : 'Monitor'
      };
    } catch (error) {
      console.error("Error obteniendo tasa:", error);
      return null; // Si falla, devolvemos null para que la App use la tasa manual guardada
    }
  };