/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Printer,
  Trash2,
  Calendar,
  FileText,
  Building,
  CheckCircle,
  Clock,
  Send,
  X,
} from 'lucide-react';
import { AppDatabase, CommercialDocument, Settings } from '../types';
import { formatCurrency, formatDate, getPdfCurrency, cleanPdfText } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { printPdfDocument, sharePdfDocument } from '../services/printService';

interface DocumentsProps {
  db: AppDatabase;
  onSaveDocument: (doc: CommercialDocument) => void;
  onDeleteDocument: (docId: string) => void;
}

export const Documents: React.FC<DocumentsProps> = ({
  db,
  onSaveDocument,
  onDeleteDocument,
}) => {
  const { t } = useLocalization();
  const { alert, toast, confirm } = useDialog();

  const [selectedType, setSelectedType] = useState<'quotation' | 'purchase_order' | 'delivery_challan' | 'credit_note'>('quotation');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ id: string; name: string; qty: number; price: number }[]>([
    { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}`, name: '', qty: 1, price: 0 },
  ]);

  const cur = db.settings.currency || '₹';

  const docTypes = [
    { type: 'quotation', label: 'Estimates / Quotations' },
    { type: 'purchase_order', label: 'Purchase Orders (PO)' },
    { type: 'delivery_challan', label: 'Delivery Challans' },
    { type: 'credit_note', label: 'Credit / Debit Notes' },
  ] as const;

  const docs = (db.documents || []).filter((d) => d.type === selectedType);

  const addItemRow = () => {
    setItems([
      ...items,
      { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random()}`, name: '', qty: 1, price: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: 'name' | 'qty' | 'price', value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSaveDoc = () => {
    if (!partyName.trim()) {
      alert('Client / Party Name is required.', 'Validation Error');
      return;
    }
    const validItems = items.filter((i) => i.name.trim() && i.price > 0 && i.qty > 0);
    if (validItems.length === 0) {
      alert('Add at least one line item with valid name, quantity, and rate.', 'Validation Error');
      return;
    }

    const subtotal = validItems.reduce((acc, i) => acc + i.qty * i.price, 0);
    const docNo = `${selectedType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const newDoc: CommercialDocument = {
      id: `doc_${Date.now()}`,
      type: selectedType,
      docNumber: docNo,
      date: new Date().toISOString().split('T')[0],
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim() || undefined,
      partyGstin: partyGstin.trim() || undefined,
      items: validItems,
      subtotal,
      tax: 0,
      total: subtotal,
      notes: notes.trim() || undefined,
      status: 'pending',
    };

    onSaveDocument(newDoc);
    setIsModalOpen(false);
    setPartyName('');
    setPartyPhone('');
    setPartyGstin('');
    setNotes('');
    setItems([{ id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}`, name: '', qty: 1, price: 0 }]);
    toast('Document generated', 'success');
  };

  const handleDelete = async (doc: CommercialDocument) => {
    const ok = await confirm(`Delete document ${doc.docNumber}?`, 'Confirm Delete');
    if (ok) {
      onDeleteDocument(doc.id);
      toast('Document deleted', 'info');
    }
  };

  const buildDocumentPdf = (docData: CommercialDocument, settings: Settings): jsPDF => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfCur = getPdfCurrency(settings.currency);
    const shopName = settings.shopName || 'ShopPOS Store';

    // Primary banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 32, 'F');

    const logo = settings.shopLogo || settings.logo;
    let textX = 15;
    if (logo) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 4, 24, 24, 2, 2, 'F');
        doc.addImage(logo, 'JPEG', 14, 6, 20, 20, undefined, 'FAST');
        textX = 40;
      } catch {
        textX = 15;
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(cleanPdfText(shopName), textX, 16);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const contactText = [settings.address, settings.phone ? `Ph: ${settings.phone}` : '', settings.gstin ? `GSTIN: ${settings.gstin}` : '']
      .filter(Boolean)
      .join('  |  ');
    if (contactText) {
      const maxLen = textX > 20 ? 75 : 95;
      doc.text(cleanPdfText(contactText).slice(0, maxLen), textX, 24);
    }

    // Document Type Header
    const typeTitles: Record<string, string> = {
      quotation: 'ESTIMATE / PRICE QUOTATION',
      purchase_order: 'OFFICIAL PURCHASE ORDER',
      delivery_challan: 'DELIVERY CHALLAN / DISPATCH',
      credit_note: 'CREDIT / DEBIT ADJUSTMENT NOTE',
    };
    const title = typeTitles[docData.type] || docData.type.toUpperCase().replace('_', ' ');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, 15, 46);

    // Doc metadata box
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Doc Ref: ${docData.docNumber}`, 15, 53);
    doc.text(`Date: ${formatDate(docData.date)}`, 15, 58);
    doc.text(`Status: ${docData.status.toUpperCase()}`, 15, 63);

    // Party Details Box
    doc.setFillColor(248, 250, 252);
    doc.rect(115, 38, 80, 28, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(115, 38, 80, 28, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('PARTY / CLIENT DETAILS:', 119, 44);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(cleanPdfText(docData.partyName).slice(0, 32), 119, 50);
    if (docData.partyPhone) doc.text(`Ph: ${cleanPdfText(docData.partyPhone)}`, 119, 55);
    if (docData.partyGstin) doc.text(`GSTIN: ${cleanPdfText(docData.partyGstin)}`, 119, 60);

    // Items Table Header
    let y = 74;
    doc.setFillColor(30, 41, 59);
    doc.rect(15, y, 180, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('#', 18, y + 5);
    doc.text('ITEM DESCRIPTION', 28, y + 5);
    doc.text('QTY', 125, y + 5, { align: 'center' });
    doc.text('RATE', 155, y + 5, { align: 'right' });
    doc.text('AMOUNT', 190, y + 5, { align: 'right' });

    // Items rows
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    (docData.items || []).forEach((item, idx) => {
      y += 7.5;
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y, 195, y);

      const lineTotal = item.qty * item.price;
      doc.text(`${idx + 1}`, 18, y + 5);
      doc.text(cleanPdfText(item.name).slice(0, 45), 28, y + 5);
      doc.text(`${item.qty} ${item.unit || ''}`, 125, y + 5, { align: 'center' });
      doc.text(`${pdfCur}${formatCurrency(item.price)}`, 155, y + 5, { align: 'right' });
      doc.text(`${pdfCur}${formatCurrency(lineTotal)}`, 190, y + 5, { align: 'right' });
    });

    // Financial summary
    y += 10;
    doc.setDrawColor(15, 23, 42);
    doc.line(15, y, 195, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL AMOUNT:', 140, y);
    doc.text(`${pdfCur}${formatCurrency(docData.total)}`, 190, y, { align: 'right' });

    // Notes & Sign
    y += 14;
    if (y > 245) {
      doc.addPage();
      y = 20;
    }
    if (docData.notes) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text('Remarks / Terms:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(cleanPdfText(docData.notes).slice(0, 110), 15, y + 5);
      y += 12;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(140, y + 15, 195, y + 15);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signature', 150, y + 20);

    return doc;
  };

  const handlePrintDocument = async (doc: CommercialDocument) => {
    try {
      const pdfDoc = buildDocumentPdf(doc, db.settings);
      const base64 = pdfDoc.output('datauristring');
      const filename = `${doc.type}_${doc.docNumber}.pdf`;
      const res = await printPdfDocument(base64, filename, { name: doc.docNumber });
      if (!res.success) {
        await sharePdfDocument({
          pdfBase64: base64,
          filename,
          title: `${doc.docNumber} - ${doc.partyName}`,
          subfolder: 'Documents',
        });
      }
    } catch (err: any) {
      console.error('Document print error:', err);
      toast('Printing failed: ' + (err?.message || ''), 'error');
    }
  };

  return (
    <div id="documents-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Commercial Invoicing &amp; Estimates</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              {docs.length} Documents
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Generate formal B2B estimates, Purchase Orders, Delivery Challans, and Credit/Debit Notes
          </p>
        </div>

        <button
          id="create-doc-btn"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95"
        >
          <Plus size={16} />
          <span>+ New Document</span>
        </button>
      </div>

      {/* Document Types Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {docTypes.map((dt) => (
          <button
            key={dt.type}
            onClick={() => setSelectedType(dt.type)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shadow-sm ${
              selectedType === dt.type
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900'
            }`}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Doc #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Party / Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No documents created in this category yet
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {d.docNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {formatDate(d.date)}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{d.partyName}</p>
                        {d.partyPhone && <p className="text-[10px] text-slate-400 font-mono">{d.partyPhone}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {d.items.length} line items
                    </td>
                    <td className="py-3 px-4 font-black text-sm text-emerald-600 dark:text-emerald-400">
                      {cur}{formatCurrency(d.total)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handlePrintDocument(d)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Print Document"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-blue-600 dark:text-indigo-400" />
                Generate New Document
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Party / Client Name *</label>
                  <input
                    type="text"
                    placeholder="Company or client name"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Party GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="27ABCDE1234F1Z5"
                  value={partyGstin}
                  onChange={(e) => setPartyGstin(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase"
                />
              </div>

              {/* Line Items */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Line Items &amp; Rates</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Add Item Row
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.id || `doc_row_${idx}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Item name / description"
                        value={it.name}
                        onChange={(e) => updateItemRow(idx, 'name', e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={it.qty}
                        onChange={(e) => updateItemRow(idx, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1.5 text-slate-900 dark:text-white text-center font-bold"
                      />
                      <input
                        type="number"
                        placeholder="Rate"
                        value={it.price}
                        onChange={(e) => updateItemRow(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1.5 text-slate-900 dark:text-white text-right font-bold"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Terms / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Valid for 15 days, 50% advance on PO confirmation"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDoc}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
