import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Injector, Order } from '../types';

export const generateQuotePDF = (order: Order) => {
  const doc = new jsPDF();

  // 1. Encabezado de la Empresa
  doc.setFontSize(22);
  doc.setTextColor(0, 51, 153); // Azul Panaven
  doc.text("INVERSIONES PANAVEN", 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Especialistas en Inyectores y Repuestos", 14, 26);
  doc.text("RIF: J-12345678-9 | Tel: +58 412-1234567", 14, 31);

  // 2. Datos de la Cotización
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`COTIZACIÓN N°: ${order.id.slice(0, 6).toUpperCase()}`, 140, 20);
  doc.text(`FECHA: ${new Date(order.createdAt).toLocaleDateString()}`, 140, 26);
  
  // 3. Datos del Cliente
  doc.setDrawColor(200);
  doc.line(14, 38, 196, 38);
  
  doc.setFontSize(11);
  doc.text("DATOS DEL CLIENTE (CRÉDITO)", 14, 45);
  doc.setFontSize(10);
  doc.text(`Cliente: ${order.customerName}`, 14, 52);
  doc.text(`Cédula/RIF: ${order.clientRIF || 'N/A'}`, 14, 58);
  if (order.clientBusinessName) {
    doc.text(`Negocio: ${order.clientBusinessName}`, 14, 64);
  }

  // 4. Tabla de Productos
  const tableRows = order.items.map(item => [
    item.product.sku,
    `${item.product.model} (${item.product.brand})`,
    item.quantity,
    `$${item.product.price.toFixed(2)}`,
    `$${(item.product.price * item.quantity).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['SKU', 'Descripción', 'Cant.', 'Precio Unit.', 'Total']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [0, 51, 153] },
    styles: { fontSize: 9 },
  });

  // 5. Totales
  const finalY = (doc as any).lastAutoTable.finalY || 75;
  const totalAmount = order.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  doc.setFontSize(12);
  doc.font = "helvetica";
  doc.text(`TOTAL A PAGAR: $${totalAmount.toFixed(2)}`, 140, finalY + 15);

  // 6. Pie de Página
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Esta cotización representa un compromiso de pago bajo las condiciones acordadas.", 14, 280);
  doc.text("Gracias por su preferencia.", 14, 285);

  // Descargar el archivo
  doc.save(`Cotizacion_Panaven_${order.customerName}.pdf`);
};