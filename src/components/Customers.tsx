/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  DollarSign,
  MessageSquare,
  FileText,
  Edit2,
  Trash2,
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  UserCheck,
  Calendar,
  Check,
  Share2,
  QrCode,
  Copy,
  Send,
} from 'lucide-react';
import QRCode from 'qrcode';
import { AppDatabase, Customer, Sale, KhataEntry } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { sendWhatsAppMessage } from '../services/whatsappService';

interface CustomersProps {
  db: AppDatabase;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
}

export const Customers: React.FC<CustomersProps> = ({ db, onSaveCustomer, onDeleteCustomer }) => {
  const { t } = useLocalization();
  const { alert, toast, confirm } = useDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'due' | 'settled'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [balance, setBalance] = useState('0');

  // Record Payment Received modal
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [settlementDiscount, setSettlementDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [paymentNote, setPaymentNote] = useState('');

  // Give Credit / Add Udhaar modal
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');

  // Statement / Passbook modal
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Interactive WhatsApp Payment Reminder Modal
  const [reminderCustomer, setReminderCustomer] = useState<Customer | null>(null);
  const [reminderLang, setReminderLang] = useState<'en' | 'hi'>('en');
  const [reminderQrCode, setReminderQrCode] = useState<string>('');

  const cur = db.settings.currency || '₹';

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return db.customers.filter((c) => {
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q));

      const hasDue = (c.balance || 0) > 0;
      if (filterMode === 'due') return matchQuery && hasDue;
      if (filterMode === 'settled') return matchQuery && !hasDue;
      return matchQuery;
    });
  }, [db.customers, searchQuery, filterMode]);

  const totalOutstanding = useMemo(() => {
    return db.customers.reduce((acc, c) => acc + (c.balance || 0), 0);
  }, [db.customers]);

  const customersWithDueCount = useMemo(() => {
    return db.customers.filter((c) => (c.balance || 0) > 0).length;
  }, [db.customers]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setGstin('');
    setBalance('0');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address || '');
    setGstin(customer.gstin || '');
    setBalance(customer.balance?.toString() || '0');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Customer / Party name is required.', 'Validation Error');
      return;
    }

    const newCustomer: Customer = {
      id: editingCustomer ? editingCustomer.id : `cust_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      gstin: gstin.trim(),
      balance: parseFloat(balance) || 0,
    };

    onSaveCustomer(newCustomer);
    setIsModalOpen(false);
    toast(editingCustomer ? 'Party details updated' : 'New Party added to Khata', 'success');
  };

  const handleDelete = async (customer: Customer) => {
    const ok = await confirm(
      `Are you sure you want to delete ${customer.name}? This will remove their ledger balance.`,
      'Confirm Delete'
    );
    if (ok) {
      onDeleteCustomer(customer.id);
      toast('Party removed', 'info');
    }
  };

  // Record Payment Received (Got Cash/UPI)
  const handleRecordPayment = () => {
    if (!paymentCustomer) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid positive payment amount.', 'Invalid Amount');
      return;
    }
    const discount = parseFloat(settlementDiscount) || 0;
    const totalDeduction = amt + discount;
    const newBalance = Math.max(0, (paymentCustomer.balance || 0) - totalDeduction);

    const khataEntry: KhataEntry = {
      id: `khata_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      desc: `Payment In (${paymentMode.toUpperCase()})${discount > 0 ? ` + ₹${discount} Settlement Disc` : ''}${paymentNote ? ` - ${paymentNote}` : ''}`,
      debit: 0,
      credit: totalDeduction,
      balance: newBalance,
    };

    const existingLedger = paymentCustomer.khataLedger || [];
    const updated = {
      ...paymentCustomer,
      balance: newBalance,
      khataLedger: [khataEntry, ...existingLedger],
    };
    onSaveCustomer(updated);
    setPaymentCustomer(null);
    setPaymentAmount('');
    setSettlementDiscount('');
    setPaymentNote('');
    toast(`Payment of ${cur}${formatCurrency(amt)} received from ${paymentCustomer.name}`, 'success');
  };

  // Open Interactive WhatsApp Payment Reminder Modal
  const handleOpenReminderModal = async (customer: Customer) => {
    setReminderCustomer(customer);
    const due = customer.balance || 0;
    const upiId = db.settings.upi || db.settings.upiId || 'shop@upi';
    const shopName = db.settings.shopName || 'Retail Store';
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${due}&cu=INR`;
    try {
      const qr = await QRCode.toDataURL(upiUri, { margin: 1, width: 220 });
      setReminderQrCode(qr);
    } catch {
      setReminderQrCode('');
    }
  };

  // Send WhatsApp message from reminder modal
  const handleSendReminderWhatsApp = (customer: Customer, lang: 'en' | 'hi') => {
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const dueAmount = customer.balance || 0;
    const shopName = db.settings.shopName || 'Retail Store';
    const upiId = db.settings.upi || db.settings.upiId;
    const upiLink = upiId ? `\n\nPay via UPI: *${upiId}*\nClick to pay: upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${dueAmount}&cu=INR` : '';

    let text = '';
    if (lang === 'hi') {
      text = `नमस्ते ${customer.name},\nयह *${shopName}* की तरफ से भुगतान का रिमाइंडर है।\nआपका कुल बकाया खाता बैलेंस *${cur}${formatCurrency(dueAmount)}* है।\nकृपया जल्द से जल्द भुगतान करें।${upiLink}\n\nधन्यवाद!`;
    } else {
      text = `Dear ${customer.name},\nThis is a gentle payment reminder from *${shopName}*.\nYour outstanding Khata balance is *${cur}${formatCurrency(dueAmount)}*.\nKindly clear the dues at your earliest convenience.${upiLink}\n\nThank you for your business!`;
    }

    sendWhatsAppMessage({
      phone: cleanPhone,
      text,
      title: `Khata Reminder - ${customer.name}`,
    });
  };

  // Give Credit (Gave Udhaar)
  const handleAddCredit = () => {
    if (!creditCustomer) return;
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid positive credit amount.', 'Invalid Amount');
      return;
    }

    const newBalance = (creditCustomer.balance || 0) + amt;
    const updated = {
      ...creditCustomer,
      balance: newBalance,
    };
    onSaveCustomer(updated);
    setCreditCustomer(null);
    setCreditAmount('');
    setCreditNote('');
    toast(`Added ${cur}${formatCurrency(amt)} Udhaar to ${creditCustomer.name}`, 'success');
  };

  // Quick action: Mark full balance paid directly and settle Khata
  const handleQuickMarkPaid = async (customer: Customer) => {
    const due = customer.balance || 0;
    if (due <= 0) return;
    const ok = await confirm(
      `Mark entire balance of ${cur}${formatCurrency(due)} as paid for ${customer.name}? This will record a full settlement in their Khata ledger.`,
      'Mark Paid'
    );
    if (!ok) return;

    const newEntry: KhataEntry = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `khata_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      desc: 'Quick Full Payment Received (Settled)',
      debit: 0,
      credit: due,
      balance: 0,
    };

    const updated: Customer = {
      ...customer,
      balance: 0,
      khataBalance: 0,
      khataLedger: [newEntry, ...(customer.khataLedger || [])],
    };

    onSaveCustomer(updated);
    toast(`Payment of ${cur}${formatCurrency(due)} recorded. Account settled for ${customer.name}!`, 'success');
  };

  // WhatsApp Payment Reminder
  const handleWhatsAppReminder = (customer: Customer) => {
    const cleanPhone = customer.phone.replace(/\D/g, '');
    if (!cleanPhone) {
      alert('Party does not have a valid mobile number saved.', 'Phone Required');
      return;
    }

    const dueAmount = customer.balance || 0;
    const shopName = db.settings.shopName || 'our store';
    const upiLink = db.settings.upi || db.settings.upiId
      ? `\n\nYou can pay online via UPI to: *${db.settings.upi || db.settings.upiId}*`
      : '';

    const text = `Dear ${customer.name},\nThis is a gentle payment reminder from *${shopName}*.\nYour outstanding Khata balance is *${cur}${formatCurrency(dueAmount)}*.\nKindly clear the dues at your earliest convenience.${upiLink}\n\nThank you for your business!`;

    sendWhatsAppMessage({
      phone: cleanPhone,
      text,
      title: `Khata Reminder - ${customer.name}`,
    });
  };

  // Customer sales history for passbook statement
  const customerSales = useMemo(() => {
    if (!statementCustomer) return [];
    return db.sales.filter(
      (s) =>
        s.customer?.toLowerCase() === statementCustomer.name.toLowerCase() ||
        (statementCustomer.phone && s.customerPhone === statementCustomer.phone)
    );
  }, [statementCustomer, db.sales]);

  return (
    <div id="customers-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Top Banner & Financial Snapshot (MyBillBook style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Parties &amp; Customer Khata</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              {db.customers.length} Parties
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Track customer balances, credit ledgers &amp; send instant 1-tap WhatsApp reminders
          </p>
        </div>

        <button
          id="add-customer-btn"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 shrink-0"
        >
          <Plus size={16} />
          <span>+ Add New Party</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Outstanding Receivables (You'll Receive) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">
              You&apos;ll Receive (Total Udhaar)
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {cur}{formatCurrency(totalOutstanding)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Across {customersWithDueCount} parties with pending dues
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
            <ArrowDownLeft size={24} />
          </div>
        </div>

        {/* Total Registered Parties */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
              Total Customer Directory
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {db.customers.length}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Registered buyers &amp; clients
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
            <Users size={24} />
          </div>
        </div>

        {/* Settled / Clean Accounts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
              Settled Parties (No Dues)
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {db.customers.length - customersWithDueCount}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              All previous bills fully cleared
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="customer-search-input"
            type="text"
            placeholder="Search party by name, phone number or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Parties ({db.customers.length})
          </button>
          <button
            onClick={() => setFilterMode('due')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'due'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Due Only ({customersWithDueCount})
          </button>
          <button
            onClick={() => setFilterMode('settled')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'settled'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Settled ({db.customers.length - customersWithDueCount})
          </button>
        </div>
      </div>

      {/* Customer List / Table (Responsive Card layout for Mobile, Table for Desktop) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No parties found</p>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'Try matching another name or phone number' : 'Click "+ Add New Party" to create your first customer ledger'}
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Party Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Address / City</th>
                    <th className="py-3 px-4">Pending Udhaar</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredCustomers.map((c) => {
                    const hasDue = (c.balance || 0) > 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-black text-xs">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm block">{c.name}</span>
                              {c.gstin && <span className="text-[10px] text-slate-400 font-mono">GST: {c.gstin}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono">
                          {c.phone ? (
                            <span className="flex items-center gap-1.5">
                              <Phone size={13} className="text-slate-400" />
                              {c.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                          {c.address || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {hasDue ? (
                            <span className="inline-flex items-center gap-1 font-black text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 px-2.5 py-1 rounded-full">
                              <ArrowDownLeft size={13} />
                              {cur}{formatCurrency(c.balance || 0)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 px-2.5 py-0.5 rounded-full">
                              <Check size={13} />
                              Settled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Got Payment Button */}
                            <button
                              onClick={() => {
                                setPaymentCustomer(c);
                                setPaymentAmount((c.balance || 0) > 0 ? (c.balance || 0).toString() : '');
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 rounded-lg text-xs font-bold transition-colors"
                              title="Record Payment Received"
                            >
                              + Receive Cash
                            </button>

                            {/* Give Udhaar Button */}
                            <button
                              onClick={() => {
                                setCreditCustomer(c);
                                setCreditAmount('');
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs font-bold transition-colors"
                              title="Give Credit (Add Udhaar)"
                            >
                              + Udhaar
                            </button>

                            {/* Passbook / Statement */}
                            <button
                              onClick={() => setStatementCustomer(c)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="View Khata Statement / Passbook"
                            >
                              <FileText size={15} />
                            </button>

                            {/* Remind on WhatsApp */}
                            {c.phone && hasDue && (
                              <button
                                onClick={() => handleWhatsAppReminder(c)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                title="Remind on WhatsApp with Due Amount"
                              >
                                <MessageSquare size={13} />
                                <span>Remind on WhatsApp</span>
                              </button>
                            )}

                            {/* Mark Paid Quick Action */}
                            {hasDue && (
                              <button
                                onClick={() => handleQuickMarkPaid(c)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                                title="Mark entire balance paid"
                              >
                                <CheckCircle2 size={13} />
                                <span>Mark Paid</span>
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Details"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(c)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Card View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map((c) => {
                const hasDue = (c.balance || 0) > 0;
                return (
                  <div key={c.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-black text-sm">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                            {c.name}
                          </h4>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Phone size={12} />
                            {c.phone || 'No phone'}
                          </span>
                        </div>
                      </div>

                      {hasDue ? (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Due</span>
                          <span className="font-black text-base text-rose-600 dark:text-rose-400">
                            {cur}{formatCurrency(c.balance || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                          Settled
                        </span>
                      )}
                    </div>

                    {/* Action Toolbar on Mobile */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        onClick={() => {
                          setPaymentCustomer(c);
                          setPaymentAmount((c.balance || 0) > 0 ? (c.balance || 0).toString() : '');
                        }}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Receive Cash
                      </button>

                      {c.phone && hasDue && (
                        <button
                          onClick={() => handleWhatsAppReminder(c)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs font-bold flex items-center gap-1"
                          title="Remind on WhatsApp"
                        >
                          <MessageSquare size={13} />
                          <span>Remind on WhatsApp</span>
                        </button>
                      )}

                      {hasDue && (
                        <button
                          onClick={() => handleQuickMarkPaid(c)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                          title="Mark Paid"
                        >
                          <CheckCircle2 size={13} />
                          <span>Mark Paid</span>
                        </button>
                      )}

                      <button
                        onClick={() => setStatementCustomer(c)}
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl"
                        title="Statement"
                      >
                        <FileText size={15} />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Receive Payment Modal */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Record Cash / Payment</h4>
                <p className="text-xs text-slate-500">From: <strong>{paymentCustomer.name}</strong></p>
              </div>
              <button onClick={() => setPaymentCustomer(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex justify-between items-center text-xs">
              <span className="text-rose-700 dark:text-rose-300 font-semibold">Current Due Balance:</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-400">
                {cur}{formatCurrency(paymentCustomer.balance || 0)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Payment Amount Received ({cur}) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-slate-900 dark:text-white text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  autoFocus
                />
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Payment Mode</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setPaymentMode('cash')}
                    className={`py-1.5 rounded-lg font-bold transition-all ${
                      paymentMode === 'cash' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => setPaymentMode('upi')}
                    className={`py-1.5 rounded-lg font-bold transition-all ${
                      paymentMode === 'upi' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    UPI
                  </button>
                  <button
                    onClick={() => setPaymentMode('bank')}
                    className={`py-1.5 rounded-lg font-bold transition-all ${
                      paymentMode === 'bank' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Bank
                  </button>
                </div>
              </div>

              {/* Settlement Discount (Vyapar / MyBillBook concession) */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  Settlement / Cash Discount Given ({cur})
                </label>
                <input
                  type="number"
                  placeholder="0.00 (optional discount/waiver)"
                  value={settlementDiscount}
                  onChange={(e) => setSettlementDiscount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {parseFloat(settlementDiscount) > 0 && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">
                    Total balance to be reduced: {cur}{formatCurrency((parseFloat(paymentAmount) || 0) + (parseFloat(settlementDiscount) || 0))}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Note / Memo</label>
                <input
                  type="text"
                  placeholder="Optional memo (e.g. Cleared Diwali order)"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPaymentCustomer(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive WhatsApp UPI Payment Reminder Modal (MyBillBook & Vyapar Style) */}
      {reminderCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <MessageSquare size={18} />
                </span>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Send WhatsApp Reminder &amp; UPI QR
                  </h4>
                  <p className="text-xs text-slate-500">
                    To: <strong>{reminderCustomer.name}</strong> ({reminderCustomer.phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReminderCustomer(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Outstanding Amount Banner */}
            <div className="p-3.5 bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider block">
                  Total Pending Udhaar
                </span>
                <span className="text-2xl font-black text-rose-700 dark:text-rose-400">
                  {cur}{formatCurrency(reminderCustomer.balance || 0)}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <span>Shop UPI:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block font-mono">
                  {db.settings.upi || db.settings.upiId || 'shop@upi'}
                </span>
              </div>
            </div>

            {/* Bharat UPI QR Code */}
            {reminderQrCode && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-2">
                <img
                  src={reminderQrCode}
                  alt="UPI Bharat QR Code"
                  className="w-36 h-36 rounded-xl border-2 border-white dark:border-slate-700 shadow-sm"
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  Scan to Pay {cur}{formatCurrency(reminderCustomer.balance || 0)} directly via PhonePe, GPay, Paytm, BHIM
                </span>
              </div>
            )}

            {/* Language Selection Bar */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-400">Message Template:</span>
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setReminderLang('en')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    reminderLang === 'en'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setReminderLang('hi')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    reminderLang === 'hi'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  हिंदी (Hindi)
                </button>
              </div>
            </div>

            {/* Message Preview Box */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {reminderLang === 'hi'
                ? `नमस्ते ${reminderCustomer.name},\nयह ${db.settings.shopName || 'हमारी दुकान'} की तरफ से भुगतान का रिमाइंडर है। आपका कुल बकाया बैलेंस ${cur}${formatCurrency(reminderCustomer.balance || 0)} है। कृपया जल्द से जल्द UPI: ${db.settings.upi || db.settings.upiId || 'shop@upi'} द्वारा भुगतान करें। धन्यवाद!`
                : `Dear ${reminderCustomer.name},\nThis is a gentle payment reminder from ${db.settings.shopName || 'our store'}. Your outstanding Khata balance is ${cur}${formatCurrency(reminderCustomer.balance || 0)}. Kindly clear the dues at your earliest convenience via UPI: ${db.settings.upi || db.settings.upiId || 'shop@upi'}.\nThank you!`}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  const upiId = db.settings.upi || db.settings.upiId || 'shop@upi';
                  const shopName = db.settings.shopName || 'Retail Store';
                  const link = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${reminderCustomer.balance || 0}&cu=INR`;
                  navigator.clipboard.writeText(link);
                  toast('UPI Payment Link copied to clipboard!', 'success');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                <Copy size={14} />
                <span>Copy Link</span>
              </button>

              <button
                onClick={() => {
                  handleSendReminderWhatsApp(reminderCustomer, reminderLang);
                  setReminderCustomer(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                <Send size={14} />
                <span>Send WhatsApp Reminder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Give Credit / Add Udhaar Modal */}
      {creditCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Give Credit (Udhaar)</h4>
                <p className="text-xs text-slate-500">Party: <strong>{creditCustomer.name}</strong></p>
              </div>
              <button onClick={() => setCreditCustomer(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Credit Amount ({cur}) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-slate-900 dark:text-white text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Description / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Manual items taken on credit"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCreditCustomer(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredit}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Add to Due
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement / Passbook Ledger Modal */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Customer Statement (Passbook)</h4>
                <p className="text-xs text-slate-500">{statementCustomer.name} • {statementCustomer.phone || 'No phone'}</p>
              </div>
              <button onClick={() => setStatementCustomer(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Current Balance card */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-bold">Total Net Outstanding Due:</span>
              <span className={`text-base font-black ${(statementCustomer.balance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {cur}{formatCurrency(statementCustomer.balance || 0)}
              </span>
            </div>

            {/* Invoices list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                Transaction &amp; Bill History
              </span>
              {customerSales.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs italic">
                  No billed invoices found for this customer.
                </div>
              ) : (
                customerSales.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">Bill #{s.billNo}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {s.paymentMethod}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDate(s.date)} at {s.time} • {s.items.length} items
                      </span>
                    </div>

                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {cur}{formatCurrency(s.total)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setStatementCustomer(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-blue-600 dark:text-indigo-400" />
                {editingCustomer ? 'Edit Party Details' : 'Add New Party / Customer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Customer / Business Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma / Krishna Traders"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Mobile Phone (For WhatsApp &amp; Invoices)</label>
                <input
                  type="text"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Billing Address / City</label>
                <input
                  type="text"
                  placeholder="e.g. Shop #4, Market Yard, Pune"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">GSTIN (Optional for B2B Bills)</label>
                <input
                  type="text"
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Opening Khata Balance ({cur})</label>
                <input
                  type="number"
                  placeholder="0.00 (Positive = Customer owes you)"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {editingCustomer ? 'Update Party' : 'Save Party'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
