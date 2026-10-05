/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Sale, Settings } from '../types';
import { BillFormatKey } from '../constants/billFormats';
import { formatCurrency, formatDate, generateUpiQrDataUrl, getPdfCurrency } from '../utils';

export const getBarcodeDataURL = (text: string): string => {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 11,
      height: 38,
      width: 1.8,
      margin: 6,
      textMargin: 3,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Failed to generate barcode data URL', e);
    return '';
  }
};

export const loadAnyQrCode = (text: string): Promise<string> => {
  return new Promise((resolve) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(text)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
};

export const loadUpiQrCode = async (upi: string, name: string, total: number): Promise<string> => {
  if (!upi) return '';
  try {
    return await generateUpiQrDataUrl({
      upiId: upi,
      payeeName: name,
      amount: total,
      width: 140,
    });
  } catch (err) {
    console.error('Error generating receipt UPI QR:', err);
    return '';
  }
};

/**
 * Generate Thermal Roll PDF (58mm or 80mm)
 */
export async function generateThermalPDFDoc(
  sale: Sale,
  settings: Settings,
  is58mm: boolean,
  receiptText: string
): Promise<jsPDF> {
  const lineCount = receiptText.split('\n').length;
  let computedHeight = lineCount * (is58mm ? 3.5 : 4) + 12;

  const logo = settings.shopLogo || settings.logo;
  if (logo) {
    computedHeight += is58mm ? 18 : 22;
  }

  if (settings.showBarcodeOnBill !== false) {
    computedHeight += is58mm ? 42 : 46;
  }
  if (settings.showUpiQrOnBill !== false && settings.upi) {
    computedHeight += is58mm ? 38 : 44;
  }

  const finalHeight = Math.max(is58mm ? 120 : 150, computedHeight);
  const doc = new jsPDF({
    unit: 'mm',
    format: [is58mm ? 58 : 80, finalHeight],
    compress: true,
  });

  doc.setProperties({
    title: `Thermal Receipt #${sale.billNo}`,
    subject: `Receipt #${sale.billNo}`,
    author: settings.shopName || 'Store POS',
    creator: 'ShopPOS Billing Engine',
    keywords: 'receipt, thermal, pos',
  });

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58mm ? 6.5 : 8);

  let y = is58mm ? 6 : 8;
  if (logo) {
    try {
      const logoW = is58mm ? 22 : 28;
      const logoH = is58mm ? 14 : 18;
      const logoX = is58mm ? (58 - logoW) / 2 : (80 - logoW) / 2;
      doc.addImage(logo, 'JPEG', logoX, y, logoW, logoH, undefined, 'FAST');
      y += logoH + 3;
    } catch {
      // ignore logo load error
    }
  }

  receiptText.split('\n').forEach((line) => {
    const formattedLine = is58mm && line.length > 32 ? line.slice(0, 31) + ' ' : line;
    doc.text(formattedLine, is58mm ? 3 : 5, y);
    y += is58mm ? 3.5 : 4;
  });

  // Render transaction barcode
  if (settings.showBarcodeOnBill !== false) {
    const barcodeImg = getBarcodeDataURL(String(sale.billNo));
    if (barcodeImg) {
      y += 2;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(is58mm ? 3 : 5, y, is58mm ? 55 : 75, y);
      y += is58mm ? 4 : 5;
      doc.text('RETURN SCAN BARCODE & QR:', is58mm ? 3 : 5, y);
      y += 2;
      doc.addImage(barcodeImg, 'PNG', is58mm ? 6 : 12, y, is58mm ? 46 : 56, is58mm ? 11 : 12, undefined, 'FAST');
      y += is58mm ? 13 : 14;

      const billQrBase64 = await loadAnyQrCode(String(sale.billNo));
      if (billQrBase64) {
        doc.addImage(billQrBase64, 'JPEG', is58mm ? 19 : 28, y, is58mm ? 20 : 24, is58mm ? 20 : 24, undefined, 'FAST');
        y += is58mm ? 22 : 26;
      }
    }
  }

  // Render UPI QR
  if (settings.showUpiQrOnBill !== false && settings.upi) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(is58mm ? 3 : 5, y, is58mm ? 55 : 75, y);
    y += is58mm ? 4 : 5;
    doc.text('SCAN TO PAY (UPI):', is58mm ? 3 : 5, y);
    y += 2;
    const qrBase64 = await loadUpiQrCode(settings.upi, settings.shopName || 'Store POS', sale.total);
    if (qrBase64) {
      doc.addImage(qrBase64, 'JPEG', is58mm ? 14 : 22, y, is58mm ? 30 : 36, is58mm ? 30 : 36, undefined, 'FAST');
      y += is58mm ? 32 : 38;
    }
  }

  return doc;
}

export async function generateInvoicePdfDoc(
  sale: Sale,
  settings: Settings,
  format: BillFormatKey = 'regular',
  receiptText?: string
): Promise<jsPDF> {
  if (format === 'thermal') {
    return generateThermalPDFDoc(
      sale,
      settings,
      settings.preferredReceiptPaperSize === '58mm',
      receiptText || ''
    );
  }

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const cur = getPdfCurrency(settings.currency);

  doc.setProperties({
    title: `Tax Invoice #${sale.billNo} - ${settings.shopName || 'ShopPOS'}`,
    subject: `Invoice #${sale.billNo} (${format} format)`,
    author: settings.shopName || 'Store POS',
    creator: 'ShopPOS Vyapar-Style Billing Engine',
    keywords: 'invoice, vyapar, tax invoice, gstin',
  });

  if (format === 'classic') {
    return buildClassicInvoice(doc, sale, settings, cur);
  } else if (format === 'stylish') {
    return buildStylishInvoice(doc, sale, settings, cur);
  } else if (format === 'simple') {
    return buildSimpleInvoice(doc, sale, settings, cur);
  } else if (format === 'retail') {
    return buildRetailInvoice(doc, sale, settings, cur);
  } else {
    return buildRegularInvoice(doc, sale, settings, cur);
  }
}

async function buildRegularInvoice(doc: jsPDF, sale: Sale, settings: Settings, cur: string): Promise<jsPDF> {
  const primaryColor = [67, 56, 202];
  const darkColor = [15, 23, 42];
  const lightColor = [248, 250, 252];
  const borderColor = [226, 232, 240];
  const mutColor = [100, 116, 139];

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 8, 'F');

  const logo = settings.shopLogo || settings.logo;
  let textStartX = 15;
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', 15, 12, 18, 18, undefined, 'FAST');
      textStartX = 37;
    } catch {
      textStartX = 15;
    }
  }

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  let headerY = 27;

  const maxWidth = 110 - (textStartX - 15);

  if (settings.showShopNameOnBill !== false) {
    const nameText = settings.shopName || 'ShopPOS Store';
    const shopLines = doc.splitTextToSize(nameText, maxWidth);
    shopLines.forEach((l: string, i: number) => {
      doc.text(l, textStartX, 19 + i * 5.5);
    });
    headerY = 19 + shopLines.length * 5.5 + 1.5;
  } else {
    doc.text('INVOICE / RECEIPT', textStartX, 19);
    headerY = 25;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutColor[0], mutColor[1], mutColor[2]);

  if (settings.showAddressOnBill !== false && settings.address) {
    settings.address.split('\n').forEach((rl: string) => {
      doc.splitTextToSize(rl, maxWidth).forEach((l: string) => {
        doc.text(l, textStartX, headerY);
        headerY += 4.5;
      });
    });
  }

  if (settings.showPhoneOnBill !== false && settings.phone) {
    doc.text(`Phone: ${settings.phone}`, textStartX, headerY);
    headerY += 4.5;
  }

  if (settings.showGstinOnBill !== false && settings.gstin) {
    doc.text(`GSTIN: ${settings.gstin}`, textStartX, headerY);
    headerY += 4.5;
  }

  if (settings.showFssaiOnBill !== false && settings.fssai) {
    doc.text(`FSSAI Lic. No: ${settings.fssai}`, textStartX, headerY);
    headerY += 4.5;
  }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('TAX INVOICE', 195, 22, { align: 'right' });

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Invoice No: #${sale.billNo}`, 195, 28, { align: 'right' });

  if (settings.showDateOnBill !== false) {
    doc.text(`Date & Time: ${formatDate(sale.date)} ${sale.time || ''}`, 195, 33, { align: 'right' });
  }

  let paymentLabel = (sale.paymentMethod || 'cash').toUpperCase();
  if (sale.paymentMethod === 'split') {
    const sp = sale.splitDetails || { cashAmount: 0, upiAmount: 0 };
    paymentLabel = `SPLIT (Cash: ${cur}${sp.cashAmount} / UPI: ${cur}${sp.upiAmount})`;
  }
  doc.text(`Payment Mode: ${paymentLabel}`, 195, 38, { align: 'right' });

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.rect(145, 41, 50, 4.2, 'F');
  doc.rect(145, 41, 50, 4.2, 'S');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('ORIGINAL TAX INVOICE', 170, 44, { align: 'center' });

  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(15, 47, 195, 47);

  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(15, 51, 180, 25, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.rect(15, 51, 180, 25, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(mutColor[0], mutColor[1], mutColor[2]);
  doc.text('BILLED TO CLIENT', 20, 56);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(sale.customer || 'Walk-In Customer / Guest', 20, 61.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutColor[0], mutColor[1], mutColor[2]);

  let custDetails = '';
  if (sale.customerPhone) custDetails += `Mobile: ${sale.customerPhone}`;
  if (sale.customerAddress) {
    if (custDetails) custDetails += '  |  ';
    custDetails += `Addr: ${sale.customerAddress}`;
  }
  doc.text(custDetails || 'No customer registration details recorded.', 20, 67);

  if (settings.showStaffOnBill !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('INVOICE META', 130, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Handled By: ${sale.staffName || 'Operator'}`, 130, 61.5);
    doc.text(`Status: ${sale.voided ? 'CANCELLED' : sale.paymentMethod === 'credit' && !sale.creditPaid ? 'CREDIT (UNPAID)' : 'PAID & SETTLED'}`, 130, 67);
  }

  let y = 83;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('S.No', 21, y + 5.5, { align: 'center' });
  doc.text('Items & Description', 28, y + 5.5);
  doc.text('Qty', 120, y + 5.5, { align: 'right' });
  doc.text('Unit Rate', 152, y + 5.5, { align: 'right' });
  doc.text(`Total (${cur})`, 190, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFontSize(9);
  sale.items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      doc.rect(15, y, 180, 8, 'F');
    }
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.15);
    doc.line(15, y + 8, 195, y + 8);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}`, 21, y + 5.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    let nameToRender = item.name;
    if (nameToRender.length > 44) nameToRender = nameToRender.slice(0, 41) + '...';
    doc.text(nameToRender, 28, y + 5.2);
    doc.text(`${item.qty} ${item.unit || 'pcs'}`, 120, y + 5.2, { align: 'right' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 152, y + 5.2, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${cur}${formatCurrency(item.qty * item.price)}`, 190, y + 5.2, { align: 'right' });
    y += 8;
    if (y > 230 && index < sale.items.length - 1) {
      doc.addPage();
      y = 20;
    }
  });

  y += 6;
  const labelX = 145;
  const valX = 190;
  doc.setFontSize(9);
  const renderRow = (lbl: string, val: string, isBold = false) => {
    doc.setTextColor(isBold ? darkColor[0] : mutColor[0], isBold ? darkColor[1] : mutColor[1], isBold ? darkColor[2] : mutColor[2]);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(lbl, labelX, y, { align: 'right' });
    doc.text(val, valX, y, { align: 'right' });
    y += 5.2;
  };

  renderRow('Subtotal Amount:', `${cur}${formatCurrency(sale.subtotal)}`);
  if (sale.discount > 0) renderRow('Discount Applied:', `-${cur}${formatCurrency(sale.discount)}`);
  if (sale.gst > 0) {
    const halfGst = (sale.gst / 2).toFixed(2);
    const halfPct = ((sale.gstPct || 0) / 2).toFixed(1);
    if (!sale.interStateGst) {
      renderRow(`CGST (${halfPct}%):`, `${cur}${halfGst}`);
      renderRow(`SGST (${halfPct}%):`, `${cur}${halfGst}`);
    } else {
      renderRow(`IGST (${sale.gstPct || 0}%):`, `${cur}${formatCurrency(sale.gst)}`);
    }
  }

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(115, y - 2, 80, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GRAND TOTAL:', 120, y + 4.5);
  doc.text(`${cur}${formatCurrency(sale.total)}`, 191, y + 4.5, { align: 'right' });

  let notesY = Math.max(y + 16, 160);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TERMS & CONDITIONS', 15, notesY);
  notesY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutColor[0], mutColor[1], mutColor[2]);

  if (settings.showTermsOnBill && settings.termsTextOnBill) {
    settings.termsTextOnBill.split('\n').forEach((tl) => {
      if (tl.trim()) {
        doc.text(tl.trim(), 15, notesY);
        notesY += 4;
      }
    });
  } else {
    doc.text('Goods once sold will not be returned without original invoice.', 15, notesY);
    notesY += 4;
  }
  if (settings.footer) {
    doc.text(settings.footer, 15, notesY);
    notesY += 4;
  }

  const sigX = 135;
  const sigY = notesY + 5;
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.rect(sigX, sigY, 60, 24, 'S');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`For: ${settings.shopName || 'ShopPOS Store'}`, sigX + 3, sigY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutColor[0], mutColor[1], mutColor[2]);
  doc.text('Authorized Signatory', sigX + 30, sigY + 21, { align: 'center' });

  if (settings.showBarcodeOnBill !== false) {
    const barcodeImg = getBarcodeDataURL(String(sale.billNo));
    if (barcodeImg) {
      doc.addImage(barcodeImg, 'PNG', 15, sigY + 3, 44, 10, undefined, 'FAST');
    }
  }

  if (settings.showUpiQrOnBill !== false && settings.upi) {
    const qrBase64 = await loadUpiQrCode(settings.upi, settings.shopName || 'Store POS', sale.total);
    if (qrBase64) {
      doc.addImage(qrBase64, 'JPEG', 80, sigY - 2, 22, 22, undefined, 'FAST');
      doc.setFontSize(6.5);
      doc.text('SCAN TO PAY (UPI)', 91, sigY + 22, { align: 'center' });
    }
  }

  return doc;
}

async function buildStylishInvoice(doc: jsPDF, sale: Sale, settings: Settings, cur: string): Promise<jsPDF> {
  const accentColor = [5, 150, 105];
  const darkColor = [15, 23, 42];
  const lightBg = [240, 253, 244];
  const borderColor = [209, 250, 229];
  const grayText = [71, 85, 105];

  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, 210, 38, 'F');

  const logo = settings.shopLogo || settings.logo;
  let textX = 15;
  if (logo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(13, 7, 24, 24, 2, 2, 'F');
      doc.addImage(logo, 'JPEG', 15, 9, 20, 20, undefined, 'FAST');
      textX = 41;
    } catch {
      textX = 15;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(settings.shopName || 'ShopPOS Store', textX, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  let metaLine = '';
  if (settings.phone) metaLine += `Ph: ${settings.phone}  `;
  if (settings.gstin) metaLine += `|  GSTIN: ${settings.gstin}  `;
  if (settings.address) metaLine += `|  ${settings.address.replace(/\n/g, ', ')}`;
  const maxChars = textX > 20 ? 64 : 85;
  if (metaLine.length > maxChars) metaLine = metaLine.slice(0, maxChars - 3) + '...';
  doc.text(metaLine, textX, 24);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(145, 9, 50, 10, 2, 2, 'F');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TAX INVOICE', 170, 15.5, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text(`Invoice #${sale.billNo}`, 170, 24, { align: 'center' });
  doc.text(`${formatDate(sale.date)} ${sale.time || ''}`, 170, 29, { align: 'center' });

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 44, 88, 22, 2, 2, 'F');
  doc.roundedRect(107, 44, 88, 22, 2, 2, 'F');

  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CUSTOMER / BILLED TO', 20, 49);
  doc.text('PAYMENT DETAILS', 112, 49);

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(10);
  doc.text(sale.customer || 'Guest / Walk-In', 20, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text(sale.customerPhone ? `Mobile: ${sale.customerPhone}` : 'No phone linked', 20, 60);

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Mode: ${(sale.paymentMethod || 'cash').toUpperCase()}`, 112, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text(`Operator: ${sale.staffName || 'Cashier'}  |  Status: Settled`, 112, 60);

  let y = 73;
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(15, y, 180, 8, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('#', 20, y + 5.5, { align: 'center' });
  doc.text('Item Description', 26, y + 5.5);
  doc.text('Qty', 120, y + 5.5, { align: 'right' });
  doc.text('Rate', 152, y + 5.5, { align: 'right' });
  doc.text('Amount', 190, y + 5.5, { align: 'right' });

  y += 8;
  sale.items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, y, 180, 8, 'F');
    }
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.2);
    doc.line(15, y + 8, 195, y + 8);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}`, 20, y + 5.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    let nameToRender = item.name;
    if (nameToRender.length > 44) nameToRender = nameToRender.slice(0, 41) + '...';
    doc.text(nameToRender, 26, y + 5.2);
    doc.text(`${item.qty} ${item.unit || 'pcs'}`, 120, y + 5.2, { align: 'right' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 152, y + 5.2, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${cur}${formatCurrency(item.qty * item.price)}`, 190, y + 5.2, { align: 'right' });
    y += 8;
  });

  y += 6;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(110, y, 85, 30, 2, 2, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(110, y, 85, 30, 2, 2, 'S');

  let finY = y + 6;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text('Subtotal:', 116, finY);
  doc.text(`${cur}${formatCurrency(sale.subtotal)}`, 190, finY, { align: 'right' });

  if (sale.discount > 0) {
    finY += 5;
    doc.setTextColor(16, 185, 129);
    doc.text('Discount Saved:', 116, finY);
    doc.text(`-${cur}${formatCurrency(sale.discount)}`, 190, finY, { align: 'right' });
  }
  if (sale.gst > 0) {
    finY += 5;
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text(`GST (${sale.gstPct || 0}%):`, 116, finY);
    doc.text(`${cur}${formatCurrency(sale.gst)}`, 190, finY, { align: 'right' });
  }

  finY += 6;
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(113, finY - 2.5, 79, 8.5, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL AMOUNT:', 117, finY + 3.2);
  doc.text(`${cur}${formatCurrency(sale.total)}`, 189, finY + 3.2, { align: 'right' });

  if (sale.discount > 0) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(15, y, 88, 12, 2, 2, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Customer Savings: ${cur}${formatCurrency(sale.discount)}`, 20, y + 7.5);
  }

  let notesY = Math.max(y + 36, 170);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('STORE TERMS & GREETINGS', 15, notesY);
  notesY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text(settings.footer || 'Thank you for shopping with us! Have a wonderful day.', 15, notesY);

  if (settings.showBarcodeOnBill !== false) {
    const barcodeImg = getBarcodeDataURL(String(sale.billNo));
    if (barcodeImg) {
      doc.addImage(barcodeImg, 'PNG', 15, notesY + 6, 44, 10, undefined, 'FAST');
    }
  }

  return doc;
}

async function buildClassicInvoice(doc: jsPDF, sale: Sale, settings: Settings, cur: string): Promise<jsPDF> {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(10, 10, 190, 277, 'S');
  doc.setLineWidth(0.2);
  doc.rect(11.5, 11.5, 187, 274, 'S');

  const logo = settings.shopLogo || settings.logo;
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', 16, 14, 16, 16, undefined, 'FAST');
    } catch {
      // ignore logo load error
    }
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(settings.shopName || 'ShopPOS Store', 105, 23, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(9);

  let subHeader = '';
  if (settings.address) subHeader += settings.address.replace(/\n/g, ', ') + '  |  ';
  if (settings.phone) subHeader += `Tel: ${settings.phone}  |  `;
  if (settings.gstin) subHeader += `GSTIN: ${settings.gstin}`;
  doc.text(subHeader, 105, 28, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(15, 31, 195, 31);
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('TAX INVOICE', 105, 36, { align: 'center' });

  const boxTop = 39;
  const boxHeight = 24;
  doc.rect(15, boxTop, 88, boxHeight, 'S');
  doc.rect(107, boxTop, 88, boxHeight, 'S');

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('SUPPLIER / CONSIGNOR:', 18, boxTop + 5);
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.text(`Firm: ${settings.shopName || 'Store'}`, 18, boxTop + 10);
  doc.text(`GSTIN: ${settings.gstin || 'Unregistered'}`, 18, boxTop + 14);
  doc.text(`FSSAI Lic: ${settings.fssai || 'N/A'}`, 18, boxTop + 18);

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('BUYER / CONSIGNEE:', 110, boxTop + 5);
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.text(`Name: ${sale.customer || 'Cash Customer'}`, 110, boxTop + 10);
  doc.text(`Mobile: ${sale.customerPhone || 'N/A'}`, 110, boxTop + 14);
  doc.text(`Invoice No: #${sale.billNo}  |  Date: ${formatDate(sale.date)}`, 110, boxTop + 18);

  let y = boxTop + boxHeight + 4;
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, 180, 7, 'F');
  doc.rect(15, y, 180, 7, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('S.No', 21, y + 5, { align: 'center' });
  doc.text('Description of Goods / Services', 28, y + 5);
  doc.text('Quantity', 120, y + 5, { align: 'right' });
  doc.text('Rate', 152, y + 5, { align: 'right' });
  doc.text('Amount', 190, y + 5, { align: 'right' });

  y += 7;
  sale.items.forEach((item, index) => {
    doc.rect(15, y, 180, 7.5, 'S');
    doc.setFont('times', 'bold');
    doc.text(`${index + 1}`, 21, y + 5, { align: 'center' });
    doc.setFont('times', 'normal');
    let nameToRender = item.name;
    if (nameToRender.length > 44) nameToRender = nameToRender.slice(0, 41) + '...';
    doc.text(nameToRender, 28, y + 5);
    doc.text(`${item.qty} ${item.unit || 'pcs'}`, 120, y + 5, { align: 'right' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 152, y + 5, { align: 'right' });
    doc.setFont('times', 'bold');
    doc.text(`${cur}${formatCurrency(item.qty * item.price)}`, 190, y + 5, { align: 'right' });
    y += 7.5;
  });

  y += 4;
  const renderClassicFin = (lbl: string, val: string, isBold = false) => {
    doc.setFont('times', isBold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.text(lbl, 145, y, { align: 'right' });
    doc.text(val, 190, y, { align: 'right' });
    y += 5;
  };

  renderClassicFin('Subtotal:', `${cur}${formatCurrency(sale.subtotal)}`);
  if (sale.discount > 0) renderClassicFin('Less Discount:', `-${cur}${formatCurrency(sale.discount)}`);
  if (sale.gst > 0) renderClassicFin(`Add GST (${sale.gstPct}%):`, `${cur}${formatCurrency(sale.gst)}`);

  doc.line(115, y, 195, y);
  y += 4.5;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL AMOUNT:', 140, y, { align: 'right' });
  doc.text(`${cur}${formatCurrency(sale.total)}`, 190, y, { align: 'right' });
  doc.line(115, y + 1.5, 195, y + 1.5);
  doc.line(115, y + 2.2, 195, y + 2.2);

  let stampY = Math.max(y + 16, 175);
  doc.rect(15, stampY, 105, 30, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.text('DECLARATION & TERMS:', 18, stampY + 5);
  doc.setFont('times', 'normal');
  doc.text('We declare that this invoice shows the actual price of the goods described', 18, stampY + 10);
  doc.text('and that all particulars are true and correct.', 18, stampY + 14);
  doc.text(settings.termsTextOnBill ? settings.termsTextOnBill.split('\n')[0] : 'Subject to local jurisdiction.', 18, stampY + 18);

  doc.rect(125, stampY, 70, 30, 'S');
  doc.setFont('times', 'bold');
  doc.text(`For: ${settings.shopName || 'Store'}`, 128, stampY + 5);
  doc.setFont('times', 'normal');
  doc.text('[ AUTHORIZED SIGNATORY ]', 160, stampY + 26, { align: 'center' });

  return doc;
}

async function buildSimpleInvoice(doc: jsPDF, sale: Sale, settings: Settings, cur: string): Promise<jsPDF> {
  const logo = settings.shopLogo || settings.logo;
  let textX = 15;
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', 15, 11, 16, 16, undefined, 'FAST');
      textX = 35;
    } catch {
      textX = 15;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text(settings.shopName || 'ShopPOS Store', textX, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  let sub = '';
  if (settings.phone) sub += `Phone: ${settings.phone}  |  `;
  if (settings.gstin) sub += `GSTIN: ${settings.gstin}`;
  doc.text(sub, textX, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INVOICE', 195, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Bill #${sale.billNo}  |  ${formatDate(sale.date)}`, 195, 25, { align: 'right' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(15, 28, 195, 28);

  doc.setFontSize(8.5);
  doc.text(`Client: ${sale.customer || 'Walk-In Customer'} ${sale.customerPhone ? `(${sale.customerPhone})` : ''}`, 15, 34);
  doc.text(`Mode: ${(sale.paymentMethod || 'cash').toUpperCase()}`, 195, 34, { align: 'right' });

  doc.setLineWidth(0.15);
  doc.line(15, 37, 195, 37);

  let y = 43;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('S.No', 18, y);
  doc.text('Item Description', 28, y);
  doc.text('Qty', 125, y, { align: 'right' });
  doc.text('Price', 155, y, { align: 'right' });
  doc.text('Total', 195, y, { align: 'right' });
  doc.line(15, y + 2, 195, y + 2);

  y += 7;
  doc.setFont('helvetica', 'normal');
  sale.items.forEach((item, index) => {
    doc.text(`${index + 1}`, 18, y);
    let nameToRender = item.name;
    if (nameToRender.length > 45) nameToRender = nameToRender.slice(0, 42) + '...';
    doc.text(nameToRender, 28, y);
    doc.text(`${item.qty}`, 125, y, { align: 'right' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 155, y, { align: 'right' });
    doc.text(`${cur}${formatCurrency(item.qty * item.price)}`, 195, y, { align: 'right' });
    y += 5.5;
  });

  doc.line(15, y + 1, 195, y + 1);
  y += 6;

  doc.text('Subtotal:', 155, y, { align: 'right' });
  doc.text(`${cur}${formatCurrency(sale.subtotal)}`, 195, y, { align: 'right' });
  y += 5;

  if (sale.discount > 0) {
    doc.text('Discount:', 155, y, { align: 'right' });
    doc.text(`-${cur}${formatCurrency(sale.discount)}`, 195, y, { align: 'right' });
    y += 5;
  }
  if (sale.gst > 0) {
    doc.text(`GST (${sale.gstPct}%):`, 155, y, { align: 'right' });
    doc.text(`${cur}${formatCurrency(sale.gst)}`, 195, y, { align: 'right' });
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL:', 155, y, { align: 'right' });
  doc.text(`${cur}${formatCurrency(sale.total)}`, 195, y, { align: 'right' });
  doc.line(135, y + 2, 195, y + 2);
  doc.line(135, y + 2.6, 195, y + 2.6);

  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Thank you! Visit again.', 15, y);

  return doc;
}

async function buildRetailInvoice(doc: jsPDF, sale: Sale, settings: Settings, cur: string): Promise<jsPDF> {
  const primaryColor = [126, 34, 206];
  const darkColor = [15, 23, 42];

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 6, 'F');

  const logo = settings.shopLogo || settings.logo;
  let textX = 15;
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', 15, 10, 18, 18, undefined, 'FAST');
      textX = 37;
    } catch {
      textX = 15;
    }
  }

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(settings.shopName || 'ShopPOS Supermarket', textX, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  let storeMeta = '';
  if (settings.address) storeMeta += settings.address.replace(/\n/g, ', ') + '  |  ';
  if (settings.phone) storeMeta += `Ph: ${settings.phone}  |  `;
  if (settings.gstin) storeMeta += `GSTIN: ${settings.gstin}`;
  const maxRetailMeta = textX > 20 ? 60 : 80;
  if (storeMeta.length > maxRetailMeta) storeMeta = storeMeta.slice(0, maxRetailMeta - 3) + '...';
  doc.text(storeMeta, textX, 23);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RETAIL TAX INVOICE', 195, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Bill #${sale.billNo}  |  ${formatDate(sale.date)} ${sale.time || ''}`, 195, 23, { align: 'right' });

  doc.setDrawColor(200, 200, 200);
  doc.line(15, 26, 195, 26);

  doc.setFontSize(8.5);
  doc.text(`Customer: ${sale.customer || 'Walk-In Guest'} ${sale.customerPhone ? `(${sale.customerPhone})` : ''}`, 15, 31);
  doc.text(`Cashier: ${sale.staffName || 'POS Terminal'}  |  Pay: ${(sale.paymentMethod || 'cash').toUpperCase()}`, 195, 31, { align: 'right' });

  let y = 36;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, y, 180, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('S.No', 19, y + 5, { align: 'center' });
  doc.text('Product Description', 25, y + 5);
  doc.text('MRP', 112, y + 5, { align: 'right' });
  doc.text('Rate', 134, y + 5, { align: 'right' });
  doc.text('Qty', 152, y + 5, { align: 'right' });
  doc.text('Disc', 170, y + 5, { align: 'right' });
  doc.text('Total', 191, y + 5, { align: 'right' });

  y += 7.5;
  let totalSavings = sale.discount || 0;
  sale.items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(250, 245, 255);
      doc.rect(15, y, 180, 7.5, 'F');
    }
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y + 7.5, 195, y + 7.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${index + 1}`, 19, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    let nameToRender = item.name;
    if (nameToRender.length > 38) nameToRender = nameToRender.slice(0, 35) + '...';
    doc.text(nameToRender, 25, y + 5);
    const mrpVal = (item as any).mrp ? (item as any).mrp : item.price;
    const itemDisc = Math.max(0, (mrpVal - item.price) * item.qty);
    if (itemDisc > 0) totalSavings += itemDisc;
    doc.text(`${cur}${formatCurrency(mrpVal)}`, 112, y + 5, { align: 'right' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 134, y + 5, { align: 'right' });
    doc.text(`${item.qty}`, 152, y + 5, { align: 'right' });
    doc.text(itemDisc > 0 ? `-${cur}${formatCurrency(itemDisc)}` : '-', 170, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${cur}${formatCurrency(item.qty * item.price)}`, 191, y + 5, { align: 'right' });
    y += 7.5;
  });

  y += 4;
  if (totalSavings > 0) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(15, y, 180, 8.5, 1.5, 1.5, 'F');
    doc.roundedRect(15, y, 180, 8.5, 1.5, 1.5, 'S');
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL SAVINGS ON THIS BILL: ${cur}${formatCurrency(totalSavings)} (Thank you for shopping with us!)`, 105, y + 5.5, { align: 'center' });
    y += 12;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Subtotal:', 150, y, { align: 'right' });
  doc.text(`${cur}${formatCurrency(sale.subtotal)}`, 191, y, { align: 'right' });
  y += 5;

  if (sale.discount > 0) {
    doc.text('Bill Discount:', 150, y, { align: 'right' });
    doc.text(`-${cur}${formatCurrency(sale.discount)}`, 191, y, { align: 'right' });
    y += 5;
  }
  if (sale.gst > 0) {
    doc.text(`GST Tax (${sale.gstPct}%):`, 150, y, { align: 'right' });
    doc.text(`${cur}${formatCurrency(sale.gst)}`, 191, y, { align: 'right' });
    y += 5;
  }

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(120, y - 2, 75, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('NET PAYABLE:', 125, y + 4.2);
  doc.text(`${cur}${formatCurrency(sale.total)}`, 190, y + 4.2, { align: 'right' });

  if (settings.showBarcodeOnBill !== false) {
    const barcodeImg = getBarcodeDataURL(String(sale.billNo));
    if (barcodeImg) {
      doc.addImage(barcodeImg, 'PNG', 15, y, 44, 10, undefined, 'FAST');
    }
  }

  return doc;
}
