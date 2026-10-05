/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, BookOpen, Download, Printer, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { Settings } from '../types';
import { generateAppGuidePdf } from '../services/appGuidePdfService';
import { printPdfDocument } from '../services/printService';
import { useDialog } from '../context/DialogContext';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose, settings }) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'workflow' | 'pricing' | 'hardware'>('quick');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast, alert } = useDialog();

  if (!isOpen) return null;

  const handleDownloadPdfGuide = async () => {
    try {
      setIsGeneratingPdf(true);
      const { doc, filename } = generateAppGuidePdf(settings);
      doc.save(filename);
      toast('Operational Manual PDF downloaded successfully', 'success');
    } catch (e: any) {
      alert('Failed to generate manual PDF: ' + e?.message, 'Error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdfGuide = async () => {
    try {
      setIsGeneratingPdf(true);
      const { base64, filename } = generateAppGuidePdf(settings);
      const res = await printPdfDocument(base64, filename);
      if (res.success) {
        toast('Sent manual to print spooler', 'success');
      } else {
        alert(res.error || 'Failed to print guide', 'Print Error');
      }
    } catch (e: any) {
      alert('Print error: ' + e?.message, 'Error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div id="manual-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div id="manual-modal" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 dark:bg-indigo-600/20 dark:text-indigo-400 rounded-2xl">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">ShopPOS Pro - User Manual &amp; Operational Guide</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Complete reference for retail billing, stock tracking &amp; hardware</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="download-manual-pdf-btn"
              onClick={handleDownloadPdfGuide}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <Download size={14} />
              <span>{isGeneratingPdf ? 'Exporting...' : 'Download Full PDF'}</span>
            </button>
            <button
              id="print-manual-btn"
              onClick={handlePrintPdfGuide}
              disabled={isGeneratingPdf}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Print Manual"
            >
              <Printer size={18} />
            </button>
            <button
              id="close-manual-btn"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 px-6 gap-2 text-xs font-bold">
          {[
            { id: 'quick', label: '1. Quick POS Billing' },
            { id: 'workflow', label: '2. Inventory & Stock' },
            { id: 'pricing', label: '3. GST & Pricing Math' },
            { id: 'hardware', label: '4. Thermal Printing & QR' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {activeTab === 'quick' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick 3-Step Cashier Checkout Workflow</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    1
                  </span>
                  <h5 className="font-bold text-slate-900 dark:text-white">Scan or Click Product</h5>
                  <p className="text-slate-500 dark:text-slate-400">
                    Use physical USB laser scanner, built-in camera scanner, or click catalog cards.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    2
                  </span>
                  <h5 className="font-bold text-slate-900 dark:text-white">Select Payment Mode</h5>
                  <p className="text-slate-500 dark:text-slate-400">
                    Choose Cash, UPI QR code, Card, Split, or Credit (Khata Udhaar).
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    3
                  </span>
                  <h5 className="font-bold text-slate-900 dark:text-white">Print or WhatsApp Bill</h5>
                  <p className="text-slate-500 dark:text-slate-400">
                    Instant 1-tap print to 58mm/80mm thermal roll or send directly to customer WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Inventory &amp; Barcode Management</h4>
              <p>
                ShopPOS Pro automatically manages live inventory deductions. Whenever an invoice is saved, item
                stock units are decremented instantly. Low-stock products trigger automatic warning badges on the dashboard.
              </p>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">GST Calculation &amp; Auto Round-Off</h4>
              <p>
                The system supports standard Indian GST brackets (0%, 5%, 12%, 18%, 28%) with accurate subtotal
                discounts and rupee round-off logic conforming to commercial retail accounting practices.
              </p>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Hardware Compatibility</h4>
              <p>
                Compatible with all Web Bluetooth ESC/POS receipt printers, USB thermal roll printers (58mm and 80mm),
                handheld USB barcode guns, and standard mobile cameras for scanning barcodes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
