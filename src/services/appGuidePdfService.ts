/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Settings } from '../types';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function generateWorkflowDiagramImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const gradient = ctx.createLinearGradient(0, 0, 1200, 240);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e1b4b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, 0, 0, 1200, 240, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 1200; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 240);
      ctx.stroke();
    }

    const nodes = [
      { num: '01', title: 'STORE SETUP', sub: 'GSTIN, FSSAI & UPI', color: '#6366f1' },
      { num: '02', title: 'STOCK INWARD', sub: 'Batches & Barcodes', color: '#10b981' },
      { num: '03', title: 'CASHIER PIN', sub: 'Shift Clock-In', color: '#f59e0b' },
      { num: '04', title: 'POS BILLING', sub: 'Scan & Cart Math', color: '#a855f7' },
      { num: '05', title: 'DOCUMENTS', sub: 'Challans & Invoices', color: '#06b6d4' },
      { num: '06', title: 'Z-REPORT', sub: 'Audit & Rollover', color: '#f43f5e' },
    ];

    const nodeWidth = 168;
    const nodeHeight = 160;
    const startX = 24;
    const spacing = 194;
    const startY = 40;

    nodes.forEach((node, i) => {
      const x = startX + i * spacing;
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2.5;
      drawRoundedRect(ctx, x, startY, nodeWidth, nodeHeight, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = node.color;
      drawRoundedRect(ctx, x + 12, startY + 12, 42, 24, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.num, x + 33, startY + 29);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(node.title, x + 12, startY + 75);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(node.sub, x + 12, startY + 102);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      drawRoundedRect(ctx, x + 12, startY + 120, nodeWidth - 24, 24, 6);
      ctx.fill();

      ctx.fillStyle = node.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`PHASE ${node.num}`, x + 20, startY + 136);

      if (i < nodes.length - 1) {
        const arrowX = x + nodeWidth + 6;
        const arrowY = startY + nodeHeight / 2;
        ctx.fillStyle = '#818cf8';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - 8);
        ctx.lineTo(arrowX + 14, arrowY);
        ctx.lineTo(arrowX, arrowY + 8);
        ctx.fill();
      }
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas workflow generator error:', e);
    return null;
  }
}

function generateProductFieldsDiagramImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, 0, 0, 1200, 300, 16);
    ctx.fill();

    const fields = [
      {
        num: 'FIELD 1',
        title: 'BUY / COST PRICE',
        value: 'Rs.700.00',
        color: '#f59e0b',
        sub: 'Paid to Supplier / Wholesaler',
        desc: 'Calculates COGS, Net Profit & Total Inventory Asset Valuation.',
        x: 30,
      },
      {
        num: 'FIELD 2',
        title: 'MRP (MAX RETAIL PRICE)',
        value: 'Rs.1,000.00',
        color: '#6366f1',
        sub: 'Manufacturer Legal Ceiling',
        desc: 'Computes Customer Savings badge (MRP - Sell Price = Rs.100 Off).',
        x: 320,
      },
      {
        num: 'FIELD 3',
        title: 'SELLING / OFFER PRICE',
        value: 'Rs.900.00',
        color: '#10b981',
        sub: 'Actual Counter Retail Price',
        desc: 'Default rate loaded into POS cart. Yields Gross Margin: Rs.200.00.',
        x: 610,
      },
      {
        num: 'FIELD 4',
        title: 'CURRENT STOCK QTY',
        value: '50 Units',
        color: '#06b6d4',
        sub: 'Physical Inventory on Shelf',
        desc: 'Auto-deducted on billing. Feeds Low Stock Alert & AI Velocity.',
        x: 900,
      },
    ];

    fields.forEach((f) => {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2.5;
      drawRoundedRect(ctx, f.x, 30, 270, 200, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = f.color;
      drawRoundedRect(ctx, f.x + 16, 45, 80, 22, 5);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.num, f.x + 56, 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(f.title, f.x + 16, 90);

      ctx.fillStyle = f.color;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(f.value, f.x + 16, 120);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px sans-serif';
      ctx.fillText(f.sub, f.x + 16, 144);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      const words = f.desc.split(' ');
      let line1 = '';
      let line2 = '';
      words.forEach((w) => {
        if ((line1 + w).length < 32) line1 += w + ' ';
        else line2 += w + ' ';
      });
      ctx.fillText(line1, f.x + 16, 175);
      ctx.fillText(line2, f.x + 16, 195);
    });

    ctx.fillStyle = '#334155';
    drawRoundedRect(ctx, 30, 245, 1140, 42, 8);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CORE MARGIN MATH: Gross Profit = Selling Price (Rs.900) - Buy Price (Rs.700) = Rs.200 (22.2% Margin) | Customer Discount = Rs.100 Off MRP', 600, 271);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas product fields generator error:', e);
    return null;
  }
}

function generateDocumentsLifecycleImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, 0, 0, 1200, 270, 16);
    ctx.fill();

    const docs = [
      { code: 'EST', name: 'QUOTATION / ESTIMATE', use: 'Pre-sale price proposal', action: '1-Click Convert to Cart', color: '#6366f1' },
      { code: 'PO', name: 'PURCHASE ORDER', use: 'Commercial vendor order', action: 'Inward Stock Verification', color: '#f59e0b' },
      { code: 'DC', name: 'DELIVERY CHALLAN', use: 'Goods transport slip', action: 'Vehicle & Qty Dispatch', color: '#06b6d4' },
      { code: 'INV', name: 'GST TAX INVOICE', use: 'Statutory commercial sale', action: 'Tax Accounting & GSTR-1', color: '#10b981' },
      { code: 'CN/DN', name: 'CREDIT / DEBIT NOTES', use: 'Sales return & refunds', action: 'Customer Debt Reduction', color: '#ec4899' },
    ];

    const boxW = 210;
    const boxH = 180;
    const startX = 30;
    const spacing = 236;
    const startY = 45;

    docs.forEach((d, i) => {
      const x = startX + i * spacing;
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.5;
      drawRoundedRect(ctx, x, startY, boxW, boxH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = d.color;
      drawRoundedRect(ctx, x + 14, startY + 14, 56, 24, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.code, x + 42, startY + 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(d.name, x + 14, startY + 68);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px sans-serif';
      ctx.fillText(d.use, x + 14, startY + 95);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      drawRoundedRect(ctx, x + 14, startY + 120, boxW - 28, 36, 6);
      ctx.fill();

      ctx.fillStyle = d.color;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(d.action, x + 20, startY + 142);

      if (i < docs.length - 1) {
        const arrowX = x + boxW + 4;
        const arrowY = startY + boxH / 2;
        ctx.fillStyle = '#818cf8';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - 8);
        ctx.lineTo(arrowX + 16, arrowY);
        ctx.lineTo(arrowX, arrowY + 8);
        ctx.fill();
      }
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas docs lifecycle generator error:', e);
    return null;
  }
}

function generateThermalReceiptMockupImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 620;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 0, 0, 620, 780, 16);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('SUPERMARKET & RETAIL STORE', 310, 42);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('124 Commercial Market, City Center', 310, 64);
    ctx.fillText('Phone: +91 98765 43210 | GSTIN: 27AAAAA0000A1Z5', 310, 82);

    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, 98);
    ctx.lineTo(590, 98);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('TAX INVOICE: #INV-2026-8892', 35, 118);
    ctx.textAlign = 'right';
    ctx.fillText('DATE: 15-AUG-2026 14:30', 585, 118);

    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('CASHIER: Rahul S. (Reg #1)', 35, 136);
    ctx.textAlign = 'right';
    ctx.fillText('PAYMENT: Bharat QR UPI', 585, 136);

    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, 150);
    ctx.lineTo(590, 150);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('ITEM PARTICULARS', 35, 170);
    ctx.fillText('QTY', 300, 170);
    ctx.fillText('RATE', 410, 170);
    ctx.textAlign = 'right';
    ctx.fillText('AMOUNT', 585, 170);

    const sampleItems = [
      { name: 'Organic Honey 500g (HSN 0409)', qty: '1', rate: '450.00', amt: '450.00' },
      { name: 'Royal Basmati Rice 5kg (HSN 1006)', qty: '2', rate: '380.00', amt: '760.00' },
      { name: 'Pasteurized Butter 200g (HSN 0405)', qty: '1', rate: '120.00', amt: '120.00' },
      { name: 'Cold Pressed Coconut Oil 1L', qty: '1', rate: '290.00', amt: '290.00' },
    ];

    ctx.font = '12px monospace';
    ctx.fillStyle = '#334155';
    let itemY = 194;
    sampleItems.forEach((it) => {
      ctx.textAlign = 'left';
      ctx.fillText(it.name, 35, itemY);
      ctx.fillText(it.qty, 300, itemY);
      ctx.fillText(it.rate, 410, itemY);
      ctx.textAlign = 'right';
      ctx.fillText(it.amt, 585, itemY);
      itemY += 22;
    });

    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, itemY + 4);
    ctx.lineTo(590, itemY + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    itemY += 22;

    const totals = [
      { label: 'Sub Total Gross:', val: 'Rs.1,620.00', bold: false },
      { label: 'Festival Discount (5%):', val: '-Rs.81.00', bold: false },
      { label: 'Net Taxable Value:', val: 'Rs.1,539.00', bold: false },
      { label: 'CGST (2.5%):', val: 'Rs.38.48', bold: false },
      { label: 'SGST (2.5%):', val: 'Rs.38.48', bold: false },
      { label: 'GRAND TOTAL:', val: 'Rs.1,615.96', bold: true },
    ];

    totals.forEach((t) => {
      ctx.font = t.bold ? 'bold 17px monospace' : '12px monospace';
      ctx.fillStyle = t.bold ? '#0f172a' : '#475569';
      ctx.textAlign = 'left';
      ctx.fillText(t.label, 270, itemY);
      ctx.textAlign = 'right';
      ctx.fillText(t.val, 585, itemY);
      itemY += t.bold ? 26 : 19;
    });

    ctx.fillStyle = '#ecfdf5';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 35, itemY, 220, 50, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PAID VIA BHARAT QR', 45, itemY + 20);
    ctx.font = '11px monospace';
    ctx.fillText('REF: UPI-99482019482', 45, itemY + 38);

    const qrX = 490;
    const qrY = itemY - 6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(qrX, qrY, 95, 95);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX + 6, qrY + 6, 83, 83);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(qrX + 12, qrY + 12, 24, 24);
    ctx.fillRect(qrX + 59, qrY + 12, 24, 24);
    ctx.fillRect(qrX + 12, qrY + 59, 24, 24);
    ctx.fillRect(qrX + 44, qrY + 44, 16, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX + 18, qrY + 18, 12, 12);
    ctx.fillRect(qrX + 65, qrY + 18, 12, 12);
    ctx.fillRect(qrX + 18, qrY + 65, 12, 12);

    const barY = itemY + 84;
    ctx.fillStyle = '#0f172a';
    for (let b = 35; b < 440; b += (b % 7 === 0 ? 6 : b % 3 === 0 ? 4 : 2)) {
      ctx.fillRect(b, barY, b % 2 === 0 ? 2.5 : 1.2, 36);
    }
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('* INV-2026-8892 *', 235, barY + 50);

    ctx.font = 'italic 12px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Thank you for your business! Please visit again.', 310, 760);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas receipt generator error:', e);
    return null;
  }
}

function generateGstComparisonImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, 0, 0, 1200, 420, 16);
    ctx.fill();

    const cardWidth = 560;
    const cardHeight = 310;
    const cardY = 30;

    const x1 = 30;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, x1, cardY, cardWidth, cardHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('A. TAX EXCLUSIVE PRICING (TAX ADDED ON TOP)', x1 + 20, cardY + 35);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px sans-serif';
    ctx.fillText('Common in B2B Wholesale & Commercial Invoices', x1 + 20, cardY + 60);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    drawRoundedRect(ctx, x1 + 20, cardY + 80, cardWidth - 40, 120, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('1. Taxable Base = (Price * Qty) - Discount', x1 + 35, cardY + 110);
    ctx.fillText('2. CGST (9%) = Taxable Base * 9 / 100', x1 + 35, cardY + 135);
    ctx.fillText('3. SGST (9%) = Taxable Base * 9 / 100', x1 + 35, cardY + 160);
    ctx.fillText('4. Grand Total = Taxable Base + CGST + SGST', x1 + 35, cardY + 185);

    ctx.fillStyle = '#312e81';
    drawRoundedRect(ctx, x1 + 20, cardY + 220, cardWidth - 40, 65, 8);
    ctx.fill();

    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WORKED EXAMPLE (@ Rs.1,000 with 18% GST):', x1 + 35, cardY + 245);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Base: Rs.1,000 + CGST: Rs.90 + SGST: Rs.90 -> TOTAL: Rs.1,180.00', x1 + 35, cardY + 268);

    const x2 = 610;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, x2, cardY, cardWidth, cardHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('B. TAX INCLUSIVE PRICING (TAX INCLUDED IN MRP)', x2 + 20, cardY + 35);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px sans-serif';
    ctx.fillText('Standard for Supermarkets, Retail FMCG & Groceries', x2 + 20, cardY + 60);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    drawRoundedRect(ctx, x2 + 20, cardY + 80, cardWidth - 40, 120, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('1. Taxable Base = MRP / (1 + (GST% / 100))', x2 + 35, cardY + 110);
    ctx.fillText('2. Total Included Tax = MRP - Taxable Base', x2 + 35, cardY + 135);
    ctx.fillText('3. CGST (Half) = Total Included Tax / 2', x2 + 35, cardY + 160);
    ctx.fillText('4. SGST (Half) = Total Included Tax / 2', x2 + 35, cardY + 185);

    ctx.fillStyle = '#064e3b';
    drawRoundedRect(ctx, x2 + 20, cardY + 220, cardWidth - 40, 65, 8);
    ctx.fill();

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WORKED EXAMPLE (MRP Rs.1,000 with 18% GST):', x2 + 35, cardY + 245);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Base: Rs.847.46 + CGST: Rs.76.27 + SGST: Rs.76.27 -> MRP: Rs.1,000.00', x2 + 35, cardY + 268);

    ctx.fillStyle = '#334155';
    drawRoundedRect(ctx, 30, 360, 1140, 45, 10);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NET PROFIT EQUATION: Net Profit = (Gross Revenue Excl Tax) - (Cost Price * Qty) - Discounts', 600, 388);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas GST comparison generator error:', e);
    return null;
  }
}

function generateBarcodeStickerImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, 0, 0, 1000, 300, 16);
    ctx.fill();

    const stickers = [
      {
        name: 'PREMIUM CASHEW 500G',
        sku: 'SKU-CSH-500',
        mrp: 'Rs.550.00',
        sell: 'Rs.480.00',
        code: '8901030994821',
        x: 40,
      },
      {
        name: 'EXTRA VIRGIN OLIVE OIL 1L',
        sku: 'SKU-OIL-1000',
        mrp: 'Rs.1,200.00',
        sell: 'Rs.999.00',
        code: '8901030773918',
        x: 520,
      },
    ];

    stickers.forEach((st) => {
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, st.x, 25, 440, 250, 12);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SUPERMARKET & RETAIL STORE', st.x + 220, 50);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(st.name, st.x + 220, 75);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText(`MRP: ${st.mrp} (Incl. Taxes)`, st.x + 220, 95);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`OFFER: ${st.sell}`, st.x + 220, 125);

      const barStartY = 145;
      ctx.fillStyle = '#000000';
      for (let b = st.x + 40; b < st.x + 400; b += (b % 7 === 0 ? 5 : b % 4 === 0 ? 3 : 2)) {
        ctx.fillRect(b, barStartY, b % 3 === 0 ? 2.5 : 1.2, 55);
      }
      ctx.font = '13px monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText(st.code, st.x + 220, barStartY + 75);
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas barcode generator error:', e);
    return null;
  }
}

function generateStaffRoleMatrixImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, 0, 0, 1200, 360, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FEATURE / OPERATIONAL CAPABILITY', 40, 45);

    const roles = [
      { name: 'ADMIN (OWNER)', color: '#ef4444', x: 620 },
      { name: 'STORE MANAGER', color: '#a855f7', x: 820 },
      { name: 'CASHIER OPERATOR', color: '#10b981', x: 1020 },
    ];

    roles.forEach((r) => {
      ctx.fillStyle = r.color;
      drawRoundedRect(ctx, r.x - 70, 20, 140, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, r.x, 42);
    });

    const rows = [
      { name: '1. Fast POS Billing, Scanner & Checkout', admin: true, mgr: true, csh: true },
      { name: '2. Return & Refund Process Invoices', admin: true, mgr: true, csh: true },
      { name: '3. Inventory Stock Adjustments & Cost Prices', admin: true, mgr: true, csh: false },
      { name: '4. Supplier Purchases & Restock Orders', admin: true, mgr: true, csh: false },
      { name: '5. Customer Credit Ledger / Udhaar Overrides', admin: true, mgr: true, csh: false },
      { name: '6. Net Profit & GSTR-1 Sales Tax Reports', admin: true, mgr: false, csh: false },
      { name: '7. Database Backup, Restore & Store Settings', admin: true, mgr: false, csh: false },
    ];

    let rowY = 85;
    rows.forEach((row, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#172033';
      drawRoundedRect(ctx, 30, rowY - 20, 1140, 36, 6);
      ctx.fill();

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.name, 45, rowY + 3);

      const drawCheck = (val: boolean, x: number) => {
        if (val) {
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ALLOWED', x, rowY + 4);
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('RESTRICTED', x, rowY + 3);
        }
      };

      drawCheck(row.admin, 620);
      drawCheck(row.mgr, 820);
      drawCheck(row.csh, 1020);
      rowY += 38;
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas role matrix generator error:', e);
    return null;
  }
}

function generateHardwareDiagramImage(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, 0, 0, 1200, 240, 16);
    ctx.fill();

    ctx.fillStyle = '#312e81';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 480, 40, 240, 160, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHOPPOS PRO', 600, 95);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText('CORE POS ENGINE', 600, 120);
    ctx.fillText('100% Offline SQLite/IndexedDB', 600, 145);

    const peripherals = [
      { title: 'THERMAL PRINTER', sub: '58mm / 80mm Bluetooth', x: 50, y: 40, color: '#10b981' },
      { title: 'BARCODE SCANNERS', sub: 'USB HID & Phone Camera', x: 50, y: 130, color: '#f59e0b' },
      { title: 'BHARAT QR DISPLAY', sub: 'UPI Dynamic Payments', x: 890, y: 40, color: '#06b6d4' },
      { title: 'OFFICE A4 PRINTER', sub: 'WiFi & Mopria Spooler', x: 890, y: 130, color: '#ec4899' },
    ];

    peripherals.forEach((p) => {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, p.x, p.y, 260, 75, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.title, p.x + 18, p.y + 32);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(p.sub, p.x + 18, p.y + 55);
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas hardware diagram generator error:', e);
    return null;
  }
}

export function generateAppGuidePdf(settings?: Settings): { doc: jsPDF; base64: string; filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const primaryColor = [79, 70, 229]; // Indigo #4f46e5
  const secondaryColor = [30, 41, 59]; // Slate 800 #1e293b
  const accentColor = [16, 185, 129]; // Emerald 500 #10b981
  const darkTextColor = [15, 23, 42]; // Slate 900
  const mutedTextColor = [100, 116, 139]; // Slate 500

  const addPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text('ShopPOS Pro - Operational Manual & Feature Guide', margin, 9);
    doc.text('Universal Beginner Guide', pageWidth - margin, 9, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 11, pageWidth - margin, 11);
  };

  const addFooter = () => {
    const pageNum = doc.internal.pages.length - 1;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text('ShopPOS Pro - Comprehensive Operational Manual', margin, pageHeight - 7);
    doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  };

  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - 16) {
      addFooter();
      doc.addPage();
      y = margin + 4;
      addPageHeader();
    }
  };

  // COVER PAGE / HEADER HERO
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.roundedRect(margin, y, contentWidth, 44, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('ShopPOS Pro - Master User Guide', margin + 8, y + 14);
  doc.setFontSize(10);
  doc.setTextColor(199, 210, 254);
  doc.text('Complete Operational Guide for Every Module, Product Field, Document & Button', margin + 8, y + 22);
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(margin + 8, y + 27, 54, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('USER MANUAL', margin + 12, y + 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Simple, step-by-step instructions designed for all store owners, managers & cashiers', margin + 66, y + 34);
  y += 52;

  // TABLE OF CONTENTS
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 42, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TABLE OF CONTENTS & MODULE OVERVIEW', margin + 6, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

  const tocLeft = [
    'Ch 1: Store Lifecycle & Visual Workflow Flowchart',
    'Ch 2: POS Billing Register & Every Button Explained',
    'Ch 3: New Product / Stock Form & The 4 Pricing Fields',
    'Ch 4: Documents Module (Estimates, POs, Challans, Notes, E-Way)',
    'Ch 5: GST & Tax Math Calculation Engine (Infographic)',
  ];
  const tocRight = [
    'Ch 6: Inventory, Barcoding Stickers & AI Stock Velocity',
    'Ch 7: Customer Credit (Udhaar) Khata Ledger & Reminders',
    'Ch 8: Suppliers Directory & Expense Management',
    'Ch 9: Staff Management & Cashier Access Control Matrix',
    'Ch 10: Hardware Setup (Thermal Bluetooth, HID Scanners, Backup)',
  ];

  tocLeft.forEach((item, i) => {
    doc.text(item, margin + 6, y + 15 + (i * 5));
  });
  tocRight.forEach((item, i) => {
    doc.text(item, margin + 95, y + 15 + (i * 5));
  });
  y += 48;

  const addSectionHeader = (title: string, subtitle: string) => {
    ensureSpace(18);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y, 3.5, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(title, margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(subtitle, margin + 6, y + 11);
    y += 16;
  };

  const addCalloutBox = (title: string, description: string, color: number[] = primaryColor) => {
    ensureSpace(18);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title, margin + 5, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(description, margin + 5, y + 10.5);
    y += 18;
  };

  // CHAPTER 1
  addSectionHeader('1. Core Application Architecture & Daily Store Workflow', 'How the entire POS lifecycle functions from morning opening to night rollover');
  const workflowImg = generateWorkflowDiagramImage();
  if (workflowImg) {
    ensureSpace(44);
    doc.addImage(workflowImg, 'PNG', margin, y, contentWidth, 38);
    y += 42;
  }

  const workflowSteps = [
    {
      step: 'Step 1: First-Time Onboarding & Store Profile',
      desc: 'Configures Shop Name, Phone, Address, GSTIN (15 digits), FSSAI license (14 digits), UPI ID (for Bharat QR), currency, and admin security passcode. These details automatically populate receipts and tax invoices.',
    },
    {
      step: 'Step 2: Inventory Inward & Barcode Label Generation',
      desc: 'Add products with Selling Price, Cost/Buy Price, MRP, Current Stock Qty, Unit, Expiry Date, HSN/SAC code, and Tax %. Print sticker barcode labels for quick scanning.',
    },
    {
      step: 'Step 3: Cashier Clock-in & Shift Authentication',
      desc: 'Cashier enters staff PIN to clock-in. All subsequent billing transactions, invoice receipts, and cash drawer tallies are stamped with their active operator session.',
    },
    {
      step: 'Step 4: POS Billing, Barcode Scan & Quick Add',
      desc: 'Items are added to cart via physical laser barcode scanner, phone camera MLKit scanner, category quick-filter tabs, or manual search. Quantity and custom prices can be edited on the fly.',
    },
    {
      step: 'Step 5: Commercial Invoicing & Multi-Mode Settlement',
      desc: 'Select Cash (auto change calculator), dynamic Bharat QR UPI code, Card, Split Payment, or Customer Credit (Udhaar Ledger). One-tap checkout saves the sale to local database.',
    },
    {
      step: 'Step 6: Instant Thermal (58mm/80mm) & A4 PDF Invoicing',
      desc: 'Receipt auto-prints via Bluetooth LE ESC/POS or Android System Print framework. Also generates GST-compliant A4 PDF for B2B trade clients.',
    },
    {
      step: 'Step 7: Day-End Closing (Z-Report) & Midnight Rollover',
      desc: 'View Daily Sales Summary, Cash in Register, Total Profit, and Category breakdown. Auto-logout system triggers at midnight to protect session logs.',
    },
  ];

  workflowSteps.forEach((ws) => {
    ensureSpace(14);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(ws.step, margin + 4, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    const splitText = doc.splitTextToSize(ws.desc, contentWidth - 8);
    doc.text(splitText, margin + 4, y + 9);
    y += 14;
  });

  // CHAPTER 2
  ensureSpace(25);
  addSectionHeader('2. POS Billing Register & Every Button Explained', 'Detailed dictionary of all screen buttons, controls, and thermal receipt output');
  const receiptImg = generateThermalReceiptMockupImage();
  if (receiptImg) {
    ensureSpace(88);
    const imgW = 75;
    const imgH = 88;
    doc.addImage(receiptImg, 'PNG', margin + (contentWidth - imgW) / 2, y, imgW, imgH);
    y += imgH + 4;
  }

  const billingButtons = [
    {
      btn: 'Barcode Scanner (Header)',
      why: 'Instant hands-free item lookup.',
      use: 'Activates Camera scanner with Native MLKit acceleration and HTML5 fallback. Beeps on recognition and increments cart item.',
    },
    {
      btn: 'Product Search Bar',
      why: 'Find items by name, barcode, or SKU.',
      use: 'Type letters or scan barcode. Live filter updates in under 5 milliseconds across thousands of inventory items.',
    },
    {
      btn: 'Category Tabs',
      why: 'Organized touchscreen navigation.',
      use: 'Filter catalog by department (Groceries, Dairy, Beverages, Snacks, Electronics, etc.) for rapid 1-tap addition.',
    },
    {
      btn: 'Qty Adjusters & Unit Dropdown',
      why: 'Fine-grain quantity control.',
      use: 'Increase/decrease quantity. For loose items (kg, gm, ltr, mtr), tap quantity to type fractional numbers (e.g. 1.250 kg).',
    },
    {
      btn: 'Add Custom Item Button',
      why: 'Sell unlisted / misc goods without catalog setup.',
      use: 'Opens custom dialog to type a one-off item name, price, and tax % directly into the active cart.',
    },
    {
      btn: 'Hold / Suspend Cart',
      why: 'Serve the next customer while one is retrieving more items.',
      use: 'Freezes current cart into temporary memory and clears stage. Click "Recall Cart" at any time to resume billing without data loss.',
    },
    {
      btn: 'Discount Button (% or Flat Rs.)',
      why: 'Apply promotional offers or customer courtesy cuts.',
      use: 'Toggle between Percentage discount (e.g. 10%) or Flat value (e.g. Rs.50). Automatically recalculates taxable base and GST.',
    },
    {
      btn: 'Tag Customer Button',
      why: 'Link invoice to client phone and credit ledger.',
      use: 'Select existing client or type new phone/name. Required for Credit (Udhaar) billing and personalized WhatsApp receipts.',
    },
    {
      btn: 'Pay Cash Button',
      why: 'Fast cash counter settlements.',
      use: 'Enter cash received (e.g. Rs.500 for a Rs.340 bill). System immediately computes change to return: Rs.160.',
    },
    {
      btn: 'UPI Bharat QR Button',
      why: 'Instant scan-and-pay digital settlement.',
      use: 'Generates dynamic Bharat QR code with the exact bill amount and merchant VPA for instant customer GPay/PhonePe scan.',
    },
    {
      btn: 'Card / POS Swipe Button',
      why: 'Credit/Debit card machine reconciliation.',
      use: 'Tags sale as Card payment and records card reference for end-of-day bank settlement reconciliation.',
    },
    {
      btn: 'Customer Credit (Udhaar)',
      why: 'B2B and neighborhood credit trust accounts.',
      use: 'Debits customer ledger with invoice amount. Auto-updates pending balance without requiring upfront cash.',
    },
    {
      btn: 'Thermal Print & PDF Buttons',
      why: 'Provide physical or digital proof of purchase.',
      use: 'Sends ESC/POS commands to paired 58mm/80mm Bluetooth printer or renders standard A4 tax invoice.',
    },
  ];

  billingButtons.forEach((b) => {
    ensureSpace(16);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(b.btn, margin + 4, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(`Why added: `, margin + 4, y + 8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(b.why, margin + 20, y + 8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(`How used: `, margin + 4, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    const splitUse = doc.splitTextToSize(b.use, contentWidth - 26);
    doc.text(splitUse, margin + 20, y + 12);
    y += 16;
  });

  // CHAPTER 3
  ensureSpace(30);
  addSectionHeader('3. New Product / Stock Inward Form & The 4 Core Fields Explained', 'Why each field is present, what is the exact usage, and how pricing mathematics work');
  addCalloutBox(
    'Why Product Fields Are Crucial for Retail Operation',
    'A product master tracks accounting cost (Buy Price), legal limits (MRP), retail competitive pricing (Selling Price), inventory stock balances, tax compliance (HSN/GST), and shelf expiry controls.',
    accentColor
  );

  const prodFieldsImg = generateProductFieldsDiagramImage();
  if (prodFieldsImg) {
    ensureSpace(58);
    doc.addImage(prodFieldsImg, 'PNG', margin, y, contentWidth, 54);
    y += 58;
  }

  // CHAPTER 4
  ensureSpace(30);
  addSectionHeader('4. Commercial Documents & Invoicing Management Module', 'Complete reference for Quotations, Purchase Orders, Delivery Challans, Credit Notes, and E-Way Bills');
  addCalloutBox(
    'Purpose of the Documents Module in ShopPOS Pro',
    'Provides end-to-end B2B and retail documentation to manage every commercial transaction beyond simple retail receipts.',
    primaryColor
  );

  const docsImg = generateDocumentsLifecycleImage();
  if (docsImg) {
    ensureSpace(54);
    doc.addImage(docsImg, 'PNG', margin, y, contentWidth, 50);
    y += 54;
  }

  // CHAPTER 5
  ensureSpace(30);
  addSectionHeader('5. GST & Tax Calculation Engine', 'Mathematical formulas, tax breakdown rules, and compliance workflows');
  const gstImg = generateGstComparisonImage();
  if (gstImg) {
    ensureSpace(66);
    doc.addImage(gstImg, 'PNG', margin, y, contentWidth, 62);
    y += 66;
  }

  // CHAPTER 6
  ensureSpace(25);
  addSectionHeader('6. Inventory, Barcoding & AI Predictive Stock Control', 'Product catalog management, batch expiry tracking, and velocity forecasting');
  const barcodeImg = generateBarcodeStickerImage();
  if (barcodeImg) {
    ensureSpace(54);
    doc.addImage(barcodeImg, 'PNG', margin, y, contentWidth, 48);
    y += 52;
  }

  // CHAPTER 9
  ensureSpace(25);
  addSectionHeader('9. Staff Management & Cashier Access Control', 'Multi-operator shift logging, cash register accountability, and security PIN locks');
  const roleImg = generateStaffRoleMatrixImage();
  if (roleImg) {
    ensureSpace(58);
    doc.addImage(roleImg, 'PNG', margin, y, contentWidth, 52);
    y += 56;
  }

  // CHAPTER 10
  ensureSpace(25);
  addSectionHeader('10. Hardware Integration & Peripherals Guide', 'Connecting thermal Bluetooth printers, barcode scanners, and native print frameworks');
  const hardwareImg = generateHardwareDiagramImage();
  if (hardwareImg) {
    ensureSpace(44);
    doc.addImage(hardwareImg, 'PNG', margin, y, contentWidth, 38);
    y += 42;
  }

  addFooter();
  const base64 = doc.output('datauristring');
  const filename = 'ShopPOS_Pro_User_Guide.pdf';
  return { doc, base64, filename };
}
