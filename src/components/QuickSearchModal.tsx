/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Package,
  Users,
  Receipt,
  FileSpreadsheet,
  Barcode,
  Truck,
  Wallet,
  Settings as SettingsIcon,
  ChevronRight,
  X,
  ShoppingCart,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { AppDatabase, Product, Customer, Sale } from '../types';
import { ActiveTab } from './Header';
import { formatCurrency, formatDate } from '../utils';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: AppDatabase;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenReceipt: (sale: Sale) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  db,
  onNavigateTab,
  onOpenReceipt,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cur = db.settings.currency || '₹';

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Modules search definitions
  const modulesList: { id: ActiveTab; label: string; desc: string; icon: React.ReactNode; keywords: string }[] = [
    { id: 'pos', label: 'POS Billing', desc: 'Fast retail checkout & thermal bill print', icon: <ShoppingCart size={16} />, keywords: 'pos bill counter checkout cart payment' },
    { id: 'sales', label: 'Invoices & Sales', desc: 'View past bills, tax invoices & void sales', icon: <Receipt size={16} />, keywords: 'sales bills invoices history receipts register' },
    { id: 'inventory', label: 'Items & Stock', desc: 'Product catalog, stock audit & price tags', icon: <Package size={16} />, keywords: 'items inventory stock products goods edit mrp cost' },
    { id: 'customers', label: 'Parties & Khata', desc: 'Customer credit ledger & WhatsApp UPI reminders', icon: <Users size={16} />, keywords: 'customers parties khata udhaar credit dues balance reminder' },
    { id: 'reports', label: 'GST & P&L Reports', desc: 'GSTR-1, GSTR-3B, Daybook & Profit & Loss', icon: <TrendingUp size={16} />, keywords: 'reports gst gstr1 gstr3b profit loss pnl daybook taxes tax filing' },
    { id: 'barcodes', label: 'Barcode Stickers', desc: 'Multi-label sheets & thermal roll sticker printing', icon: <Barcode size={16} />, keywords: 'barcode label stickers print roll sheet tag a4 designer' },
    { id: 'suppliers', label: 'Suppliers & Purchases', desc: 'Vendor directory & inward purchase bills', icon: <Truck size={16} />, keywords: 'suppliers vendors purchase inward bills itc buy wholesale' },
    { id: 'documents', label: 'Quotations & B2B', desc: 'Commercial quotations, POs & delivery challans', icon: <FileSpreadsheet size={16} />, keywords: 'quotations estimates challan purchase orders b2b' },
    { id: 'expenses', label: 'Store Expenses', desc: 'Daily operating expenses & register cash outflows', icon: <Wallet size={16} />, keywords: 'expenses petty cash rent electricity salary tea outflows' },
    { id: 'staff', label: 'Staff PIN & Shifts', desc: 'Cashier shifts, attendance & permissions', icon: <Users size={16} />, keywords: 'staff cashier pin lock shift attendance team' },
    { id: 'settings', label: 'Settings & Hardware', desc: 'Store profile, GSTIN, thermal printer & backup', icon: <SettingsIcon size={16} />, keywords: 'settings profile printer upi bluetooth backup restore reset brand' },
  ];

  // Matched Results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // Default: show modules
      return {
        modules: modulesList.slice(0, 6),
        products: [],
        customers: [],
        sales: [],
      };
    }

    const matchedModules = modulesList.filter(
      (m) => m.label.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.keywords.includes(q)
    );

    const matchedProducts = (db.products || [])
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      )
      .slice(0, 5);

    const matchedCustomers = (db.customers || [])
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      )
      .slice(0, 4);

    const matchedSales = (db.sales || [])
      .filter(
        (s) =>
          s.billNo.toString().includes(q) ||
          (s.customer && s.customer.toLowerCase().includes(q)) ||
          (s.customerPhone && s.customerPhone.includes(q))
      )
      .slice(0, 4);

    return {
      modules: matchedModules,
      products: matchedProducts,
      customers: matchedCustomers,
      sales: matchedSales,
    };
  }, [query, db.products, db.customers, db.sales]);

  const totalResultsCount =
    results.modules.length + results.products.length + results.customers.length + results.sales.length;

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/60 dark:bg-slate-900">
          <Search size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type anything... product, customer, bill #, GST report, barcode..."
            className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-4 text-xs">
          {totalResultsCount === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Search size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-bold text-slate-600 dark:text-slate-300">No results found for &quot;{query}&quot;</p>
              <p className="text-[11px] text-slate-400">Try searching for products, customers, bills or feature names.</p>
            </div>
          )}

          {/* 1. App Modules / Shortcuts */}
          {results.modules.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Navigation Shortcuts
              </span>
              <div className="space-y-1">
                {results.modules.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onNavigateTab(m.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {m.icon}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{m.label}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{m.desc}</div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Products */}
          {results.products.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Items &amp; Products ({results.products.length})
              </span>
              <div className="space-y-1">
                {results.products.map((p) => {
                  const stock = p.stock ?? p.qty ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onNavigateTab('inventory');
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <Package size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {p.category || 'General'} • Barcode: {p.barcode || p.sku || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-slate-900 dark:text-white text-xs">
                          {cur}{formatCurrency(p.price || p.sellPrice || 0)}
                        </div>
                        <span className={`text-[10px] font-bold ${
                          stock <= (db.settings.lowStockDefault || 10) ? 'text-amber-600' : 'text-slate-500'
                        }`}>
                          Stock: {stock} {p.unit || 'pcs'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Customers / Parties */}
          {results.customers.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Parties &amp; Customers ({results.customers.length})
              </span>
              <div className="space-y-1">
                {results.customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onNavigateTab('customers');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
                        <Users size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.phone || c.address || 'Customer'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 font-semibold">Balance Due</div>
                      <span className={`font-black text-xs ${
                        (c.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {cur}{formatCurrency(c.balance || 0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Sales Invoices */}
          {results.sales.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Sales Invoices ({results.sales.length})
              </span>
              <div className="space-y-1">
                {results.sales.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onOpenReceipt(s);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                        <Receipt size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white font-mono">Bill #{s.billNo}</div>
                        <div className="text-[10px] text-slate-500">
                          {s.customer || 'Walk-in'} • {formatDate(s.date)} {s.time || ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-slate-900 dark:text-white text-xs">
                        {cur}{formatCurrency(s.total)}
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        {s.paymentMethod}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 px-4">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px]">
              ↑
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px]">
              ↓
            </kbd>
            <span>Select:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px]">
              ↵
            </kbd>
          </div>
          <div>Press <strong>ESC</strong> to dismiss</div>
        </div>
      </div>
    </div>
  );
};
