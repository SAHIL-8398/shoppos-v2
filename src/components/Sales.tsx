/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Printer,
  FileText,
  Share2,
  Trash2,
  Calendar,
  AlertCircle,
  XCircle,
  Eye,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AppDatabase, Sale } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { sendWhatsAppMessage } from '../services/whatsappService';

interface SalesProps {
  db: AppDatabase;
  onOpenReceipt: (sale: Sale) => void;
  onVoidSale: (saleId: string) => void;
  onReturnSale?: (params: {
    saleId: string;
    returns: { itemIndex: number; qty: number }[];
    refundAmount: number;
    reason: string;
  }) => void;
}

export const Sales: React.FC<SalesProps> = ({ db, onOpenReceipt, onVoidSale, onReturnSale }) => {
  const { t } = useLocalization();
  const { confirm, toast, alert } = useDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const cur = db.settings.currency || '₹';

  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return db.sales.filter((s) => {
      const matchQuery =
        !q ||
        s.billNo.toString().includes(q) ||
        (s.customer && s.customer.toLowerCase().includes(q)) ||
        (s.customerPhone && s.customerPhone.includes(q)) ||
        s.items.some((i) => i.name.toLowerCase().includes(q));

      const matchMethod = selectedMethod === 'all' || s.paymentMethod === selectedMethod;
      const matchDate = !selectedDate || s.date === selectedDate;

      return matchQuery && matchMethod && matchDate;
    });
  }, [db.sales, searchQuery, selectedMethod, selectedDate]);

  const totalFilteredRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (s.voided ? 0 : s.total), 0);
  }, [filteredSales]);

  const handleVoid = async (sale: Sale) => {
    const ok = await confirm(
      `Are you sure you want to void / cancel Bill #${sale.billNo} for ${cur}${formatCurrency(sale.total)}? This will reverse the transaction and restore stock.`,
      'Void Transaction'
    );
    if (ok) {
      onVoidSale(sale.id);
      toast(`Bill #${sale.billNo} has been voided`, 'info');
    }
  };

  const handleWhatsAppShare = (sale: Sale) => {
    const phone = (sale.customerPhone || '').replace(/\D/g, '');
    const shopName = db.settings.shopName || 'Retail Store';
    const itemsSummary = sale.items.map((i) => `• ${i.name} (x${i.qty}) - ${cur}${formatCurrency(i.price * i.qty)}`).join('\n');
    const text = `*Invoice #${sale.billNo} - ${shopName}*\nDate: ${formatDate(sale.date)} ${sale.time || ''}\nCustomer: ${sale.customer || 'Valued Customer'}\n\n*Items:*\n${itemsSummary}\n\n*Total Amount: ${cur}${formatCurrency(sale.total)}*\nPayment: ${sale.paymentMethod.toUpperCase()}\n\nThank you for shopping with us!`;

    sendWhatsAppMessage({
      phone,
      text,
      title: `Invoice #${sale.billNo} - ${shopName}`,
    });
  };

  // Return items modal state
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<{ [itemIdx: number]: number }>({});
  const [returnReason, setReturnReason] = useState('Customer Return');

  const handleOpenReturnModal = (sale: Sale) => {
    setReturnSale(sale);
    const initial: { [itemIdx: number]: number } = {};
    sale.items.forEach((_, idx) => {
      initial[idx] = 0;
    });
    setReturnQuantities(initial);
    setReturnReason('Customer Return');
  };

  const handleUpdateReturnQty = (idx: number, val: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(val, maxQty));
    setReturnQuantities((prev) => ({
      ...prev,
      [idx]: clamped,
    }));
  };

  // Compute prorated refund and discount
  const { grossReturnVal, proratedDiscount, returnedGst, netRefundVal, totalReturnQty } = useMemo(() => {
    if (!returnSale) {
      return { grossReturnVal: 0, proratedDiscount: 0, returnedGst: 0, netRefundVal: 0, totalReturnQty: 0 };
    }

    let gross = 0;
    let qtyCount = 0;

    returnSale.items.forEach((item, idx) => {
      const q = returnQuantities[idx] || 0;
      if (q > 0) {
        gross += item.price * q;
        qtyCount += q;
      }
    });

    const discountRate = returnSale.subtotal > 0 ? (returnSale.discount / returnSale.subtotal) : 0;
    const disc = gross * discountRate;
    const gstRate = returnSale.gstPct || (returnSale.subtotal > 0 ? ((returnSale.gst / returnSale.subtotal) * 100) : 0);
    const gst = ((gross - disc) * gstRate) / 100;
    const net = Math.max(0, gross - disc + gst);

    return {
      grossReturnVal: gross,
      proratedDiscount: disc,
      returnedGst: gst,
      netRefundVal: net,
      totalReturnQty: qtyCount,
    };
  }, [returnSale, returnQuantities]);

  const handleConfirmReturn = async () => {
    if (!returnSale || totalReturnQty <= 0) {
      alert('Please enter at least 1 item quantity to return.', 'No Quantity');
      return;
    }

    const returnsList = Object.entries(returnQuantities)
      .map(([idxStr, qty]) => ({ itemIndex: Number(idxStr), qty: Number(qty) }))
      .filter((r) => r.qty > 0);

    if (onReturnSale) {
      onReturnSale({
        saleId: returnSale.id,
        returns: returnsList,
        refundAmount: netRefundVal,
        reason: returnReason,
      });
    }

    setReturnSale(null);
  };

  return (
    <div id="sales-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Header & Financial Snapshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Sales Register &amp; Invoices</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              {filteredSales.length} Bills
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Audit history of all completed retail sales, invoices, GST receipts &amp; refunds
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-4 text-xs shadow-sm">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Total Invoiced</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {cur}{formatCurrency(totalFilteredRevenue)}
            </span>
          </div>
          <div className="border-l border-slate-200 dark:border-slate-800 pl-4">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Invoices Count</span>
            <span className="text-base font-black text-slate-900 dark:text-white">
              {filteredSales.length}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="sales-search-input"
            type="text"
            placeholder="Search bill #, customer name, phone or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            id="sales-payment-method-select"
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI / QR</option>
            <option value="card">Card</option>
            <option value="credit">Credit (Udhaar)</option>
            <option value="split">Split Payment</option>
          </select>

          <input
            id="sales-date-input"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          />

          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Transactions Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Receipt size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No invoices found matching criteria</p>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'Try clearing your search filters' : 'Invoices created in POS will appear here'}
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4 text-right">Receipt Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        sale.voided ? 'opacity-50 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white font-mono">
                        #{sale.billNo}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatDate(sale.date)}</span>
                          <span className="text-[10px] text-slate-400 block">{sale.time || ''}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{sale.customer || 'Walk-In Customer'}</p>
                          {sale.customerPhone && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{sale.customerPhone}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <p className="line-clamp-1 max-w-[200px]">
                          {sale.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                        </p>
                        <span className="text-[10px] text-slate-400">{sale.items.length} items</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {cur}{formatCurrency(sale.total)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenReceipt(sale)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs font-bold transition-colors"
                            title="View Invoice & Print"
                          >
                            <Printer size={13} />
                            <span>Receipt</span>
                          </button>

                          <button
                            onClick={() => handleWhatsAppShare(sale)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
                            title="Share on WhatsApp"
                          >
                            <MessageSquare size={15} />
                          </button>

                          {!sale.voided && (
                            <button
                              onClick={() => handleOpenReturnModal(sale)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Return Items & Generate Credit Note"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}

                          {!sale.voided && (
                            <button
                              onClick={() => handleVoid(sale)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Void / Refund Bill"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Card View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSales.map((sale) => (
                <div key={sale.id} className={`p-4 space-y-3 ${sale.voided ? 'opacity-50 line-through' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-slate-900 dark:text-white font-mono">
                          #{sale.billNo}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {sale.paymentMethod}
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-slate-900 dark:text-white mt-1">
                        {sale.customer || 'Walk-In Customer'}
                      </p>
                      <span className="text-[11px] text-slate-400 block">
                        {formatDate(sale.date)} • {sale.time}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                        {cur}{formatCurrency(sale.total)}
                      </span>
                      <span className="text-[10px] text-slate-400">{sale.items.length} items</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 line-clamp-1">
                    {sale.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                  </div>

                  {/* Actions Bar on Mobile */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      onClick={() => onOpenReceipt(sale)}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Printer size={13} />
                      <span>Print Receipt</span>
                    </button>

                    <button
                      onClick={() => handleWhatsAppShare(sale)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <MessageSquare size={13} />
                      <span>Share</span>
                    </button>

                    {!sale.voided && (
                      <button
                        onClick={() => handleOpenReturnModal(sale)}
                        className="p-2 text-slate-500 hover:text-amber-600 bg-slate-100 dark:bg-slate-800 rounded-xl"
                        title="Return Items"
                      >
                        <RotateCcw size={15} />
                      </button>
                    )}

                    {!sale.voided && (
                      <button
                        onClick={() => handleVoid(sale)}
                        className="p-2 text-slate-400 hover:text-rose-600 bg-slate-100 dark:bg-slate-800 rounded-xl"
                        title="Void / Cancel"
                      >
                        <XCircle size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Return Items & Credit Note Modal */}
      {returnSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  <RotateCcw size={18} />
                </span>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Return Items • Bill #{returnSale.billNo}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Customer: <strong>{returnSale.customer || 'Walk-In'}</strong> ({formatDate(returnSale.date)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReturnSale(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Select Items and Return Quantities:
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {returnSale.items.map((item, idx) => {
                  const remaining = Math.max(0, item.qty - (item.returnedQty || 0));
                  const currentReturn = returnQuantities[idx] || 0;
                  return (
                    <div
                      key={item.id || `${item.productId || 'item'}_${idx}`}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{item.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {cur}{formatCurrency(item.price)} • Sold: {item.qty} {item.unit}
                          {item.returnedQty ? ` (Prev. Returned: ${item.returnedQty})` : ''}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                          Returnable: {remaining} {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateReturnQty(idx, currentReturn - 1, remaining)}
                          disabled={currentReturn <= 0}
                          className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 font-bold flex items-center justify-center text-slate-800 dark:text-white"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={currentReturn}
                          onChange={(e) => handleUpdateReturnQty(idx, parseInt(e.target.value) || 0, remaining)}
                          className="w-12 text-center py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateReturnQty(idx, currentReturn + 1, remaining)}
                          disabled={currentReturn >= remaining}
                          className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 font-bold flex items-center justify-center text-slate-800 dark:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Return Reason */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Reason for Return:
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="Damaged / Defective">Damaged / Defective Product</option>
                <option value="Wrong Item Selected">Wrong Item or Size Selected</option>
                <option value="Customer Return">Customer Returned / Exchange</option>
                <option value="Expired / Near Expiry">Expired / Quality Issue</option>
              </select>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Return Value:</span>
                <span>{cur}{formatCurrency(grossReturnVal)}</span>
              </div>
              {proratedDiscount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Prorated Discount Adjustment:</span>
                  <span>- {cur}{formatCurrency(proratedDiscount)}</span>
                </div>
              )}
              {returnedGst > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Prorated GST:</span>
                  <span>+ {cur}{formatCurrency(returnedGst)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-sm pt-1 border-t border-amber-200/60 dark:border-amber-900/60">
                <span>Net Credit Note Amount:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{cur}{formatCurrency(netRefundVal)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnSale(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={totalReturnQty === 0}
                onClick={handleConfirmReturn}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Issue Credit Note &amp; Restock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
