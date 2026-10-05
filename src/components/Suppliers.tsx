/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit2,
  Search,
  X,
  CreditCard,
  Building,
  Receipt,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
} from 'lucide-react';
import { AppDatabase, Supplier, PurchaseBill, PurchaseBillItem, Product } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';

interface SuppliersProps {
  db: AppDatabase;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onSavePurchaseBill?: (bill: PurchaseBill) => void;
  onSaveProduct?: (product: Product) => void;
}

export const Suppliers: React.FC<SuppliersProps> = ({
  db,
  onSaveSupplier,
  onDeleteSupplier,
  onSavePurchaseBill,
  onSaveProduct,
}) => {
  const { t } = useLocalization();
  const { alert, toast, confirm } = useDialog();

  const [activeSubTab, setActiveSubTab] = useState<'suppliers' | 'purchases'>('suppliers');

  // Supplier Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [balance, setBalance] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment-Out Modal State
  const [paymentOutSupplier, setPaymentOutSupplier] = useState<Supplier | null>(null);
  const [paymentOutAmount, setPaymentOutAmount] = useState('');
  const [paymentOutMode, setPaymentOutMode] = useState<'cash' | 'bank' | 'upi'>('bank');
  const [paymentOutNote, setPaymentOutNote] = useState('');

  // Inward Purchase Bill Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseBillNo, setPurchaseBillNo] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [purchasePaymentStatus, setPurchasePaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [purchasePaymentMode, setPurchasePaymentMode] = useState<'cash' | 'bank' | 'upi'>('bank');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseBillItem[]>([
    {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}`,
      name: '',
      qty: 1,
      unit: 'pcs',
      costPrice: 0,
      gstPct: 0,
      totalAmount: 0,
    },
  ]);

  const cur = db.settings.currency || '₹';

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return db.suppliers.filter((s) => {
      return (
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    });
  }, [db.suppliers, searchQuery]);

  const totalPayable = useMemo(() => {
    return filteredSuppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
  }, [filteredSuppliers]);

  const purchaseBills = useMemo(() => {
    return db.purchaseBills || [];
  }, [db.purchaseBills]);

  const totalPurchasesAmount = useMemo(() => {
    return purchaseBills.reduce((acc, pb) => acc + pb.totalAmount, 0);
  }, [purchaseBills]);

  // Open Supplier Edit / Add
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setBalance('0');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setContactPerson(sup.contactPerson || '');
    setPhone(sup.phone || '');
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setGstin(sup.gstin || '');
    setBalance((sup.balance || 0).toString());
    setIsModalOpen(true);
  };

  const handleSaveSupplierRecord = () => {
    if (!name.trim()) {
      alert('Supplier company or vendor name is required.', 'Validation Error');
      return;
    }

    const newSupplier: Supplier = {
      id: editingSupplier ? editingSupplier.id : `sup_${Date.now()}`,
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      gstin: gstin.trim().toUpperCase(),
      balance: parseFloat(balance) || 0,
    };

    onSaveSupplier(newSupplier);
    setIsModalOpen(false);
    toast(editingSupplier ? 'Supplier details updated' : 'New supplier added to catalog', 'success');
  };

  const handleDeleteSupplierRecord = async (sup: Supplier) => {
    const ok = await confirm(
      `Are you sure you want to remove supplier ${sup.name}? This will remove vendor contact information.`,
      'Confirm Deletion'
    );
    if (ok) {
      onDeleteSupplier(sup.id);
      toast('Supplier removed', 'info');
    }
  };

  // Payment Out (Pay Supplier Balance)
  const handleRecordPaymentOut = () => {
    if (!paymentOutSupplier) return;
    const amt = parseFloat(paymentOutAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid positive payment amount.', 'Invalid Amount');
      return;
    }

    const newBalance = Math.max(0, (paymentOutSupplier.balance || 0) - amt);
    const updated = {
      ...paymentOutSupplier,
      balance: newBalance,
    };
    onSaveSupplier(updated);
    setPaymentOutSupplier(null);
    setPaymentOutAmount('');
    setPaymentOutNote('');
    toast(`Payment of ${cur}${formatCurrency(amt)} made to ${paymentOutSupplier.name}`, 'success');
  };

  // Open Record Inward Purchase Modal
  const handleOpenPurchaseModal = () => {
    const firstSup = db.suppliers[0];
    setSelectedSupplierId(firstSup ? firstSup.id : '');
    setPurchaseBillNo(`BILL-${Date.now().toString().slice(-5)}`);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchasePaymentStatus('paid');
    setPurchasePaymentMode('bank');
    setPurchaseNotes('');
    setPurchaseItems([
      {
        name: db.products[0]?.name || '',
        productId: db.products[0]?.id || '',
        qty: 10,
        unit: db.products[0]?.unit || 'pcs',
        costPrice: db.products[0]?.cost || db.products[0]?.buyPrice || 100,
        gstPct: db.products[0]?.gstPct || 0,
        totalAmount: 1000,
      },
    ]);
    setIsPurchaseModalOpen(true);
  };

  // Line item manipulation
  const addPurchaseItemRow = () => {
    setPurchaseItems([
      ...purchaseItems,
      {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random()}`,
        name: '',
        qty: 1,
        unit: 'pcs',
        costPrice: 0,
        gstPct: 0,
        totalAmount: 0,
      },
    ]);
  };

  const removePurchaseItemRow = (index: number) => {
    if (purchaseItems.length <= 1) return;
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const updatePurchaseItem = (index: number, field: keyof PurchaseBillItem, value: string | number) => {
    const updated = [...purchaseItems];
    const item = { ...updated[index], [field]: value };

    // If product was selected from catalog
    if (field === 'productId') {
      const prod = db.products.find((p) => p.id === value);
      if (prod) {
        item.name = prod.name;
        item.unit = prod.unit || 'pcs';
        item.costPrice = prod.cost || prod.buyPrice || 0;
        item.gstPct = prod.gstPct || 0;
      }
    }

    // Recompute total
    const qty = Number(item.qty) || 0;
    const rate = Number(item.costPrice) || 0;
    const gst = Number(item.gstPct) || 0;
    const sub = qty * rate;
    const tax = gst > 0 ? (sub * gst) / 100 : 0;
    item.taxAmount = tax;
    item.totalAmount = sub + tax;

    updated[index] = item;
    setPurchaseItems(updated);
  };

  // Save Purchase Bill
  const handleSavePurchaseBill = () => {
    if (!selectedSupplierId) {
      alert('Please select a supplier for this purchase bill.', 'Supplier Required');
      return;
    }
    const sup = db.suppliers.find((s) => s.id === selectedSupplierId);
    if (!sup) {
      alert('Selected supplier not found.', 'Error');
      return;
    }
    const validItems = purchaseItems.filter((i) => i.name.trim() && i.qty > 0 && i.costPrice >= 0);
    if (validItems.length === 0) {
      alert('Add at least one line item with valid product name, quantity, and cost price.', 'Items Required');
      return;
    }

    const subtotal = validItems.reduce((acc, i) => acc + (i.qty * i.costPrice), 0);
    const taxAmount = validItems.reduce((acc, i) => acc + (i.taxAmount || 0), 0);
    const totalAmount = subtotal + taxAmount;

    const newBill: PurchaseBill = {
      id: `pb_${Date.now()}`,
      billNo: purchaseBillNo.trim() || `PB-${Date.now().toString().slice(-6)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      supplierGstin: sup.gstin,
      date: purchaseDate,
      items: validItems,
      subtotal,
      taxAmount,
      totalAmount,
      paymentStatus: purchasePaymentStatus,
      paymentMode: purchasePaymentMode,
      paidAmount: purchasePaymentStatus === 'paid' ? totalAmount : 0,
      notes: purchaseNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    // 1. Update supplier balance if credit/unpaid
    if (purchasePaymentStatus === 'unpaid') {
      const nextBal = (sup.balance || 0) + totalAmount;
      onSaveSupplier({
        ...sup,
        balance: nextBal,
      });
    }

    // 2. Increment stock & update buyPrice in inventory
    if (onSaveProduct) {
      validItems.forEach((vItem) => {
        const existingProd = db.products.find(
          (p) => p.id === vItem.productId || p.name.toLowerCase() === vItem.name.toLowerCase()
        );
        if (existingProd) {
          const currentStock = existingProd.stock ?? existingProd.qty ?? 0;
          onSaveProduct({
            ...existingProd,
            stock: currentStock + vItem.qty,
            qty: currentStock + vItem.qty,
            cost: vItem.costPrice,
            buyPrice: vItem.costPrice,
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    // 3. Save purchase bill
    if (onSavePurchaseBill) {
      onSavePurchaseBill(newBill);
    } else if (db.purchaseBills) {
      db.purchaseBills.unshift(newBill);
    }

    setIsPurchaseModalOpen(false);
    toast(`Inward Purchase Bill #${newBill.billNo} recorded! Inventory stock updated.`, 'success');
  };

  return (
    <div id="suppliers-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Top Banner & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Suppliers &amp; Inward Purchases</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              {activeSubTab === 'suppliers' ? `${filteredSuppliers.length} Vendors` : `${purchaseBills.length} Bills`}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage vendor contacts, supplier balances, inward purchase bills &amp; stock entry
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenPurchaseModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Receipt size={15} />
            <span>+ Record Purchase Bill</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>+ Add Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Cards & Sub-Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">
            Total Payable to Suppliers
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {cur}{formatCurrency(totalPayable)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Across {filteredSuppliers.filter((s) => (s.balance || 0) > 0).length} suppliers with balance
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
            Total Inward Purchases
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {cur}{formatCurrency(totalPurchasesAmount)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            {purchaseBills.length} Inward bills recorded
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Active Module View
          </span>
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold">
            <button
              onClick={() => setActiveSubTab('suppliers')}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                activeSubTab === 'suppliers'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Suppliers Directory
            </button>
            <button
              onClick={() => setActiveSubTab('purchases')}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                activeSubTab === 'purchases'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Purchase Invoices ({purchaseBills.length})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. SUPPLIERS DIRECTORY */}
      {/* ========================================================= */}
      {activeSubTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 shadow-sm">
            <Search size={16} className="text-slate-400 ml-1" />
            <input
              type="text"
              placeholder="Search suppliers by firm name, contact person or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Suppliers Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="py-3 px-4">Vendor Firm / Company</th>
                    <th className="py-3 px-4">Contact Person</th>
                    <th className="py-3 px-4">Phone / Email</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4">Balance Payable</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredSuppliers.map((s) => {
                    const hasDue = (s.balance || 0) > 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-black text-xs">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm block">{s.name}</span>
                              {s.address && <p className="text-[10px] text-slate-400">{s.address}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {s.contactPerson || '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {s.phone && <p>{s.phone}</p>}
                          {s.email && <p className="text-[10px] text-slate-400">{s.email}</p>}
                          {!s.phone && !s.email && '-'}
                        </td>
                        <td className="py-3 px-4 font-mono uppercase text-slate-600 dark:text-slate-400">
                          {s.gstin || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {hasDue ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                              {cur}{formatCurrency(s.balance || 0)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">Settled</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasDue && (
                              <button
                                onClick={() => {
                                  setPaymentOutSupplier(s);
                                  setPaymentOutAmount((s.balance || 0).toString());
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 rounded-lg text-xs font-bold"
                              >
                                Pay Out
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Supplier"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplierRecord(s)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete Supplier"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        No suppliers found matching your query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. INWARD PURCHASE INVOICES (PURCHASE BILLS) */}
      {/* ========================================================= */}
      {activeSubTab === 'purchases' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Inward Purchase Invoices</h3>
                <p className="text-xs text-slate-500">Inventory addition &amp; Input Tax Credit (ITC) log</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="py-3 px-4">Bill No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier / Vendor</th>
                    <th className="py-3 px-4">Items Inward</th>
                    <th className="py-3 px-4 text-right">Taxable Subtotal</th>
                    <th className="py-3 px-4 text-right">GST (ITC)</th>
                    <th className="py-3 px-4 text-right">Total Bill</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {purchaseBills.map((pb) => (
                    <tr key={pb.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {pb.billNo}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {formatDate(pb.date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{pb.supplierName}</span>
                        {pb.supplierGstin && (
                          <span className="text-[10px] text-slate-400 font-mono">GST: {pb.supplierGstin}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {pb.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {cur}{formatCurrency(pb.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {cur}{formatCurrency(pb.taxAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {cur}{formatCurrency(pb.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pb.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}>
                          {pb.paymentStatus === 'paid' ? `Paid (${pb.paymentMode?.toUpperCase()})` : 'Unpaid (Credit)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {purchaseBills.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No purchase bills recorded yet. Click &quot;+ Record Purchase Bill&quot; to add inventory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. RECORD INWARD PURCHASE BILL MODAL (Vyapar / MyBillBook) */}
      {/* ========================================================= */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-3xl p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Receipt size={18} />
                </span>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Record Inward Purchase Bill (Stock Inward)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Enter supplier bill details to automatically increment inventory stock &amp; log ITC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Bill Header Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Select Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  {db.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Supplier Bill / Invoice # *</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-901"
                  value={purchaseBillNo}
                  onChange={(e) => setPurchaseBillNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Purchase Date *</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>

            {/* Inward Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Purchased Items (Will Add to Stock):
                </span>
                <button
                  type="button"
                  onClick={addPurchaseItemRow}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5">Item Name / From Catalog</th>
                      <th className="p-2.5 w-24">Qty</th>
                      <th className="p-2.5 w-20">Unit</th>
                      <th className="p-2.5 w-28">Buy Rate ({cur})</th>
                      <th className="p-2.5 w-24">GST %</th>
                      <th className="p-2.5 text-right w-28">Total ({cur})</th>
                      <th className="p-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {purchaseItems.map((item, idx) => (
                      <tr key={item.id || `${item.productId || 'row'}_${idx}`} className="bg-white dark:bg-slate-900">
                        <td className="p-2">
                          <select
                            value={item.productId || ''}
                            onChange={(e) => updatePurchaseItem(idx, 'productId', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-xs font-medium"
                          >
                            <option value="">-- Choose Catalog Product --</option>
                            {db.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updatePurchaseItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-center font-bold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updatePurchaseItem(idx, 'unit', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-center uppercase text-[10px]"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={item.costPrice}
                            onChange={(e) => updatePurchaseItem(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-right font-bold"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.gstPct || 0}
                            onChange={(e) => updatePurchaseItem(idx, 'gstPct', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-center"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-black">
                          {cur}{formatCurrency(item.totalAmount)}
                        </td>
                        <td className="p-2 text-center">
                          {purchaseItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePurchaseItemRow(idx)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment & Settlement Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Payment Status:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPurchasePaymentStatus('paid')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      purchasePaymentStatus === 'paid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200'
                    }`}
                  >
                    Paid Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasePaymentStatus('unpaid')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      purchasePaymentStatus === 'unpaid'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200'
                    }`}
                  >
                    Credit / Unpaid
                  </button>
                </div>
              </div>

              {purchasePaymentStatus === 'paid' && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Paid Via Mode:</label>
                  <select
                    value={purchasePaymentMode}
                    onChange={(e) => setPurchasePaymentMode(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value="bank">Bank / NEFT / IMPS</option>
                    <option value="upi">UPI / QR</option>
                    <option value="cash">Cash from Register</option>
                  </select>
                </div>
              )}
            </div>

            {/* Bill Summary Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="text-slate-500 font-medium">
                {purchaseItems.length} items entered. Stock will be auto-incremented.
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Total Inward Value</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {cur}{formatCurrency(purchaseItems.reduce((acc, i) => acc + i.totalAmount, 0))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSavePurchaseBill}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md transition-all active:scale-95"
                >
                  Save &amp; Inward Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment-Out Modal */}
      {paymentOutSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Record Payment Out</h4>
                <p className="text-xs text-slate-500">To: <strong>{paymentOutSupplier.name}</strong></p>
              </div>
              <button onClick={() => setPaymentOutSupplier(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex justify-between items-center text-xs">
              <span className="text-amber-800 dark:text-amber-300 font-semibold">Total Payable Due:</span>
              <span className="text-base font-black text-amber-800 dark:text-amber-400">
                {cur}{formatCurrency(paymentOutSupplier.balance || 0)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Amount Paid ({cur}) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={paymentOutAmount}
                  onChange={(e) => setPaymentOutAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-slate-900 dark:text-white text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Payment Mode</label>
                <select
                  value={paymentOutMode}
                  onChange={(e) => setPaymentOutMode(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                >
                  <option value="bank">Bank / IMPS / NEFT</option>
                  <option value="upi">UPI Transfer</option>
                  <option value="cash">Petty Cash from Register</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Reference Note</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared invoice PB-881 via Net Banking"
                  value={paymentOutNote}
                  onChange={(e) => setPaymentOutNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPaymentOutSupplier(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPaymentOut}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Confirm Payment Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Truck size={18} className="text-blue-600 dark:text-indigo-400" />
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Vendor Company / Firm Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Metro Wholesale Distributors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Gupta"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">GSTIN</label>
                  <input
                    type="text"
                    placeholder="GSTIN number"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Office / Warehouse Address</label>
                <input
                  type="text"
                  placeholder="e.g. Godown #12, APMC Market"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Current Balance Payable ({cur})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSupplierRecord}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
