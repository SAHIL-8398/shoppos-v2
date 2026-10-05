/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import { Share } from '@capacitor/share';
import { savePdfToAppFolder } from './nativeStorage';
import { Sale, Settings } from '../types';
import { formatCurrency, formatDate } from '../utils';

export interface PrintPdfOptions {
  name?: string;
  landscape?: boolean;
}

export interface ThermalPrintOptions {
  sale: Sale;
  settings: Settings;
  paperSize?: '58mm' | '80mm';
  barcodeDataUrl?: string;
  upiQrDataUrl?: string;
  billQrDataUrl?: string;
}

/**
 * Generate high-contrast, pure black & white thermal receipt HTML formatted
 * strictly for standard 58mm (2-inch roll) or 80mm (3-inch roll) thermal printers.
 */
export function formatThermalReceiptHtml(options: ThermalPrintOptions): string {
  const { sale, settings, paperSize = settings.preferredReceiptPaperSize || '58mm', barcodeDataUrl, upiQrDataUrl, billQrDataUrl } = options;
  const is58mm = paperSize === '58mm';
  const cur = settings.currency || 'Rs.';

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Build items rows
  const itemsHtml = sale.items.map((item, idx) => {
    const itemTotal = item.price * item.qty;
    return `
      <tr>
        <td colspan="3" style="padding-top: 3px; font-weight: bold; word-break: break-word;">
          ${idx + 1}. ${escapeHtml(item.name)}
        </td>
      </tr>
      <tr style="border-bottom: 1px dotted #888;">
        <td style="padding-left: 8px; color: #333; font-size: ${is58mm ? '9.5px' : '10.5px'};">
          ${item.qty} ${escapeHtml(item.unit || 'Pcs')} x ${cur}${formatCurrency(item.price)}
        </td>
        <td style="text-align: right; font-weight: bold; font-size: ${is58mm ? '10px' : '11px'};" colspan="2">
          ${cur}${formatCurrency(itemTotal)}
        </td>
      </tr>
    `;
  }).join('');

  // Payment method string
  let paymentText = (sale.paymentMethod || 'cash').toUpperCase();
  if (sale.paymentMethod === 'credit') paymentText += ' (CREDIT)';
  if (sale.paymentMethod === 'split') {
    const split = sale.splitDetails || { cashAmount: 0, upiAmount: 0 };
    paymentText = `SPLIT (Cash: ${cur}${split.cashAmount} / UPI: ${cur}${split.upiAmount})`;
  }

  // Barcode & QR URLs
  const barcodeSrc = barcodeDataUrl || '';
  const upiQrSrc = upiQrDataUrl || (settings.upi && settings.showUpiQrOnBill !== false
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${settings.upi}&pn=${encodeURIComponent(settings.shopName || 'Shop')}&am=${sale.total}&cu=INR`)}`
    : '');
  const billQrSrc = billQrDataUrl || (settings.showBarcodeOnBill !== false
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(String(sale.billNo))}`
    : '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Receipt #${sale.billNo} - ${escapeHtml(settings.shopName || 'POS')}</title>
  <style>
    @page {
      size: ${is58mm ? '58mm auto' : '80mm auto'};
      margin: 0mm !important;
    }
    @media print {
      html, body {
        width: ${is58mm ? '58mm' : '80mm'} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${is58mm ? '10.5px' : '11.5px'};
      line-height: 1.25;
      width: ${is58mm ? '58mm' : '80mm'};
      -webkit-font-smoothing: antialiased;
    }
    .receipt-container {
      width: 100%;
      max-width: ${is58mm ? '48mm' : '72mm'};
      margin: 0 auto;
      padding: ${is58mm ? '3mm 1mm 5mm 1mm' : '4mm 2mm 6mm 2mm'};
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    
    .shop-name {
      font-size: ${is58mm ? '13px' : '15px'};
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 2px;
      line-height: 1.2;
      word-break: break-word;
    }
    .shop-meta {
      font-size: ${is58mm ? '9px' : '10px'};
      line-height: 1.2;
      margin: 1px 0;
      word-break: break-word;
    }
    .divider {
      border: none;
      border-top: 1px dashed #000000;
      margin: 4px 0;
      height: 0;
    }
    .double-divider {
      border: none;
      border-top: 1px solid #000000;
      border-bottom: 1px solid #000000;
      height: 2px;
      margin: 4px 0;
    }
    .bill-meta-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '9.5px' : '10.5px'};
      margin: 1px 0;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 3px 0;
      font-size: ${is58mm ? '10px' : '11px'};
    }
    .calc-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '10px' : '11px'};
      margin: 1.5px 0;
    }
    .grand-total-box {
      font-size: ${is58mm ? '13px' : '15px'};
      font-weight: 900;
      margin: 4px 0;
      padding: 3px 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .barcode-wrapper {
      text-align: center;
      margin: 6px 0 2px 0;
    }
    .barcode-img {
      max-width: ${is58mm ? '44mm' : '62mm'};
      height: auto;
      display: block;
      margin: 0 auto;
      image-rendering: pixelated;
    }
    .qr-wrapper {
      text-align: center;
      margin: 5px 0 2px 0;
    }
    .qr-img {
      width: ${is58mm ? '28mm' : '34mm'};
      height: ${is58mm ? '28mm' : '34mm'};
      display: block;
      margin: 0 auto;
      image-rendering: pixelated;
    }
    .footer-section {
      font-size: ${is58mm ? '8.5px' : '9.5px'};
      text-align: center;
      margin-top: 5px;
      line-height: 1.25;
      word-break: break-word;
    }
    .cut-spacing {
      height: 6mm;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- SHOP HEADER -->
    <div class="text-center">
      ${(settings.shopLogo || settings.logo) ? `
        <div style="text-align: center; margin-bottom: 5px;">
          <img src="${settings.shopLogo || settings.logo}" style="max-height: ${is58mm ? '18mm' : '22mm'}; max-width: ${is58mm ? '38mm' : '50mm'}; object-fit: contain; display: block; margin: 0 auto;" alt="Shop Logo" />
        </div>
      ` : ''}
      ${settings.showShopNameOnBill !== false && settings.shopName ? `<div class="shop-name">${escapeHtml(settings.shopName)}</div>` : ''}
      ${settings.showAddressOnBill !== false && settings.address ? `<div class="shop-meta">${escapeHtml(settings.address).replace(/\n/g, '<br/>')}</div>` : ''}
      ${settings.showPhoneOnBill !== false && settings.phone ? `<div class="shop-meta">Ph: ${escapeHtml(settings.phone)}</div>` : ''}
      ${settings.showGstinOnBill !== false && settings.gstin ? `<div class="shop-meta">GSTIN: ${escapeHtml(settings.gstin)}</div>` : ''}
      ${settings.showFssaiOnBill !== false && settings.fssai ? `<div class="shop-meta">FSSAI Lic: ${escapeHtml(settings.fssai)}</div>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <!-- BILL INFO -->
    <div class="text-center bold uppercase" style="font-size: ${is58mm ? '11px' : '12px'};">
      TAX INVOICE / RECEIPT
    </div>
    
    <div class="bill-meta-row bold">
      <span>BILL NO: #${sale.billNo}</span>
      <span>${sale.time || ''}</span>
    </div>
    ${settings.showDateOnBill !== false ? `
      <div class="bill-meta-row">
        <span>DATE: ${formatDate(sale.date)}</span>
        <span>MODE: ${escapeHtml(sale.paymentMethod || 'CASH').toUpperCase()}</span>
      </div>
    ` : ''}
    ${settings.showCustomerOnBill !== false && sale.customer ? `
      <div class="divider"></div>
      <div class="shop-meta"><strong>Customer:</strong> ${escapeHtml(sale.customer)}</div>
      ${sale.customerPhone ? `<div class="shop-meta"><strong>Mobile:</strong> ${escapeHtml(sale.customerPhone)}</div>` : ''}
      ${sale.customerAddress ? `<div class="shop-meta"><strong>Address:</strong> ${escapeHtml(sale.customerAddress)}</div>` : ''}
    ` : ''}
    ${settings.showStaffOnBill !== false && sale.staffName ? `
      <div class="shop-meta"><strong>Cashier/Staff:</strong> ${escapeHtml(sale.staffName)}</div>
    ` : ''}
    
    <div class="divider"></div>
    
    <!-- ITEMS TABLE -->
    <table class="items-table">
      <thead>
        <tr style="border-bottom: 1px dashed #000; text-transform: uppercase;">
          <th class="text-left" style="padding-bottom: 2px;">Item &amp; Rate</th>
          <th class="text-right" style="padding-bottom: 2px;" colspan="2">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    <!-- FINANCIALS -->
    <div class="calc-row">
      <span>Subtotal (${sale.items.reduce((s, i) => s + i.qty, 0)} items):</span>
      <span class="bold">${cur}${formatCurrency(sale.subtotal)}</span>
    </div>
    ${sale.discount > 0 ? `
      <div class="calc-row">
        <span>Discount:</span>
        <span class="bold">-${cur}${formatCurrency(sale.discount)}</span>
      </div>
    ` : ''}
    ${sale.gst > 0 ? `
      <div class="calc-row">
        <span>GST (${sale.gstPct || 0}%):</span>
        <span class="bold">${cur}${formatCurrency(sale.gst)}</span>
      </div>
    ` : ''}
    
    <!-- GRAND TOTAL -->
    <div class="grand-total-box">
      <span>TOTAL:</span>
      <span>${cur}${formatCurrency(sale.total)}</span>
    </div>
    
    <div class="calc-row" style="font-size: ${is58mm ? '9px' : '10px'};">
      <span>Payment Details:</span>
      <span class="bold uppercase">${escapeHtml(paymentText)}</span>
    </div>
    
    <div class="divider"></div>
    
    <!-- BARCODE FOR RETURN / CHECKOUT -->
    ${settings.showBarcodeOnBill !== false && barcodeSrc ? `
      <div class="barcode-wrapper">
        <div class="shop-meta uppercase bold" style="font-size: 8.5px; margin-bottom: 2px;">Transaction Barcode</div>
        <img src="${barcodeSrc}" alt="Barcode #${sale.billNo}" class="barcode-img" />
        <div class="shop-meta bold" style="font-size: 8.5px; margin-top: 1px;">#${sale.billNo}</div>
      </div>
    ` : ''}
    
    <!-- UPI PAYMENT QR (IF ENABLED & CONFIGURED) -->
    ${settings.showUpiQrOnBill !== false && upiQrSrc ? `
      <div class="qr-wrapper">
        <div class="shop-meta bold uppercase" style="font-size: 8.5px; margin-bottom: 2px;">Scan to Pay via UPI</div>
        <img src="${upiQrSrc}" alt="UPI QR" class="qr-img" />
        <div class="shop-meta" style="font-size: 8px;">VPA: ${escapeHtml(settings.upi || settings.upiId || '')}</div>
      </div>
    ` : ''}
    
    <!-- FOOTER GREETING -->
    ${settings.showFooterOnBill !== false && settings.footer ? `
      <div class="footer-section">
        ${escapeHtml(settings.footer).replace(/\n/g, '<br/>')}
      </div>
    ` : `
      <div class="footer-section bold">
        *** THANK YOU! VISIT AGAIN ***
      </div>
    `}
    
    <!-- TERMS & CONDITIONS -->
    ${settings.showTermsOnBill === true && settings.termsTextOnBill ? `
      <div class="footer-section" style="border-top: 1px dotted #888; padding-top: 3px; margin-top: 4px; font-size: 8px;">
        <div class="bold uppercase">Terms &amp; Conditions</div>
        <div>${escapeHtml(settings.termsTextOnBill).replace(/\n/g, '<br/>')}</div>
      </div>
    ` : ''}
    
    <!-- FEED SPACING FOR THERMAL CUTTER -->
    <div class="cut-spacing"></div>
  </div>
</body>
</html>`;
}

/**
 * Formats the current receipt view and triggers the browser or system print dialog
 */
export async function printThermalReceipt(
  options: ThermalPrintOptions
): Promise<{ success: boolean; error?: string }> {
  const { sale, settings, paperSize = settings.preferredReceiptPaperSize || '58mm' } = options;
  const is58mm = paperSize === '58mm';

  const htmlContent = formatThermalReceiptHtml({
    ...options,
    paperSize,
  });

  if (Capacitor.isNativePlatform()) {
    try {
      await Printer.printHtml({
        html: htmlContent,
        name: `Receipt #${sale.billNo} (${paperSize})`,
      });
      return { success: true };
    } catch (nativeErr: any) {
      console.warn('[Printer] Native printHtml failed, falling back to iframe print:', nativeErr);
    }
  }

  try {
    return new Promise((resolve) => {
      const existing = document.getElementById('thermal-print-iframe');
      if (existing) {
        try { document.body.removeChild(existing); } catch (_) {}
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = is58mm ? '58mm' : '80mm';
      iframe.style.height = '100px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        resolve({ success: false, error: 'Could not access printer iframe document.' });
        return;
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve({ success: true });
        } catch (e: any) {
          console.warn('[ThermalPrint] Print dialog trigger error:', e);
          resolve({ success: false, error: e?.message || 'Print dialog failed to open.' });
        } finally {
          setTimeout(() => {
            try {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            } catch (_) {}
          }, 60000);
        }
      };

      const images = iframeDoc.getElementsByTagName('img');
      if (images.length === 0) {
        setTimeout(triggerPrint, 150);
      } else {
        let loadedCount = 0;
        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount >= images.length) {
            setTimeout(triggerPrint, 100);
          }
        };
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (img.complete) {
            checkAllLoaded();
          } else {
            img.onload = checkAllLoaded;
            img.onerror = checkAllLoaded;
          }
        }
        setTimeout(triggerPrint, 1200);
      }
    });
  } catch (webErr: any) {
    return { success: false, error: webErr?.message || 'Browser print failed' };
  }
}

/**
 * Send a PDF base64 string directly to print framework
 */
export async function printPdfDocument(
  pdfBase64: string,
  filename: string = 'Invoice.pdf',
  options?: PrintPdfOptions
): Promise<{ success: boolean; error?: string }> {
  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  if (Capacitor.isNativePlatform()) {
    try {
      const saveRes = await savePdfToAppFolder(cleanBase64, filename, 'Invoices');
      if (saveRes.uri || saveRes.path) {
        await Printer.printPdf({
          path: (saveRes.uri || saveRes.path) as string,
          name: options?.name || filename,
        });
      } else {
        await Printer.printBase64({
          data: cleanBase64,
          name: options?.name || filename,
          mimeType: 'application/pdf',
        });
      }
      return { success: true };
    } catch (err: any) {
      console.warn('[Printer] Native PDF print failed, attempting base64 fallback:', err);
      try {
        await Printer.printBase64({
          data: cleanBase64,
          name: options?.name || filename,
          mimeType: 'application/pdf',
        });
        return { success: true };
      } catch (innerErr: any) {
        return {
          success: false,
          error: innerErr?.message || err?.message || 'Print job failed',
        };
      }
    }
  }

  try {
    const blob = base64ToBlob(cleanBase64, 'application/pdf');
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error:', e);
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 60000);
      }, 500);
    };
    return { success: true };
  } catch (webErr: any) {
    return { success: false, error: webErr?.message || 'Browser print failed' };
  }
}

/**
 * Native file and document sharing with WhatsApp and Android share sheet.
 */
export async function sharePdfDocument(params: {
  pdfBase64: string;
  filename: string;
  title: string;
  text?: string;
  subfolder?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { pdfBase64, filename, title, text, subfolder = 'Invoices' } = params;
  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

  if (Capacitor.isNativePlatform()) {
    try {
      const saveRes = await savePdfToAppFolder(cleanBase64, filename, subfolder);
      const fileUri = saveRes.uri;
      if (!fileUri) {
        throw new Error('Failed to resolve native storage URI for PDF.');
      }
      await Share.share({
        title,
        text: text || title,
        url: fileUri,
        dialogTitle: `Share ${filename}`,
      });
      return { success: true };
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('cancel') || err?.message?.toLowerCase().includes('dismiss')) {
        return { success: true };
      }
      console.warn('[Share] Native Capacitor share failed:', err);
      return { success: false, error: err?.message || 'Native share failed' };
    }
  }

  try {
    const blob = base64ToBlob(cleanBase64, 'application/pdf');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title,
        text: text || title,
      });
      return { success: true };
    }
    return { success: false, error: 'Web Share API not supported for files on this browser' };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { success: true };
    return { success: false, error: err?.message || 'Sharing failed' };
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays as unknown as BlobPart[], { type: mimeType });
}
