/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Package,
  AlertTriangle,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
  Printer,
  FileText,
  Users,
  DollarSign,
  Receipt,
  Activity,
  Plus,
  ArrowRight,
  Wallet,
  CheckCircle2,
  ChevronRight,
  Percent,
  Barcode,
  Truck,
} from 'lucide-react';
import { AppDatabase, Sale, CommercialDocument } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { ActiveTab } from './Header';

interface DashboardProps {
  db: AppDatabase;
  onOpenSaleReceipt: (sale: Sale) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onSaveDocument?: (doc: CommercialDocument) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ db, onOpenSaleReceipt, onNavigateTab, onSaveDocument }) => {
  const { t } = useLocalization();
  const { toast } = useDialog();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const cur = db.settings.currency || '₹';

  // Filter sales according to time range
  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    return db.sales.filter((s) => {
      if (s.voided) return false;
      if (timeRange === 'all') return true;
      if (timeRange === 'today') return s.date === todayStr;

      const saleDate = new Date(s.date);
      if (timeRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return saleDate >= weekAgo;
      }
      if (timeRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        return saleDate >= monthAgo;
      }
      return true;
    });
  }, [db.sales, timeRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let grossSales = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let creditTotal = 0;
    let estimatedCost = 0;

    filteredSales.forEach((s) => {
      grossSales += s.total;
      totalDiscount += s.discount || 0;
      totalTax += s.gst || 0;

      if (s.paymentMethod === 'cash') cashTotal += s.total;
      else if (s.paymentMethod === 'upi') upiTotal += s.total;
      else if (s.paymentMethod === 'card') cardTotal += s.total;
      else if (s.paymentMethod === 'credit') creditTotal += s.total;
      else if (s.paymentMethod === 'split' && s.splitDetails) {
        cashTotal += s.splitDetails.cashAmount || 0;
        upiTotal += s.splitDetails.upiAmount || 0;
      }

      s.items.forEach((item) => {
        const product = db.products.find((p) => p.id === item.productId);
        const unitCost = item.cost || (product ? (product.cost || product.buyPrice || 0) : 0) || 0;
        estimatedCost += unitCost * item.qty;
      });
    });

    const netProfit = Math.max(0, grossSales - estimatedCost - totalTax);

    return {
      grossSales,
      totalDiscount,
      totalTax,
      cashTotal,
      upiTotal,
      cardTotal,
      creditTotal,
      billsCount: filteredSales.length,
      estimatedCost,
      netProfit,
    };
  }, [filteredSales, db.products]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    const threshold = db.settings.lowStockDefault || 10;
    return db.products.filter((p) => (p.stock ?? p.qty ?? 0) <= threshold).slice(0, 8);
  }, [db.products, db.settings.lowStockDefault]);

  // Products expiring within the next 30 days
  const expiringProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAhead = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    return db.products.filter((p) => {
      if (!p.expiryDate) return false;
      const [y, m, d] = p.expiryDate.split('-').map(Number);
      if (!y || !m || !d) return false;
      const expDate = new Date(y, m - 1, d);
      return expDate >= today && expDate <= thirtyDaysAhead;
    }).sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
  }, [db.products]);

  const handleCreateDraftPO = () => {
    if (lowStockProducts.length === 0) return;
    const docNo = `PO-${Date.now().toString().slice(-6)}`;
    const poItems = lowStockProducts.map((p) => {
      const suggestedQty = Math.max(
        10,
        ((p.lowStockAlert || db.settings.lowStockDefault || 10) * 2) - (p.stock ?? p.qty ?? 0)
      );
      const rate = p.cost ?? p.buyPrice ?? 0;
      return {
        productId: p.id,
        name: p.name,
        qty: suggestedQty,
        price: rate,
      };
    });
    const subtotal = poItems.reduce((acc, i) => acc + i.qty * i.price, 0);
    const newPO: CommercialDocument = {
      id: `po_draft_${Date.now()}`,
      type: 'purchase_order',
      docNumber: docNo,
      date: new Date().toISOString().split('T')[0],
      partyName: db.suppliers[0]?.name || 'Primary Supplier',
      partyPhone: db.suppliers[0]?.phone,
      items: poItems,
      subtotal,
      total: subtotal,
      notes: 'Draft purchase order auto-generated from low-stock dashboard reorder alerts',
      status: 'pending',
    };

    if (onSaveDocument) {
      onSaveDocument(newPO);
      toast(`Draft Purchase Order #${docNo} created with ${poItems.length} items!`, 'success');
      onNavigateTab('documents');
    }
  };

  // Top Selling Items in filtered range
  const topSelling = useMemo(() => {
    const map: { [name: string]: { qty: number; revenue: number } } = {};
    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        if (!map[item.name]) map[item.name] = { qty: 0, revenue: 0 };
        map[item.name].qty += item.qty;
        map[item.name].revenue += item.qty * item.price;
      });
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  // Customer outstanding balance total
  const totalCustomerDue = useMemo(() => {
    return db.customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  }, [db.customers]);

  return (
    <div id="dashboard-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-6">
      {/* Header & Date Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Store Performance &amp; Analytics
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time billing numbers, payment reconciliation &amp; inventory insights
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex rounded-2xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
          {[
            { id: 'today', label: "Today's Shift" },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                timeRange === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Metric Stats Cards (MyBillBook style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Sales Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Sales</span>
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded-2xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {cur}{formatCurrency(metrics.grossSales)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Across <strong className="text-blue-600 dark:text-blue-400">{metrics.billsCount}</strong> completed bills
            </p>
          </div>
        </div>

        {/* Cash in Drawer */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash in Counter</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-2xl">
              <Banknote size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {cur}{formatCurrency(metrics.cashTotal)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Cash drawer collections</p>
          </div>
        </div>

        {/* UPI & Digital Collections */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">UPI &amp; Digital</span>
            <div className="p-2 bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 rounded-2xl">
              <QrCode size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {cur}{formatCurrency(metrics.upiTotal + metrics.cardTotal)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              UPI: {cur}{formatCurrency(metrics.upiTotal)} • Card: {cur}{formatCurrency(metrics.cardTotal)}
            </p>
          </div>
        </div>

        {/* Customer Udhaar Receivables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer Khata Due</span>
            <div className="p-2 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-2xl">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {cur}{formatCurrency(totalCustomerDue)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Total pending from parties</p>
          </div>
        </div>
      </div>

      {/* Quick Launchpad Action Bar (MyBillBook & Vyapar style 8 module shortcuts) */}
      <div className="space-y-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
          Quick Launchpad &amp; Tools
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <button
            onClick={() => onNavigateTab('pos')}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex flex-col items-center justify-center text-center shadow-md transition-all active:scale-95 group"
          >
            <Plus size={20} className="mb-1 text-white" />
            <span className="text-xs font-black">New Bill</span>
            <span className="text-[10px] text-blue-100">Fast POS</span>
          </button>

          <button
            onClick={() => onNavigateTab('inventory')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <Package size={20} className="mb-1 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Items &amp; Stock</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{db.products.length} products</span>
          </button>

          <button
            onClick={() => onNavigateTab('customers')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <Users size={20} className="mb-1 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Parties &amp; Khata</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Udhaar Ledger</span>
          </button>

          <button
            onClick={() => onNavigateTab('sales')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <Receipt size={20} className="mb-1 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Invoices</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Sales Register</span>
          </button>

          <button
            onClick={() => onNavigateTab('reports')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <TrendingUp size={20} className="mb-1 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">GST &amp; P&amp;L</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Tax Reports</span>
          </button>

          <button
            onClick={() => onNavigateTab('barcodes')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <Barcode size={20} className="mb-1 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Barcode Tags</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Label Print</span>
          </button>

          <button
            onClick={() => onNavigateTab('suppliers')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <Truck size={20} className="mb-1 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Purchases</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Inward Bills</span>
          </button>

          <button
            onClick={() => onNavigateTab('expenses')}
            className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-all active:scale-95 group"
          >
            <Wallet size={20} className="mb-1 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Expenses</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Daily Outflows</span>
          </button>
        </div>
      </div>

      {/* Middle Section: Payment Breakdown & Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment Reconciliation Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600 dark:text-indigo-400" />
            Payment Mode Reconciliation
          </h4>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                <span>Cash Counter:</span>
                <span className="font-bold text-slate-900 dark:text-white">{cur}{formatCurrency(metrics.cashTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${metrics.grossSales > 0 ? (metrics.cashTotal / metrics.grossSales) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                <span>UPI / Bharat QR:</span>
                <span className="font-bold text-slate-900 dark:text-white">{cur}{formatCurrency(metrics.upiTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full"
                  style={{
                    width: `${metrics.grossSales > 0 ? (metrics.upiTotal / metrics.grossSales) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                <span>Credit (Udhaar Unpaid):</span>
                <span className="font-bold text-slate-900 dark:text-white">{cur}{formatCurrency(metrics.creditTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full"
                  style={{
                    width: `${metrics.grossSales > 0 ? (metrics.creditTotal / metrics.grossSales) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag size={16} className="text-blue-600 dark:text-indigo-400" />
              Top Fast-Moving Items
            </h4>
            <span className="text-[11px] text-slate-500">By Revenue</span>
          </div>

          <div className="space-y-2.5">
            {topSelling.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No sales logged in this period</p>
            ) : (
              topSelling.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/80 last:border-none">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                      <span className="text-[10px] text-slate-500">{item.qty} units sold</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{cur}{formatCurrency(item.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inventory Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Low Stock Warnings
            </h4>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-[11px] text-blue-600 dark:text-indigo-400 font-bold hover:underline"
            >
              Manage &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 py-4 text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 size={16} />
                All item stocks are optimal
              </p>
            ) : (
              <>
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs"
                  >
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{p.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-extrabold text-[10px]">
                      {p.stock ?? p.qty ?? 0} {p.unit || 'pcs'} left
                    </span>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleCreateDraftPO}
                  className="w-full mt-2.5 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Truck size={14} />
                  <span>Create Draft Purchase Order ({lowStockProducts.length} items)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expiry & Batch Alerts (Next 30 Days) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Clock size={16} className="text-rose-500" />
            <span>Expiry &amp; Batch Alerts (Next 30 Days)</span>
            {expiringProducts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {expiringProducts.length} Expiring
              </span>
            )}
          </h4>
          <button
            onClick={() => onNavigateTab('inventory')}
            className="text-[11px] text-blue-600 dark:text-indigo-400 font-bold hover:underline"
          >
            Inventory &rarr;
          </button>
        </div>

        {expiringProducts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-500" />
            No products expiring in the next 30 days.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {expiringProducts.slice(0, 8).map((p) => {
              const [y, m, d] = (p.expiryDate || '').split('-').map(Number);
              const expDate = new Date(y, m - 1, d);
              const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isUrgent = diffDays <= 7;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border text-xs flex flex-col justify-between space-y-2 ${
                    isUrgent
                      ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40'
                      : 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30'
                  }`}
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                      Batch: {p.batchNo || p.batchCode || 'Standard'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-black ${isUrgent ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {diffDays <= 0 ? 'Expires today' : `In ${diffDays} days`} ({p.expiryDate})
                    </span>
                    <span className="font-extrabold text-slate-600 dark:text-slate-300">
                      {p.stock ?? p.qty ?? 0} {p.unit || 'pcs'} left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Invoices Table (MyBillBook style) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-blue-600 dark:text-indigo-400" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Recent Invoices</h3>
          </div>
          <button
            onClick={() => onNavigateTab('sales')}
            className="text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>View All Invoices</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Bill #</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSales.slice(0, 6).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                    #{s.billNo}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                    {formatDate(s.date)} • {s.time}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {s.customer || 'Walk-In'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                    {s.items.length} items
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {cur}{formatCurrency(s.total)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onOpenSaleReceipt(s)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                    >
                      <Printer size={13} />
                      <span>Print</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
