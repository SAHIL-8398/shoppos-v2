/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Printer, Download, Share2, Bluetooth, FileText, CheckCircle2, MessageSquare } from 'lucide-react';
import { Sale, Settings } from '../types';
import { BillFormatKey, BILL_FORMATS } from '../constants/billFormats';
import { generateThermalReceiptText, formatCurrency, formatDate } from '../utils';
import { printThermalReceipt, printPdfDocument, sharePdfDocument } from '../services/printService';
import { generateInvoicePdfDoc } from '../services/invoicePdfService';
import { bluetoothPrinterService } from '../services/bluetoothPrinterService';
import { useDialog } from '../context/DialogContext';
import { sendWhatsAppMessage } from '../services/whatsappService';

interface ReceiptModalProps {
  sale: Sale | null;
  settings: Settings;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, isOpen, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<BillFormatKey>(settings.billFormat || 'regular');
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(settings.preferredReceiptPaperSize || '58mm');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
  const { alert, toast } = useDialog();

  if (!isOpen || !sale) return null;

  const cur = settings.currency || '₹';
  const receiptText = generateThermalReceiptText(sale, settings, paperSize === '58mm');

  const handlePrintThermal = async () => {
    try {
      setIsPrinting(true);
      const res = await printThermalReceipt({
        sale,
        settings,
        paperSize,
      });
      if (res.success) {
        toast('Receipt sent to printer', 'success');
      } else {
        alert(res.error || 'Failed to trigger printer dialog.', 'Print Error');
      }
    } catch (e: any) {
      alert(e?.message || 'Print failure', 'Print Error');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBluetoothPrint = async () => {
    try {
      setIsBluetoothConnecting(true);
      if (!bluetoothPrinterService.isConnected()) {
        const connected = await bluetoothPrinterService.requestAndConnect();
        if (!connected) {
          toast('Bluetooth printer not connected', 'error');
          return;
        }
      }
      const success = await bluetoothPrinterService.printReceipt({
        sale,
        settings,
        paperWidth: paperSize,
      });
      if (success) {
        toast('Printed successfully via Bluetooth ESC/POS', 'success');
      } else {
        toast('Bluetooth print command failed', 'error');
      }
    } catch (e: any) {
      alert(e?.message || 'Bluetooth connection failed', 'Bluetooth Error');
    } finally {
      setIsBluetoothConnecting(false);
    }
  };

  const handlePrintA4Pdf = async () => {
    try {
      setIsPrinting(true);
      const doc = await generateInvoicePdfDoc(sale, settings, selectedFormat, receiptText);
      const base64 = doc.output('datauristring');
      const filename = `Invoice_${sale.billNo}.pdf`;
      const res = await printPdfDocument(base64, filename);
      if (res.success) {
        toast('Invoice sent to system print dialog', 'success');
      } else {
        alert(res.error || 'Failed to print PDF', 'PDF Print Error');
      }
    } catch (e: any) {
      alert(e?.message || 'PDF print failed', 'Error');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const doc = await generateInvoicePdfDoc(sale, settings, selectedFormat, receiptText);
      doc.save(`Invoice_${sale.billNo}.pdf`);
      toast('Invoice PDF downloaded', 'success');
    } catch (e: any) {
      alert(e?.message || 'Could not generate PDF file', 'Download Error');
    }
  };

  const handleShareWhatsApp = () => {
    const phone = (sale.customerPhone || '').replace(/\D/g, '');
    const itemsSummary = sale.items.map((i) => `• ${i.name} (x${i.qty}) - ${cur}${formatCurrency(i.price * i.qty)}`).join('\n');
    const text = `*Invoice #${sale.billNo} - ${settings.shopName || 'Retail Store'}*\nDate: ${formatDate(sale.date)} ${sale.time || ''}\nCustomer: ${sale.customer || 'Valued Customer'}\n\n*Items:*\n${itemsSummary}\n\n*Total Amount: ${cur}${formatCurrency(sale.total)}*\nPayment: ${sale.paymentMethod.toUpperCase()}\n\nThank you for shopping with us!`;

    sendWhatsAppMessage({
      phone,
      text,
      title: `Invoice #${sale.billNo} - ${settings.shopName || 'Retail Store'}`,
    });
  };

  const handleShareNative = async () => {
    try {
      const doc = await generateInvoicePdfDoc(sale, settings, selectedFormat, receiptText);
      const base64 = doc.output('datauristring');
      const res = await sharePdfDocument({
        pdfBase64: base64,
        filename: `Invoice_${sale.billNo}.pdf`,
        title: `Invoice #${sale.billNo}`,
        text: `Tax Invoice #${sale.billNo} from ${settings.shopName || 'Shop'} for ${cur}${formatCurrency(sale.total)}`,
      });
      if (res.success) {
        toast('Invoice shared', 'success');
      }
    } catch (e: any) {
      alert(e?.message || 'Could not share document', 'Share Error');
    }
  };

  return (
    <div id="receipt-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div id="receipt-modal" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center font-black border border-emerald-200 dark:border-emerald-500/20">
              #{sale.billNo}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Receipt &amp; Tax Invoice</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-extrabold uppercase">
                  {sale.paymentMethod}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(sale.date)} • {sale.time || ''} • Customer: {sale.customer || 'Walk-in'}
              </p>
            </div>
          </div>
          <button
            id="close-receipt-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Invoice Style:</span>
            <div className="flex rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
              {BILL_FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    selectedFormat === f.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thermal Roll:</span>
            <div className="flex rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
              {(['58mm', '80mm'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setPaperSize(sz)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    paperSize === sz
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          {selectedFormat === 'thermal' ? (
            <div className="bg-white text-black p-5 font-mono text-xs shadow-md rounded-2xl w-full max-w-[360px] border border-slate-300 whitespace-pre-wrap leading-relaxed">
              {(settings.shopLogo || settings.logo) && (
                <div className="text-center mb-3">
                  <img
                    src={settings.shopLogo || settings.logo}
                    alt={settings.shopName || 'Store Logo'}
                    className="w-16 h-16 object-contain mx-auto rounded-lg"
                  />
                </div>
              )}
              {receiptText}
              {settings.upi && (
                <div className="mt-4 pt-3 border-t border-dashed border-black text-center">
                  <p className="text-[10px] font-bold">UPI PAYMENT QR</p>
                  <div className="w-24 h-24 mx-auto my-2 border border-black p-1 flex items-center justify-center text-[9px] text-gray-500">
                    [Bharat QR]
                  </div>
                  <p className="text-[9px]">VPA: {settings.upi}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white text-slate-800 p-6 sm:p-8 rounded-2xl shadow-md w-full max-w-2xl border border-slate-200">
              {/* Vyapar / Commercial A4 preview */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div className="flex items-start gap-3.5">
                  {(settings.shopLogo || settings.logo) && (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-slate-200 p-1 bg-white flex items-center justify-center shrink-0 shadow-sm">
                      <img
                        src={settings.shopLogo || settings.logo}
                        alt={settings.shopName || 'Store Logo'}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{settings.shopName || 'ShopPOS Store'}</h2>
                    {settings.address && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{settings.address}</p>}
                    {settings.phone && <p className="text-xs text-slate-500">Phone: {settings.phone}</p>}
                    {settings.gstin && <p className="text-xs font-semibold text-slate-600">GSTIN: {settings.gstin}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2.5 py-1 rounded font-bold uppercase bg-blue-50 text-blue-700">
                    Tax Invoice
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-2">#{sale.billNo}</p>
                  <p className="text-xs text-slate-500">{formatDate(sale.date)}</p>
                </div>
              </div>

              {/* Customer & Payment row */}
              <div className="grid grid-cols-2 gap-4 my-4 py-3 bg-slate-50 rounded-xl px-4 text-xs">
                <div>
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Billed To</p>
                  <p className="font-bold text-slate-800 text-sm">{sale.customer || 'Walk-In Customer'}</p>
                  {sale.customerPhone && <p className="text-slate-600">Mobile: {sale.customerPhone}</p>}
                  {sale.customerAddress && <p className="text-slate-600">{sale.customerAddress}</p>}
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Payment Summary</p>
                  <p className="font-bold text-slate-800 uppercase">{sale.paymentMethod}</p>
                  <p className="text-slate-600">Items: {sale.items.length}</p>
                  <p className="text-slate-600">Cashier: {sale.staffName || 'Operator'}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs my-4 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-600 uppercase text-[10px]">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((item, i) => (
                    <tr key={item.id || item.productId || `${item.name}_${i}`} className="text-slate-700">
                      <td className="py-2.5 font-medium">{item.name}</td>
                      <td className="py-2.5 text-right text-slate-600">{cur}{formatCurrency(item.price)}</td>
                      <td className="py-2.5 text-right">{item.qty} {item.unit || 'pcs'}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{cur}{formatCurrency(item.qty * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Calculation */}
              <div className="border-t border-slate-200 pt-4 flex justify-end text-xs">
                <div className="w-56 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{cur}{formatCurrency(sale.subtotal)}</span>
                  </div>
                  {sale.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount:</span>
                      <span>-{cur}{formatCurrency(sale.discount)}</span>
                    </div>
                  )}
                  {sale.gst > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST ({sale.gstPct}%):</span>
                      <span>{cur}{formatCurrency(sale.gst)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span>{cur}{formatCurrency(sale.total)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <p>{settings.footer || 'Thank you for shopping with us!'}</p>
                <p className="font-semibold">ShopPOS Verified Invoice</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              id="print-thermal-btn"
              onClick={handlePrintThermal}
              disabled={isPrinting}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl shadow-md transition-colors"
            >
              <Printer size={16} />
              <span>Print Thermal ({paperSize})</span>
            </button>

            <button
              id="print-bt-btn"
              onClick={handleBluetoothPrint}
              disabled={isBluetoothConnecting}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-xs font-bold rounded-2xl transition-colors shadow-sm"
              title="Print via Bluetooth LE Thermal ESC/POS"
            >
              <Bluetooth size={16} />
              <span>{isBluetoothConnecting ? 'Connecting...' : 'Bluetooth'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="print-a4-btn"
              onClick={handlePrintA4Pdf}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <FileText size={15} />
              <span>Print A4</span>
            </button>

            <button
              id="download-pdf-btn"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <Download size={15} />
              <span>Download</span>
            </button>

            <button
              id="whatsapp-share-btn"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <MessageSquare size={15} />
              <span>WhatsApp</span>
            </button>

            <button
              id="share-native-btn"
              onClick={handleShareNative}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
