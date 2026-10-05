/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Tag,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  Percent,
  X,
  LayoutGrid,
  List,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  DollarSign,
  Receipt,
  Layers,
  Check,
  Camera,
  MessageSquare,
  Printer,
  UserPlus,
  FileText,
  PercentSquare,
  Loader2,
} from 'lucide-react';
import { AppDatabase, Product, Sale, CartItem, Customer, Staff } from '../types';
import { formatCurrency, generateUpiQrDataUrl, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { sound } from '../services/soundService';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface POSProps {
  db: AppDatabase;
  onSaveSale: (sale: Sale) => Promise<Sale> | Promise<void> | void | Sale;
  onOpenReceiptModal: (sale: Sale) => void;
  activeStaff: Staff | null;
  onCartCountChange?: (count: number) => void;
  onOpenScanner?: () => void;
  scannedProductToAdd?: { product: Product; key: number } | null;
}

export const POS: React.FC<POSProps> = ({
  db,
  onSaveSale,
  onOpenReceiptModal,
  activeStaff,
  onCartCountChange,
  onOpenScanner,
  scannedProductToAdd,
}) => {
  const { t } = useLocalization();
  const { alert, toast, confirm } = useDialog();

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  // New customer quick-add fields
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustOpeningBalance, setNewCustOpeningBalance] = useState('0');

  // Mobile layout state
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'compact'>('grid');

  // Bill type (MyBillBook style)
  const [billType, setBillType] = useState<'sale' | 'estimate' | 'challan'>('sale');

  // Round-off toggle (MyBillBook style)
  const [autoRoundOff, setAutoRoundOff] = useState(true);

  // Discount state
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // Payment & Tender modal
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit' | 'split'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');

  // Suspended / Held Carts
  const [heldCarts, setHeldCarts] = useState<{ id: string; time: string; customer: string; items: CartItem[] }[]>([]);

  // Continuous Barcode Scanner state
  const [isContinuousScannerOpen, setIsContinuousScannerOpen] = useState(false);

  // Loyalty rewards redemption state
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  // Handle scanned product incoming from App-level scanner
  useEffect(() => {
    if (scannedProductToAdd && scannedProductToAdd.product) {
      addToCart(scannedProductToAdd.product);
      sound.beep();
    }
  }, [scannedProductToAdd]);

  // Reset redeemed points when selected customer changes
  useEffect(() => {
    setPointsToRedeem(0);
  }, [selectedCustomer]);

  // Custom Item Modal
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const cur = db.settings.currency || '₹';

  // Prevent duplicate bill creation and double-taps
  const isProcessingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync cart count with parent for bottom navigation badge
  useEffect(() => {
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    onCartCountChange?.(totalCount);
  }, [cart, onCartCountChange]);

  // Listen for hardware back button to dismiss top-most POS modal or cart drawer
  useEffect(() => {
    const handleBack = (e: Event) => {
      if (isCheckoutModalOpen) {
        e.preventDefault();
        setIsCheckoutModalOpen(false);
      } else if (isDiscountModalOpen) {
        e.preventDefault();
        setIsDiscountModalOpen(false);
      } else if (isCustomItemModalOpen) {
        e.preventDefault();
        setIsCustomItemModalOpen(false);
      } else if (isAddCustomerModalOpen) {
        e.preventDefault();
        setIsAddCustomerModalOpen(false);
      } else if (isMobileCartOpen) {
        e.preventDefault();
        setIsMobileCartOpen(false);
      }
    };
    window.addEventListener('hardwareBackButton', handleBack);
    return () => window.removeEventListener('hardwareBackButton', handleBack);
  }, [
    isCheckoutModalOpen,
    isDiscountModalOpen,
    isCustomItemModalOpen,
    isAddCustomerModalOpen,
    isMobileCartOpen,
  ]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    db.products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [db.products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return db.products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [db.products, selectedCategory, searchQuery]);

  // Quick helper to check if product is in cart
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      if (item.productId) map.set(item.productId, item.qty);
    });
    return map;
  }, [cart]);

  // Add to cart
  const addToCart = (product: Product) => {
    sound.beep();
    sound.vibrate(25);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          price: product.price ?? product.sellPrice ?? 0,
          qty: 1,
          unit: product.unit || 'pcs',
          mrp: product.mrp,
          cost: product.cost ?? product.buyPrice ?? 0,
          gstPct: product.gstPct,
          hsn: product.hsn,
        },
      ];
    });
    toast(`Added ${product.name}`, 'success');
  };

  const updateQty = (index: number, newQty: number) => {
    sound.vibrate(15);
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, qty: newQty } : item)));
  };

  const updateQtyByProductId = (productId: string, delta: number) => {
    sound.vibrate(15);
    setCart((prev) => {
      const itemIndex = prev.findIndex((i) => i.productId === productId);
      if (itemIndex === -1) return prev;
      const item = prev[itemIndex];
      const nextQty = item.qty + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== itemIndex);
      }
      return prev.map((i, idx) => (idx === itemIndex ? { ...i, qty: nextQty } : i));
    });
  };

  const removeFromCart = (index: number) => {
    sound.vibrate(20);
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = async () => {
    if (cart.length === 0) return;
    const ok = await confirm('Are you sure you want to clear the current cart?', 'Clear Cart');
    if (ok) {
      setCart([]);
      setSelectedCustomer(null);
      setDiscountValue(0);
      toast('Cart cleared', 'info');
    }
  };

  // Hold current cart
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const cust = selectedCustomer ? selectedCustomer.name : 'Walk-in';
    setHeldCarts((prev) => [
      ...prev,
      {
        id: `held_${Date.now()}`,
        time: timeStr,
        customer: cust,
        items: [...cart],
      },
    ]);
    setCart([]);
    setSelectedCustomer(null);
    setDiscountValue(0);
    toast('Cart held. Serving next customer.', 'info');
  };

  // Recall held cart
  const handleRecallCart = (heldId: string) => {
    const target = heldCarts.find((h) => h.id === heldId);
    if (!target) return;
    setCart(target.items);
    setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));
    toast(`Restored order for ${target.customer}`, 'success');
  };

  // Add custom manual item
  const handleAddCustomItem = () => {
    const pr = parseFloat(customPrice);
    const qt = parseFloat(customQty) || 1;
    if (!customName.trim() || isNaN(pr) || pr <= 0) {
      alert('Please enter a valid item name and price.', 'Invalid Item');
      return;
    }
    const customItem: CartItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `custom_${Date.now()}`,
      productId: `custom_${Date.now()}`,
      name: customName.trim(),
      price: pr,
      qty: qt,
      unit: 'pcs',
    };
    setCart((prev) => [...prev, customItem]);
    setIsCustomItemModalOpen(false);
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    toast(`Added "${customItem.name}"`, 'success');
  };

  // Save new quick customer
  const handleSaveQuickCustomer = () => {
    if (!newCustName.trim()) {
      alert('Customer name is required', 'Validation Error');
      return;
    }
    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      balance: parseFloat(newCustOpeningBalance) || 0,
    };
    db.customers.push(newCust);
    setSelectedCustomer(newCust);
    setIsAddCustomerModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustOpeningBalance('0');
    toast(`Party ${newCust.name} added and selected`, 'success');
  };

  // Handle direct barcode search entry (Enter key)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = db.products.find(
        (p) =>
          p.barcode?.toLowerCase() === q ||
          p.sku?.toLowerCase() === q ||
          p.name.toLowerCase() === q
      );
      if (match) {
        addToCart(match);
        setSearchQuery('');
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  // Continuous Camera Barcode Scan Handler
  const handleContinuousScanItem = (code: string) => {
    const q = code.trim().toLowerCase();
    const match = db.products.find(
      (p) =>
        p.barcode?.toLowerCase() === q ||
        p.sku?.toLowerCase() === q
    );
    if (match) {
      addToCart(match);
      sound.beep();
      toast(`Added "${match.name}" to cart`, 'success');
    } else {
      sound.warningTone();
      toast(`Barcode "${code}" not found in inventory`, 'warning');
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * (discountValue || 0)) / 100;
    }
    return Math.min(subtotal, discountValue || 0);
  }, [subtotal, discountType, discountValue]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  // Loyalty Points calculations (1 pt per ₹100 spent, 1 pt = ₹1 discount)
  const loyaltyPointValue = db.settings?.loyaltyPointValue || 1;
  const maxRedeemablePoints = useMemo(() => {
    if (!db.settings?.loyaltyEnabled || !selectedCustomer) return 0;
    const available = selectedCustomer.loyaltyPoints || 0;
    const maxDiscountAllowed = Math.floor(discountedSubtotal);
    return Math.min(available, Math.max(0, Math.floor(maxDiscountAllowed / loyaltyPointValue)));
  }, [db.settings?.loyaltyEnabled, selectedCustomer, discountedSubtotal, loyaltyPointValue]);

  const activePointsRedeemed = Math.min(pointsToRedeem, maxRedeemablePoints);
  const loyaltyDiscountAmount = activePointsRedeemed * loyaltyPointValue;

  const finalDiscountedSubtotal = Math.max(0, discountedSubtotal - loyaltyDiscountAmount);

  const gstAmount = useMemo(() => {
    if (!db.settings.gstEnabled) return 0;
    const defaultRate = db.settings.defaultGstPct || 0;
    return (finalDiscountedSubtotal * defaultRate) / 100;
  }, [finalDiscountedSubtotal, db.settings.gstEnabled, db.settings.defaultGstPct]);

  const rawTotal = finalDiscountedSubtotal + gstAmount;

  // Round-off calculation
  const roundOffDifference = useMemo(() => {
    if (!autoRoundOff) return 0;
    const rounded = Math.round(rawTotal);
    return rounded - rawTotal;
  }, [rawTotal, autoRoundOff]);

  const grandTotal = useMemo(() => {
    if (autoRoundOff) {
      return Math.round(rawTotal);
    }
    return Math.round(rawTotal * 100) / 100;
  }, [rawTotal, autoRoundOff]);

  const pointsEarnedOnThisSale = useMemo(() => {
    if (!db.settings?.loyaltyEnabled || !selectedCustomer) return 0;
    const spendPerPoint = db.settings.loyaltyPointsPerSpend || 100;
    return Math.floor(grandTotal / spendPerPoint);
  }, [db.settings?.loyaltyEnabled, db.settings?.loyaltyPointsPerSpend, selectedCustomer, grandTotal]);

  const totalItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Open Checkout Modal
  const handleOpenCheckout = async (method: 'cash' | 'upi' | 'card' | 'credit' | 'split') => {
    if (cart.length === 0) return;
    setPaymentMethod(method);
    setCashTendered(grandTotal.toString());
    setSplitCash(Math.round(grandTotal / 2));
    setSplitUpi(Math.round(grandTotal - Math.round(grandTotal / 2)));

    if (method === 'upi' && (db.settings.upi || db.settings.upiId)) {
      try {
        const qr = await generateUpiQrDataUrl({
          upiId: db.settings.upi || db.settings.upiId || '',
          payeeName: db.settings.shopName || 'ShopPOS Store',
          amount: grandTotal,
          width: 220,
        });
        setUpiQrUrl(qr);
      } catch (err) {
        console.error('UPI QR generation error:', err);
      }
    }

    setIsCheckoutModalOpen(true);
  };

  // Complete Sale
  const handleCompleteSale = async (andShareWhatsApp = false) => {
    // Prevent duplicate bill creation from rapid double-taps
    if (isProcessingRef.current || isProcessing) return;
    if (cart.length === 0) return;

    if (paymentMethod === 'credit' && !selectedCustomer) {
      alert('Please select or create a customer to record Credit (Udhaar) sales.', 'Customer Required');
      return;
    }

    // Re-check stock for every cart item to prevent overselling (unless "Allow negative stock" enabled in Settings)
    const allowNegative = db.settings.allowNegativeStock === true;
    if (!allowNegative) {
      for (const item of cart) {
        if (!item.productId) continue;
        const prod = db.products.find((p) => p.id === item.productId);
        const availableStock = prod ? (prod.stock ?? prod.qty ?? 0) : 0;
        if (item.qty > availableStock) {
          alert(
            `Insufficient stock for "${item.name}". Available: ${availableStock} ${item.unit || 'pcs'}, but cart contains ${item.qty}. Please adjust quantity or enable "Allow Negative Stock" in Settings.`,
            'Insufficient Stock'
          );
          return;
        }
      }
    }

    try {
      isProcessingRef.current = true;
      setIsProcessing(true);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Use crypto.randomUUID() for high-entropy unique sale ids
      const saleId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sale_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const newSale: Sale = {
        id: saleId,
        billNo: 0, // Assigned atomically in updateDB inside App.tsx
        date: dateStr,
        time: timeStr,
        customerId: selectedCustomer?.id || undefined,
        customer: selectedCustomer?.name || 'Walk-In Customer',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: selectedCustomer?.address || '',
        items: cart,
        subtotal,
        discount: discountAmount + loyaltyDiscountAmount,
        discountPct: discountType === 'percent' ? discountValue : 0,
        gst: gstAmount,
        gstPct: db.settings.gstEnabled ? db.settings.defaultGstPct || 0 : 0,
        total: grandTotal,
        paymentMethod,
        pointsRedeemed: activePointsRedeemed > 0 ? activePointsRedeemed : undefined,
        pointsEarned: pointsEarnedOnThisSale > 0 ? pointsEarnedOnThisSale : undefined,
        splitDetails:
          paymentMethod === 'split'
            ? { cashAmount: splitCash, upiAmount: splitUpi }
            : undefined,
        tendered: paymentMethod === 'cash' ? parseFloat(cashTendered) || grandTotal : grandTotal,
        change:
          paymentMethod === 'cash'
            ? Math.max(0, (parseFloat(cashTendered) || grandTotal) - grandTotal)
            : 0,
        staffId: activeStaff?.id || 'admin',
        staffName: activeStaff?.name || 'Admin',
        branchId: db.activeBranchId || undefined,
        creditPaid: paymentMethod !== 'credit',
      };

      sound.successChime();
      sound.vibrate([30, 60, 30]);

      // Atomically save and increment bill number in App.tsx
      const savedSale = await onSaveSale(newSale);
      const finalBillNo = (savedSale as Sale | undefined)?.billNo || db.meta?.billNo || 1;

      setIsCheckoutModalOpen(false);
      setIsMobileCartOpen(false);

      // Save & share on WhatsApp directly
      if (andShareWhatsApp) {
        const custPhone = (selectedCustomer?.phone || '').replace(/\D/g, '');
        const itemsList = cart.map((i) => `• ${i.name} (x${i.qty}) - ${cur}${formatCurrency(i.qty * i.price)}`).join('\n');
        const msg = `*Invoice #${finalBillNo} from ${db.settings.shopName || 'Our Store'}*\n` +
          `Date: ${formatDate(dateStr)}\n` +
          `Items:\n${itemsList}\n` +
          `*Total: ${cur}${formatCurrency(grandTotal)}*\n` +
          `Payment Mode: ${paymentMethod.toUpperCase()}\n` +
          `\nThank you for shopping with us!`;

        sendWhatsAppMessage({
          phone: custPhone,
          text: msg,
          title: `Invoice #${finalBillNo}`,
        });
      }

      setCart([]);
      setSelectedCustomer(null);
      setDiscountValue(0);
      setPointsToRedeem(0);
      toast(`Invoice #${finalBillNo} generated successfully!`, 'success');
      onOpenReceiptModal((savedSale as Sale | undefined) || { ...newSale, billNo: finalBillNo });
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - grandTotal);

  // Cart Content Component (Reused on desktop right pane & mobile drawer)
  const renderCartPanel = (isMobileDrawer = false) => (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${isMobileDrawer ? 'p-0' : 'select-none'}`}>
      {/* Cart Header */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isMobileDrawer && (
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg bg-slate-200 dark:bg-slate-800 mr-1"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="p-1.5 bg-blue-50 text-blue-600 dark:bg-indigo-600/20 dark:text-indigo-400 border border-blue-200 dark:border-indigo-500/20 rounded-xl">
            <ShoppingBag size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                Bill #{db.meta?.billNo || 1}
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold uppercase">
                {billType.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in docket
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="pos-hold-cart-btn"
            onClick={handleHoldCart}
            disabled={cart.length === 0}
            className="p-2 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 disabled:opacity-30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Hold / Suspend Bill"
          >
            <Pause size={17} />
          </button>
          <button
            id="pos-clear-cart-btn"
            onClick={clearCart}
            disabled={cart.length === 0}
            className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 disabled:opacity-30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Clear Cart"
          >
            <RotateCcw size={17} />
          </button>
          {isMobileDrawer && (
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 ml-1"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Customer Selector (MyBillBook style Party Bar with Khata balance) */}
      <div className="px-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80">
        <div className="relative">
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">{selectedCustomer.name}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{selectedCustomer.phone || 'No phone'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedCustomer.balance && selectedCustomer.balance > 0 ? (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-500/15 dark:border-rose-500/30 px-2 py-0.5 rounded-full">
                    Khata Due: {cur}{formatCurrency(selectedCustomer.balance)}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/15 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                    No Dues
                  </span>
                )}
                {db.settings?.loyaltyEnabled && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/15 dark:border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={10} />
                    {selectedCustomer.loyaltyPoints || 0} pts
                  </span>
                )}
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                id="pos-select-customer-btn"
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                className="flex-1 flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <UserCheck size={15} className="text-blue-600 dark:text-indigo-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Customer: Walk-In</span>
                </div>
                <span className="text-[10px] text-blue-600 dark:text-indigo-400 font-bold">Select Party &rarr;</span>
              </button>

              <button
                onClick={() => setIsAddCustomerModalOpen(true)}
                className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 border border-blue-200 dark:border-indigo-500/30 text-blue-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                title="Add New Customer"
              >
                <UserPlus size={14} />
                <span className="hidden sm:inline">+ Party</span>
              </button>

              {isCustomerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 z-30 max-h-60 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Search party by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {db.customers
                    .filter(
                      (c) =>
                        !customerSearch ||
                        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        (c.phone && c.phone.includes(customerSearch))
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearch('');
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs text-slate-900 dark:text-white transition-colors"
                      >
                        <div>
                          <span className="font-bold block">{c.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{c.phone || 'No phone'}</span>
                        </div>
                        {c.balance && c.balance > 0 ? (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full">
                            Due: {cur}{c.balance}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                    <button
                      onClick={() => {
                        setIsCustomerDropdownOpen(false);
                        setIsAddCustomerModalOpen(true);
                      }}
                      className="py-1 text-xs text-blue-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      + Create New Party
                    </button>
                    <button
                      onClick={() => {
                        setIsCustomerDropdownOpen(false);
                        setCustomerSearch('');
                      }}
                      className="py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs py-10 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600">
              <ShoppingBag size={28} />
            </div>
            <p className="font-bold text-slate-700 dark:text-slate-400 text-sm">Docket is empty</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500 max-w-[220px] text-center">
              Scan barcode or tap products from catalog to start fast billing
            </p>
          </div>
        ) : (
          cart.map((item, index) => {
            const itemTotal = item.price * item.qty;
            return (
              <div
                key={item.id || `${item.productId || 'cart'}_${index}`}
                className="p-2.5 bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/60 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs transition-colors shadow-sm"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white truncate block">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-slate-500 dark:text-slate-400 text-[11px]">
                    <span className="font-bold text-blue-600 dark:text-indigo-300">
                      {cur}{formatCurrency(item.price)}
                    </span>
                    <span>× {item.qty} {item.unit}</span>
                  </div>
                </div>

                {/* Quantity Stepper & Delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-0.5 shadow-sm">
                    <button
                      onClick={() => updateQty(index, item.qty - 1)}
                      className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center font-extrabold text-slate-900 dark:text-white text-xs">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(index, item.qty + 1)}
                      className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <span className="font-black text-sm text-slate-900 dark:text-white w-16 text-right">
                    {cur}{formatCurrency(itemTotal)}
                  </span>

                  <button
                    onClick={() => removeFromCart(index)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Footer / Totals & Checkout */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800/90 space-y-3">
        {/* Discount & Round-Off Controls */}
        <div className="flex items-center justify-between text-xs">
          <button
            id="pos-open-discount-btn"
            onClick={() => setIsDiscountModalOpen(true)}
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold"
          >
            <Tag size={14} />
            <span>
              {discountAmount > 0
                ? `Discount: -${cur}${formatCurrency(discountAmount)} (${discountType === 'percent' ? `${discountValue}%` : 'Flat'})`
                : '+ Add Bill Discount'}
            </span>
          </button>

          {/* Auto Round-Off Checkbox */}
          <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRoundOff}
              onChange={(e) => setAutoRoundOff(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-[11px]">Round Off</span>
          </label>
        </div>

        {/* Totals Breakdown */}
        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
          <div className="flex justify-between">
            <span>Subtotal ({totalItemCount} items):</span>
            <span className="text-slate-900 dark:text-slate-200 font-semibold">{cur}{formatCurrency(subtotal)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount applied:</span>
              <span className="font-bold">-{cur}{formatCurrency(discountAmount)}</span>
            </div>
          )}

          {db.settings.gstEnabled && (
            <div className="flex justify-between">
              <span>GST ({db.settings.defaultGstPct || 0}%):</span>
              <span className="text-slate-900 dark:text-slate-200 font-semibold">{cur}{formatCurrency(gstAmount)}</span>
            </div>
          )}

          {autoRoundOff && roundOffDifference !== 0 && (
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Round Off difference:</span>
              <span>{roundOffDifference > 0 ? `+${cur}${formatCurrency(roundOffDifference)}` : `-${cur}${formatCurrency(Math.abs(roundOffDifference))}`}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
            <span className="text-sm font-black text-slate-900 dark:text-white">Grand Total:</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {cur}{formatCurrency(grandTotal)}
            </span>
          </div>
        </div>

        {/* Payment Quick Actions (Cash, UPI QR, Card, Udhaar) */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            id="pos-pay-cash-btn"
            onClick={() => handleOpenCheckout('cash')}
            disabled={cart.length === 0}
            className="flex flex-col items-center justify-center p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl font-bold text-xs transition-all shadow-sm active:scale-95 border border-emerald-400/20"
          >
            <Banknote size={17} className="mb-0.5 text-emerald-100" />
            <span>Cash</span>
          </button>

          <button
            id="pos-pay-upi-btn"
            onClick={() => handleOpenCheckout('upi')}
            disabled={cart.length === 0}
            className="flex flex-col items-center justify-center p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-2xl font-bold text-xs transition-all shadow-sm active:scale-95 border border-cyan-400/20"
          >
            <QrCode size={17} className="mb-0.5 text-cyan-100" />
            <span>UPI QR</span>
          </button>

          <button
            id="pos-pay-card-btn"
            onClick={() => handleOpenCheckout('card')}
            disabled={cart.length === 0}
            className="flex flex-col items-center justify-center p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl font-bold text-xs transition-all shadow-sm active:scale-95 border border-blue-400/20"
          >
            <CreditCard size={17} className="mb-0.5 text-blue-100" />
            <span>Card</span>
          </button>

          <button
            id="pos-pay-credit-btn"
            onClick={() => handleOpenCheckout('credit')}
            disabled={cart.length === 0}
            className="flex flex-col items-center justify-center p-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-2xl font-bold text-xs transition-all shadow-sm active:scale-95 border border-amber-400/20"
            title="Customer Udhaar / Credit Ledger"
          >
            <UserCheck size={17} className="mb-0.5 text-amber-100" />
            <span>Udhaar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div id="pos-billing-screen" className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative">
      {/* Left / Center Product Catalog Pane */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800/80 overflow-hidden pb-20 lg:pb-0">
        {/* Top Billing Bar (Bill Type Switcher & Rapid Search) */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          {/* Bill Type Selector (MyBillBook style) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setBillType('sale')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billType === 'sale'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Sales Invoice
            </button>
            <button
              onClick={() => setBillType('estimate')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billType === 'estimate'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Quotation
            </button>
            <button
              onClick={() => setBillType('challan')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billType === 'challan'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Challan
            </button>
          </div>

          {/* Rapid Search Bar with integrated Barcode Scan Icon */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="pos-search-input"
              type="text"
              placeholder="Scan barcode or type item name / SKU [Enter to add]..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-16 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                id="pos-camera-scanner-btn"
                onClick={() => setIsContinuousScannerOpen(true)}
                className="p-1 text-blue-600 dark:text-indigo-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Continuous Barcode Scanner"
              >
                <Camera size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Continuous Scan Mode Action Button */}
            <button
              type="button"
              id="pos-continuous-scan-btn"
              onClick={() => setIsContinuousScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-indigo-400 font-bold text-xs rounded-2xl border border-blue-200 dark:border-slate-700 transition-colors shadow-sm shrink-0 cursor-pointer"
              title="Continuous Scan: Keep camera open and scan items until Done"
            >
              <Camera size={15} />
              <span className="hidden sm:inline">Continuous Scan</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5">
              <button
                onClick={() => setCatalogViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  catalogViewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setCatalogViewMode('compact')}
                className={`p-1.5 rounded-lg transition-colors ${
                  catalogViewMode === 'compact'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
                title="List View"
              >
                <List size={15} />
              </button>
            </div>

            {/* Custom Item Button */}
            <button
              id="pos-add-custom-item-btn"
              onClick={() => setIsCustomItemModalOpen(true)}
              className="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm"
            >
              <Plus size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">+ Custom Item</span>
              <span className="sm:hidden">+ Custom</span>
            </button>

            {/* Recall Held Orders Dropdown */}
            {heldCarts.length > 0 && (
              <div className="relative group">
                <button
                  id="pos-recall-cart-btn"
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 text-xs font-black rounded-xl transition-all shadow-sm"
                >
                  <Play size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>Held ({heldCarts.length})</span>
                </button>
                <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 hidden group-hover:block z-30">
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider">
                    Resume Suspended Order
                  </p>
                  {heldCarts.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleRecallCart(h.id)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center text-xs transition-colors"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{h.customer}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{h.time} • {h.items.length} items</p>
                      </div>
                      <span className="text-blue-600 dark:text-indigo-400 font-bold text-[11px]">Resume &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="px-3 sm:px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/60 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  sound.vibrate(10);
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Catalog Product Grid / List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16 space-y-2 text-center">
              <Layers size={36} className="text-slate-400 dark:text-slate-600" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-400">No matching products found</p>
              <p className="text-xs text-slate-500">
                Try searching with another term, barcode, or switch categories
              </p>
            </div>
          ) : catalogViewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
              {filteredProducts.map((p) => {
                const inCartQty = cartQtyMap.get(p.id) || 0;
                const stockLevel = p.stock ?? p.qty ?? 0;
                const isLowStock = stockLevel <= (db.settings.lowStockDefault || 10);
                const isOutOfStock = stockLevel <= 0;

                return (
                  <div
                    key={p.id}
                    id={`pos-product-card-${p.id}`}
                    onClick={() => {
                      if (!isOutOfStock) addToCart(p);
                    }}
                    className={`group relative rounded-2xl border p-3 flex flex-col justify-between transition-all duration-150 select-none cursor-pointer shadow-sm hover:shadow-md ${
                      inCartQty > 0
                        ? 'bg-blue-50/50 border-blue-400 dark:bg-indigo-950/30 dark:border-indigo-500/50'
                        : 'bg-white hover:bg-slate-50 dark:bg-slate-900/80 dark:hover:bg-slate-800/90 border-slate-200 dark:border-slate-800 hover:border-blue-300'
                    } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'}`}
                  >
                    <div>
                      {/* Top Badges: Category & Stock */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {p.category || 'General'}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/20">
                            Out
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/20">
                            {stockLevel} left
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                            {stockLevel} {p.unit || 'pcs'}
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-white line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400 tracking-tight block">
                          {cur}{formatCurrency(p.price ?? p.sellPrice ?? 0)}
                        </span>
                        {p.mrp && p.mrp > (p.price ?? p.sellPrice ?? 0) && (
                          <span className="text-[10px] text-slate-400 line-through">
                            {cur}{p.mrp}
                          </span>
                        )}
                      </div>

                      {/* In-Cart Stepper on Card */}
                      {inCartQty > 0 ? (
                        <div
                          className="flex items-center bg-blue-600 dark:bg-indigo-600 rounded-xl p-0.5 shadow-sm text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updateQtyByProductId(p.id, -1)}
                            className="w-5 h-5 flex items-center justify-center hover:bg-blue-700 rounded-md transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-5 text-center font-black text-xs">
                            {inCartQty}
                          </span>
                          <button
                            onClick={() => updateQtyByProductId(p.id, 1)}
                            className="w-5 h-5 flex items-center justify-center hover:bg-blue-700 rounded-md transition-colors"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isOutOfStock}
                          className="px-2 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 dark:text-slate-300 dark:hover:text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact List View */
            <div className="space-y-1.5">
              {filteredProducts.map((p) => {
                const inCartQty = cartQtyMap.get(p.id) || 0;
                const stockLevel = p.stock ?? p.qty ?? 0;
                const isOutOfStock = stockLevel <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isOutOfStock) addToCart(p);
                    }}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                      inCartQty > 0
                        ? 'bg-blue-50/50 border-blue-400 dark:bg-indigo-950/30 dark:border-indigo-500/40'
                        : 'bg-white hover:bg-slate-50 dark:bg-slate-900/80 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800/80'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{p.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {p.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Stock: {stockLevel} {p.unit || 'pcs'}</span>
                        {p.barcode && <span className="font-mono text-slate-400">#{p.barcode}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {cur}{formatCurrency(p.price ?? p.sellPrice ?? 0)}
                      </span>

                      {inCartQty > 0 ? (
                        <div
                          className="flex items-center bg-blue-600 dark:bg-indigo-600 text-white rounded-xl p-0.5 shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updateQtyByProductId(p.id, -1)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-blue-700 rounded-md"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center font-extrabold text-xs">
                            {inCartQty}
                          </span>
                          <button
                            onClick={() => updateQtyByProductId(p.id, 1)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-blue-700 rounded-md"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isOutOfStock}
                          className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 dark:text-slate-300 dark:hover:text-white font-bold text-xs transition-colors"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Sticky Floating Cart Bar (Visible on mobile screens) */}
        {cart.length > 0 && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 p-2.5 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent">
            <button
              id="mobile-view-cart-btn"
              onClick={() => {
                sound.vibrate(20);
                setIsMobileCartOpen(true);
              }}
              className="w-full p-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-between shadow-xl border border-white/20 transform active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-xl">
                  <ShoppingBag size={18} />
                </div>
                <div className="text-left">
                  <span className="block font-black leading-tight">
                    {totalItemCount} {totalItemCount === 1 ? 'Item' : 'Items'} in Docket
                  </span>
                  <span className="block text-[10px] text-blue-100 font-medium">Tap to review &amp; pay</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white">
                  {cur}{formatCurrency(grandTotal)}
                </span>
                <ChevronRight size={18} />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Right Shopping Cart Panel (Visible on Desktop / Tablets) */}
      <div className="hidden lg:flex w-[380px] xl:w-[420px] flex-col h-full select-none shadow-sm">
        {renderCartPanel(false)}
      </div>

      {/* Mobile Cart Full-Sheet Modal (Triggered on mobile screens) */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl max-h-[92vh] h-[92vh] flex flex-col border-t border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {renderCartPanel(true)}
          </div>
        </div>
      )}

      {/* Quick Add Party / Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus size={16} className="text-blue-600 dark:text-indigo-400" />
                Add New Customer / Party
              </h4>
              <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Customer / Business Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma / City Store"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Address / City</label>
                <input
                  type="text"
                  placeholder="Optional address"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Opening Khata Balance ({cur})</label>
                <input
                  type="number"
                  placeholder="0 (Positive = Customer owes you)"
                  value={newCustOpeningBalance}
                  onChange={(e) => setNewCustOpeningBalance(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuickCustomer}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Save &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Configuration Modal */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Tag size={16} className="text-blue-600 dark:text-indigo-400" />
                Apply Discount
              </h4>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setDiscountType('percent')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  discountType === 'percent' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountType('fixed')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  discountType === 'fixed' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Flat Amount ({cur})
              </button>
            </div>

            <input
              type="number"
              placeholder={discountType === 'percent' ? 'e.g. 10%' : `e.g. ${cur}50`}
              value={discountValue || ''}
              onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-black text-2xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />

            <div className="flex gap-2">
              {[5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    setDiscountType('percent');
                    setDiscountValue(pct);
                  }}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsDiscountModalOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* Custom Item Modal */}
      {isCustomItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Add Custom Item</h4>
              <button onClick={() => setIsCustomItemModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Item Description / Name</label>
                <input
                  type="text"
                  placeholder="e.g. Custom Repair / Gift Wrapping"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Price ({cur})</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Quantity</label>
                  <input
                    type="number"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAddCustomItem}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* Checkout & Settlement Modal (MyBillBook style with WhatsApp share) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Payment Settlement</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Payable: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{cur}{formatCurrency(grandTotal)}</strong></p>
              </div>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Loyalty Points Redemption & Earn Box */}
            {db.settings?.loyaltyEnabled && selectedCustomer && (
              <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 dark:text-amber-200">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>Loyalty Points (1 pt per {cur}{db.settings.loyaltyPointsPerSpend || 100} spent)</span>
                  </div>
                  <span className="text-[11px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full">
                    {selectedCustomer.loyaltyPoints || 0} pts balance
                  </span>
                </div>

                {maxRedeemablePoints > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-200/50 dark:border-amber-900/30 text-xs">
                    <div>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold block">
                        Redeem points as discount:
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        1 point = {cur}1 discount (Max: {maxRedeemablePoints} pts)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={maxRedeemablePoints}
                        value={pointsToRedeem}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(maxRedeemablePoints, parseInt(e.target.value) || 0));
                          setPointsToRedeem(val);
                        }}
                        className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-center"
                      />
                      <button
                        type="button"
                        onClick={() => setPointsToRedeem(pointsToRedeem > 0 ? 0 : maxRedeemablePoints)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold shadow-sm"
                      >
                        {pointsToRedeem > 0 ? 'Clear' : 'Redeem Max'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    No points available to redeem on this customer account yet.
                  </p>
                )}

                {activePointsRedeemed > 0 && (
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                    <span>Loyalty Discount Applied:</span>
                    <span>-{cur}{formatCurrency(loyaltyDiscountAmount)}</span>
                  </div>
                )}

                {pointsEarnedOnThisSale > 0 && (
                  <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    ★ Customer will earn <strong>+{pointsEarnedOnThisSale} points</strong> with this bill!
                  </p>
                )}
              </div>
            )}

            {/* Payment Method Switcher Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 rounded-xl font-bold transition-all ${
                  paymentMethod === 'cash' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Cash
              </button>
              <button
                onClick={() => handleOpenCheckout('upi')}
                className={`py-2 rounded-xl font-bold transition-all ${
                  paymentMethod === 'upi' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                UPI QR
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`py-2 rounded-xl font-bold transition-all ${
                  paymentMethod === 'card' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Card
              </button>
              <button
                onClick={() => setPaymentMethod('credit')}
                className={`py-2 rounded-xl font-bold transition-all ${
                  paymentMethod === 'credit' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Udhaar
              </button>
            </div>

            {/* Cash Tender Mode with Quick Chips */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Cash Tendered by Customer</label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-slate-900 dark:text-white text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                    autoFocus
                  />
                </div>

                {/* Quick Cash Tender Denomination Chips */}
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setCashTendered(grandTotal.toString())}
                    className="py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-extrabold rounded-xl text-xs hover:bg-emerald-100 transition-colors"
                  >
                    Exact ({cur}{grandTotal})
                  </button>
                  {[50, 100, 200, 500, 1000, 2000].map((amt) => {
                    if (amt < grandTotal && amt !== 100 && amt !== 500) return null;
                    return (
                      <button
                        key={amt}
                        onClick={() => setCashTendered(amt.toString())}
                        className="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors"
                      >
                        {cur}{amt}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      const rounded = Math.ceil(grandTotal / 10) * 10;
                      setCashTendered(rounded.toString());
                    }}
                    className="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors"
                  >
                    Round 10
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm shadow-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">Change to Return:</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {cur}{formatCurrency(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {/* UPI QR Payment Mode */}
            {paymentMethod === 'upi' && (
              <div className="text-center space-y-3">
                {upiQrUrl ? (
                  <div className="inline-block p-3.5 bg-white border border-slate-200 rounded-3xl shadow-xl">
                    <img src={upiQrUrl} alt="UPI QR" className="w-44 h-44 mx-auto" />
                  </div>
                ) : (
                  <div className="w-44 h-44 mx-auto bg-slate-100 dark:bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-xs text-slate-500 p-4 border border-slate-200 dark:border-slate-700">
                    <QrCode size={36} className="text-slate-400 mb-2" />
                    <span>UPI ID not configured in Settings</span>
                  </div>
                )}
                <p className="text-xs text-slate-800 dark:text-slate-300 font-bold">
                  Scan to Pay via Google Pay, PhonePe, Paytm, or BHIM
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Amount: <strong className="text-slate-900 dark:text-white font-black">{cur}{formatCurrency(grandTotal)}</strong>
                </p>
              </div>
            )}

            {/* Credit / Udhaar Ledger Mode */}
            {paymentMethod === 'credit' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-2xl text-amber-900 dark:text-amber-300">
                  <p className="font-extrabold mb-1 flex items-center gap-1.5">
                    <UserCheck size={16} />
                    Customer Credit (Udhaar) Account
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-400/90">
                    Bill amount of <strong>{cur}{formatCurrency(grandTotal)}</strong> will be added to {selectedCustomer?.name || 'Customer'}&apos;s Khata ledger.
                  </p>
                </div>
                {selectedCustomer ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl space-y-1.5 border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Current Due:</span>
                      <span className="text-slate-900 dark:text-white font-bold">{cur}{selectedCustomer.balance || 0}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700/60 pt-1">
                      <span>New Balance After This Bill:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                        {cur}{(selectedCustomer.balance || 0) + grandTotal}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs">
                    Please select a registered party from the docket to record credit sales.
                  </div>
                )}
              </div>
            )}

            {/* Split Payment Mode */}
            {paymentMethod === 'split' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Cash Portion ({cur})</label>
                  <input
                    type="number"
                    value={splitCash}
                    onChange={(e) => {
                      const c = parseFloat(e.target.value) || 0;
                      setSplitCash(c);
                      setSplitUpi(Math.max(0, grandTotal - c));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">UPI / Online Portion ({cur})</label>
                  <input
                    type="number"
                    value={splitUpi}
                    onChange={(e) => {
                      const u = parseFloat(e.target.value) || 0;
                      setSplitUpi(u);
                      setSplitCash(Math.max(0, grandTotal - u));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>
            )}

            {/* Primary Action Buttons: Print & WhatsApp */}
            <div className="space-y-2 pt-2">
              <button
                id="pos-confirm-charge-btn"
                disabled={isProcessing}
                onClick={() => handleCompleteSale(false)}
                className={`w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${
                  isProcessing ? 'pointer-events-none' : ''
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing &amp; Finalizing Bill...</span>
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    <span>Save &amp; Print Bill (#{db.meta?.billNo || 1})</span>
                  </>
                )}
              </button>

              <button
                disabled={isProcessing}
                onClick={() => handleCompleteSale(true)}
                className={`w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${
                  isProcessing ? 'pointer-events-none' : ''
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={15} />
                    <span>Save &amp; Share on WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continuous Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isContinuousScannerOpen}
        onClose={() => setIsContinuousScannerOpen(false)}
        onScan={handleContinuousScanItem}
        continuous={true}
        cartCount={totalItemCount}
      />
    </div>
  );
};
