
import { GoogleGenAI, Type } from "@google/genai";
import { Injector, Order } from "../types";

export const getAdminInsights = async (injectors: Injector[], orders: Order[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const inventorySummary = injectors.map(i => `${i.brand} ${i.model}: Stock ${i.stock}`).join('\n');
  const ordersSummary = orders.map(o => `Order ${o.id} - Status: ${o.status}`).join('\n');

  const prompt = `
    Actúa como un experto financiero y de auditoría interna para Panaven Inyector.
    Analiza los datos y proporciona un resumen ejecutivo (en español) para el Administrador:
    
    INVENTARIO:
    ${inventorySummary}
    
    ÓRDENES:
    ${ordersSummary}
    
    1. Alertas de stock crítico.
    2. Resumen de flujo de caja (proyectado vs liquidado).
    3. Recomendaciones de compra o promociones.
    
    Responde en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            criticalStock: { type: Type.ARRAY, items: { type: Type.STRING } },
            financialInsights: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Insight Error:", error);
    return null;
  }
};

export const generateProductData = async (productName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Actúa como un EXPERTO EN VENTAS de repuestos automotrices y un ingeniero de inyección con 20 años de experiencia.
    Para el producto llamado: "${productName}", genera la ficha técnica completa y una descripción de ventas QUE VENDA POR SÍ SOLA.
    
    REQUERIMIENTOS DE LA DESCRIPCIÓN:
    1. Debe ser persuasiva, emocionante y destacar la durabilidad, precisión y el ahorro de combustible que ofrece el inyector.
    2. Usa un tono profesional pero que llame poderosamente la atención del cliente (Ej: "Lleva el rendimiento de tu motor al siguiente nivel...").
    3. No digas "Hola", ve directo a resaltar los beneficios del producto.
    
    REQUERIMIENTOS TÉCNICOS:
    - Extrae la Marca y el Modelo exacto del nombre.
    - Genera un SKU/Part Number realista para ese modelo.
    - Sugiere un precio competitivo de mercado en USD.
    - Estima el Caudal (CC), Resistencia (Ohms) y cantidad de Huecos típicos para este modelo.
    
    Responde estrictamente en formato JSON:
    {
      "brand": "Marca",
      "model": "Modelo Completo y Año",
      "sku": "SKU-PRO-001",
      "price": 0,
      "description": "¡ATENCIÓN! Potencia pura para tu motor...",
      "specifications": {
        "Caudal": "valor cc",
        "Resistencia": "valor Ohms",
        "Huecos": "cantidad"
      }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            model: { type: Type.STRING },
            sku: { type: Type.STRING },
            price: { type: Type.NUMBER },
            description: { type: Type.STRING },
            specifications: {
              type: Type.OBJECT,
              properties: {
                Caudal: { type: Type.STRING },
                Resistencia: { type: Type.STRING },
                Huecos: { type: Type.STRING }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Generate Error:", error);
    return null;
  }
};

export const getTechnicalAdvice = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Eres el "Ingeniero Maestro de Panaven Inyector". 
    Tu función es ESTRICTAMENTE técnica.
    
    INSTRUCCIONES:
    1. Responde SOLO especificaciones técnicas si preguntan por un inyector.
    2. Sé extremadamente breve y directo.
    3. Usa Google Search para encontrar datos exactos.
    
    Consulta: "${query}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Advice Error:", error);
    return "Error técnico.";
  }
};
