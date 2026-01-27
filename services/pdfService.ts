import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../types';

// TU LOGO
const LOGO_URL = "https://i.postimg.cc/x1nHCVy8/unnamed_removebg_preview.png";

// Función auxiliar mejorada: devuelve la imagen Y sus dimensiones
const getImageProperties = (url: string): Promise<{ base64: string; width: number; height: number } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL("image/png");
          resolve({ base64: dataURL, width: img.width, height: img.height });
      } else {
          resolve(null);
      }
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = url;
  });
};

export const generateQuotePDF = async (order: Order) => {
  const doc = new jsPDF();

  // 1. LOGO CON PROPORCIÓN CORRECTA
  // Definimos un ancho fijo en el PDF (ej: 25 unidades)
  const logoWidth = 25; 
  let logoHeight = 25; // Valor por defecto si falla el cálculo

  try {
      const logoData = await getImageProperties(LOGO_URL);
      if (logoData) {
          // Fórmula mágica: (Alto Original / Ancho Original) * Ancho Deseado = Alto Proporcional
          logoHeight = (logoData.height / logoData.width) * logoWidth;
          
          // Agregamos la imagen con las medidas calculadas
          doc.addImage(logoData.base64, 'PNG', 14, 10, logoWidth, logoHeight); 
      }
  } catch (error) {
      console.warn("No se pudo cargar el logo", error);
  }

  // Ajustamos la posición Y del texto según la altura del logo para que no se monten
  // Si el logo es muy alto, bajamos un poco el texto, si es bajo, mantenemos un mínimo.
  const headerStartY = Math.max(20, 10 + logoHeight / 2); 

  // 2. ENCABEZADO (Texto movido a la derecha x=45)
  doc.setFontSize(22);
  doc.setTextColor(0, 51, 153);
  doc.setFont("helvetica", "bold");
  doc.text("INVERSIONES PANAVEN", 45, 20); 
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("Especialistas en Inyectores y Repuestos", 45, 26);
  doc.text("RIF: J-12345678-9 | Tel: +58 412-1234567", 45, 31);

  // 3. DATOS DE LA COTIZACIÓN
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`COTIZACIÓN N°: ${order.id.slice(0, 6).toUpperCase()}`, 140, 20);
  doc.text(`FECHA: ${new Date(order.createdAt).toLocaleDateString()}`, 140, 26);
  
  // 4. LÍNEA DIVISORIA
  // La bajamos un poco si el logo es muy alto, para asegurar espacio
  const lineY = Math.max(38, 10 + logoHeight + 5);
  doc.setDrawColor(200);
  doc.line(14, lineY, 196, lineY);
  
  // 5. DATOS DEL CLIENTE
  const clientY = lineY + 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE", 14, clientY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Cliente: ${order.customerName}`, 14, clientY + 7);
  doc.text(`Cédula/RIF: ${order.clientRIF || 'N/A'}`, 14, clientY + 13);
  if (order.clientBusinessName) {
    doc.text(`Negocio: ${order.clientBusinessName}`, 14, clientY + 19);
  }

  // 6. TABLA DE PRODUCTOS (CON LÓGICA DE PRECIO MANUAL)
  const tableRows = order.items.map(item => {
    const finalPrice = item.customPrice !== undefined ? item.customPrice : item.product.price;
    return [
      item.product.sku,
      `${item.product.model} (${item.product.brand})`,
      item.quantity,
      `$${finalPrice.toFixed(2)}`, 
      `$${(finalPrice * item.quantity).toFixed(2)}` 
    ];
  });

  autoTable(doc, {
    startY: clientY + 25,
    head: [['SKU', 'Descripción', 'Cant.', 'Precio Unit.', 'Total']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [0, 51, 153] },
    styles: { fontSize: 9 },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  });

  // 7. TOTALES
  const finalY = (doc as any).lastAutoTable.finalY || (clientY + 25);
  
  const totalAmount = order.items.reduce((acc, item) => {
    const price = item.customPrice !== undefined ? item.customPrice : item.product.price;
    return acc + (price * item.quantity);
  }, 0);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL A PAGAR: $${totalAmount.toFixed(2)}`, 140, finalY + 15);

  // 8. PIE DE PÁGINA
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Esta cotización representa un compromiso de pago bajo las condiciones acordadas.", 14, 280);
  doc.text("Gracias por su preferencia.", 14, 285);

  doc.save(`Cotizacion_Panaven_${order.customerName.replace(/\s+/g, '_')}.pdf`);
};