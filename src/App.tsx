/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AppDatabase, Sale, Product, Customer, Expense, Supplier, Staff, CommercialDocument, ShopSettings, Branch, StockAdjustment, PurchaseBill } from './types';
import {
  INITIAL_DATABASE,
  getDBFromIndexedDB,
  saveDBToIndexedDB,
  saveRecord,
  saveRecords,
  deleteRecord,
  setKV,
  hashPassword,
  initIndexedDB,
  saveBatch,
} from './db';
import { Header, ActiveTab } from './components/Header';
import { POS } from './components/POS';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Customers } from './components/Customers';
import { Reports } from './components/Reports';
import { BarcodeDesigner } from './components/BarcodeDesigner';
import { Expenses } from './components/Expenses';
import { Suppliers } from './components/Suppliers';
import { StaffComponent } from './components/Staff';
import { Documents } from './components/Documents';
import { Settings } from './components/Settings';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ManualModal } from './components/ManualModal';
import { LoginModal } from './components/LoginModal';
import { AdminPinSetupModal } from './components/AdminPinSetupModal';
import { QuickSearchModal } from './components/QuickSearchModal';
import { BottomNav } from './components/BottomNav';
import { MobileMoreDrawer } from './components/MobileMoreDrawer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { sound } from './services/soundService';
import { validateBackupData, runDailyAutoBackup } from './services/nativeStorage';
import { LocalizationProvider } from './context/LocalizationContext';
import { DialogProvider, useDialog } from './context/DialogContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { toast, alert, confirm } = useDialog();

  const [db, setDb] = useState<AppDatabase>(INITIAL_DATABASE);
  const dbRef = useRef<AppDatabase>(INITIAL_DATABASE);

  // Keep dbRef synchronized with latest AppDatabase state
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    sound.enabled = next;
    setSoundEnabled(next);
    toast(next ? 'Sound effects enabled' : 'Sound effects muted', 'info');
  };

  const handleLogout = useCallback(() => {
    setActiveStaff(null);
    toast('Session locked / Logged out', 'info');
    setIsLoginOpen(true);
  }, [toast]);

  const lowStockCount = (db.products || []).filter(
    (p) => (p.stock ?? p.qty ?? 0) <= (db.settings.lowStockDefault || 10)
  ).length;

  // On first run, force the owner to set an admin PIN before the app opens
  const isFirstRun = !loading && (db.auth?.firstLogin === true || !db.auth?.pwHash);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [barcodeSelectedProductId, setBarcodeSelectedProductId] = useState<string | undefined>();
  const [scannedProductToAdd, setScannedProductToAdd] = useState<{ product: Product; key: number } | null>(null);

  // Global hotkeys (Ctrl+K or Cmd+K for Quick Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hardware back button navigation with @capacitor/app
  const lastBackPressRef = useRef<number>(0);
  const tabHistoryRef = useRef<ActiveTab[]>(['pos']);

  useEffect(() => {
    // Keep tab history synchronized
    const history = tabHistoryRef.current;
    if (history[history.length - 1] !== activeTab) {
      history.push(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: PluginListenerHandle | null = null;

    const registerBackHandler = async () => {
      try {
        listenerHandle = await CapApp.addListener('backButton', () => {
          // 1. Close the top-most open modal or drawer first
          if (receiptSale) {
            setReceiptSale(null);
            return;
          }
          if (isScannerOpen) {
            setIsScannerOpen(false);
            return;
          }
          if (isManualOpen) {
            setIsManualOpen(false);
            return;
          }
          if (isLoginOpen) {
            if (!isFirstRun) {
              setIsLoginOpen(false);
            }
            return;
          }
          if (isQuickSearchOpen) {
            setIsQuickSearchOpen(false);
            return;
          }
          if (isMobileMoreOpen) {
            setIsMobileMoreOpen(false);
            return;
          }

          // 2. Dispatch custom event to active subcomponents (e.g. POS checkout modal, cart drawer, etc.)
          const backEv = new CustomEvent('hardwareBackButton', { cancelable: true });
          const wasPrevented = !window.dispatchEvent(backEv);
          if (wasPrevented) {
            return;
          }

          // 3. Check for any generic dialog/modal close button in the DOM
          const modalCloseButton = document.querySelector<HTMLButtonElement>(
            'div.fixed.inset-0 button:has(svg.lucide-x), div[role="dialog"] button:has(svg.lucide-x)'
          );
          if (modalCloseButton) {
            modalCloseButton.click();
            return;
          }

          // 4. Then go back a tab
          if (tabHistoryRef.current.length > 1) {
            tabHistoryRef.current.pop(); // Remove active tab
            const prevTab = tabHistoryRef.current[tabHistoryRef.current.length - 1];
            if (prevTab && prevTab !== activeTab) {
              setActiveTab(prevTab);
              return;
            }
          }

          if (activeTab !== 'pos') {
            setActiveTab('pos');
            tabHistoryRef.current = ['pos'];
            return;
          }

          // 5. On the home tab ('pos'), show "Press back again to exit" and exit on a second press within 2 seconds
          const now = Date.now();
          if (now - lastBackPressRef.current < 2000) {
            CapApp.exitApp();
          } else {
            lastBackPressRef.current = now;
            toast('Press back again to exit', 'info');
          }
        });
      } catch (err) {
        console.warn('Could not register hardware back button listener:', err);
      }
    };

    registerBackHandler();

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
    };
  }, [
    receiptSale,
    isScannerOpen,
    isManualOpen,
    isLoginOpen,
    isFirstRun,
    isQuickSearchOpen,
    isMobileMoreOpen,
    activeTab,
    toast,
  ]);

  // Load database from IndexedDB on initial mount
  useEffect(() => {
    async function loadData() {
      let loadedDb: AppDatabase | null = null;
      try {
        const stored = await getDBFromIndexedDB();
        if (stored) {
          loadedDb = stored;
          dbRef.current = stored;
          setDb(stored);
        } else {
          loadedDb = INITIAL_DATABASE;
          dbRef.current = INITIAL_DATABASE;
          await saveDBToIndexedDB(INITIAL_DATABASE);
          setDb(INITIAL_DATABASE);
        }
      } catch (err) {
        console.error('Failed to load from IndexedDB:', err);
      } finally {
        setLoading(false);
        if (loadedDb) {
          runDailyAutoBackup(loadedDb).catch(console.warn);
        }
      }
    }
    loadData();
  }, []);

  // Singleton IDB Database connection
  const idbInstanceRef = useRef<IDBDatabase | null>(null);
  const getIDB = useCallback(async (): Promise<IDBDatabase> => {
    if (idbInstanceRef.current) return idbInstanceRef.current;
    const instance = await initIndexedDB();
    idbInstanceRef.current = instance;
    return instance;
  }, []);

  // Promise queue to serialize concurrent write operations
  const opQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueueOp = useCallback(<T,>(op: () => Promise<T>): Promise<T> => {
    const nextOp = opQueueRef.current.then(op, op);
    opQueueRef.current = nextOp.then(() => {}, () => {});
    return nextOp;
  }, []);

  // Barcode scanned callback (from camera scanner or USB scanner)
  const handleBarcodeScanned = useCallback(
    (code: string) => {
      const product = db.products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase() === code.toLowerCase())
      );

      if (product) {
        toast(`Found product: ${product.name} (${db.settings.currency || '₹'}${product.price})`, 'success');
        if (activeTab !== 'pos') {
          setActiveTab('pos');
        }
        setScannedProductToAdd({ product, key: Date.now() });
      } else {
        alert(`No product found with barcode: "${code}". You can add it in the Inventory section.`, 'Unrecognized Barcode');
      }
    },
    [db.products, db.settings.currency, activeTab, toast, alert]
  );

  // Admin Security PIN Setup for First Run
  const handleSetAdminPin = useCallback(
    async (rawPin: string) => {
      const hashed = await hashPassword(rawPin);
      const updatedAuth = {
        ...(db.auth || { userId: 'admin', fpId: null, rpId: null }),
        userId: 'admin',
        pwHash: hashed,
        firstLogin: false,
        attempts: 0,
        lockUntil: 0,
      };
      setDb((prev) => ({
        ...prev,
        auth: updatedAuth,
      }));
      try {
        const idb = await getIDB();
        const ok = await setKV(idb, 'auth', updatedAuth);
        if (!ok) toast('Failed to save security settings', 'error');
      } catch (err) {
        console.error('Failed to save admin auth pin:', err);
        toast('Failed to save security settings', 'error');
      }
      toast('Admin Security PIN configured successfully!', 'success');
    },
    [db.auth, getIDB, toast]
  );

  // One-time migration for legacy plain text Admin PIN
  const handleMigrateAdminPin = useCallback(
    async (hashedPin: string) => {
      const updatedAuth = {
        ...(db.auth || { userId: 'admin', fpId: null, rpId: null, firstLogin: false }),
        pwHash: hashedPin,
        attempts: 0,
        lockUntil: 0,
      };
      setDb((prev) => ({ ...prev, auth: updatedAuth }));
      try {
        const idb = await getIDB();
        await setKV(idb, 'auth', updatedAuth);
      } catch (err) {
        console.error('Failed to save migrated admin pin:', err);
      }
    },
    [db.auth, getIDB]
  );

  // One-time migration for legacy plain text Staff PIN
  const handleMigrateStaffPin = useCallback(
    async (staffId: string, hashedPin: string) => {
      let updatedStaff: Staff | null = null;
      setDb((prev) => {
        const staffList = (prev.staff || []).map((s) => {
          if (s.id === staffId) {
            updatedStaff = { ...s, pin: hashedPin };
            return updatedStaff;
          }
          return s;
        });
        return { ...prev, staff: staffList };
      });
      if (updatedStaff) {
        try {
          const idb = await getIDB();
          await saveRecord(idb, 'staff', updatedStaff);
        } catch (err) {
          console.error('Failed to save migrated staff pin:', err);
        }
      }
    },
    [getIDB]
  );

  // Sale Saved Handler (Atomic bill number assignment, plain code computation, and transactional saveBatch)
  const handleSaveSale = useCallback(
    (saleData: Sale): Promise<Sale> => {
      return enqueueOp(async () => {
        const prev = dbRef.current;

        const currentBillNo = typeof prev.meta?.billNo === 'number'
          ? prev.meta.billNo
          : parseInt(String(prev.meta?.billNo || 1), 10) || 1;
        const assignedBillNo = currentBillNo;
        const nextMeta = {
          ...prev.meta,
          billNo: currentBillNo + 1,
        };

        const completedSale: Sale = {
          ...saleData,
          id: saleData.id || crypto.randomUUID(),
          billNo: assignedBillNo,
        };

        // Decrement product stock levels without silent Math.max(0, ...)
        const affectedProducts: Product[] = [];
        const updatedProducts = prev.products.map((prod) => {
          const cartItem = completedSale.items.find((item) => item.productId === prod.id);
          if (cartItem) {
            const currentStock = prod.stock ?? prod.qty ?? 0;
            const newStock = currentStock - cartItem.qty;
            const updatedProd = {
              ...prod,
              stock: newStock,
              qty: newStock,
              updatedAt: new Date().toISOString(),
            };
            affectedProducts.push(updatedProd);
            return updatedProd;
          }
          return prod;
        });

        // Update customer balance if credit / udhaar OR if loyalty points changed (matching by customerId first)
        let updatedCustomers = prev.customers;
        let affectedCustomer: Customer | null = null;
        const hasPoints = Boolean(completedSale.pointsEarned || completedSale.pointsRedeemed);
        if ((completedSale.paymentMethod === 'credit' || hasPoints) && (completedSale.customerId || completedSale.customer)) {
          updatedCustomers = prev.customers.map((c) => {
            const isMatch = completedSale.customerId
              ? c.id === completedSale.customerId
              : (c.name === completedSale.customer || (completedSale.customerPhone && c.phone === completedSale.customerPhone));
            if (isMatch) {
              const currentBalance = c.balance || 0;
              const currentKhata = c.khataBalance ?? c.balance ?? 0;
              const nextBalance = completedSale.paymentMethod === 'credit' ? currentBalance + completedSale.total : currentBalance;
              const nextKhata = completedSale.paymentMethod === 'credit' ? currentKhata + completedSale.total : currentKhata;

              const currentPoints = c.loyaltyPoints || 0;
              const netPointsChange = (completedSale.pointsEarned || 0) - (completedSale.pointsRedeemed || 0);
              const nextPoints = Math.max(0, currentPoints + netPointsChange);

              const updatedCust = {
                ...c,
                balance: nextBalance,
                khataBalance: nextKhata,
                loyaltyPoints: nextPoints,
              };
              affectedCustomer = updatedCust;
              return updatedCust;
            }
            return c;
          });
        }

        const nextDb: AppDatabase = {
          ...prev,
          products: updatedProducts,
          customers: updatedCustomers,
          sales: [completedSale, ...prev.sales],
          meta: nextMeta,
        };

        // Advance in-memory state and ref first
        dbRef.current = nextDb;
        setDb(nextDb);

        // Transactional multi-store save via saveBatch
        try {
          const idb = await getIDB();
          const ok = await saveBatch(idb, {
            sales: [completedSale],
            products: affectedProducts,
            customers: affectedCustomer ? [affectedCustomer] : undefined,
            kv: { meta: nextMeta },
          });

          if (!ok) {
            // Rollback in-memory state on write failure
            dbRef.current = prev;
            setDb(prev);
            toast('Failed to save sale to local storage. Changes rolled back.', 'error');
            throw new Error('Failed to save sale to local storage');
          }
        } catch (err) {
          // Rollback in-memory state on exception
          dbRef.current = prev;
          setDb(prev);
          console.error('Storage error in handleSaveSale:', err);
          toast('Storage error: Failed to save sale. Changes rolled back.', 'error');
          throw err;
        }

        return completedSale;
      });
    },
    [enqueueOp, getIDB, toast]
  );

  // Void / Refund Sale Handler (Pure computation, void-twice protection, transactional saveBatch, rollback)
  const handleVoidSale = useCallback(
    (saleId: string): Promise<void> => {
      return enqueueOp(async () => {
        const prev = dbRef.current;
        const targetSale = prev.sales.find((s) => s.id === saleId);
        if (!targetSale || targetSale.voided) {
          return;
        }

        const voidedAt = new Date().toISOString();
        const voidedBy = activeStaff?.name || 'Admin';

        // Restore stock
        const restoredProducts: Product[] = [];
        const updatedProducts = prev.products.map((prod) => {
          const cartItem = targetSale.items.find((item) => item.productId === prod.id);
          if (cartItem) {
            const currentStock = prod.stock ?? prod.qty ?? 0;
            const updatedProd = {
              ...prod,
              stock: currentStock + cartItem.qty,
              qty: currentStock + cartItem.qty,
              updatedAt: new Date().toISOString(),
            };
            restoredProducts.push(updatedProd);
            return updatedProd;
          }
          return prod;
        });

        // Revert customer credit balance and loyalty points matching by customerId first
        let restoredCustomer: Customer | null = null;
        let updatedCustomers = prev.customers;
        const targetHasPoints = Boolean(targetSale.pointsEarned || targetSale.pointsRedeemed);
        if ((targetSale.paymentMethod === 'credit' || targetHasPoints) && (targetSale.customerId || targetSale.customer)) {
          updatedCustomers = prev.customers.map((c) => {
            const isMatch = targetSale.customerId
              ? c.id === targetSale.customerId
              : (c.name === targetSale.customer || (targetSale.customerPhone && c.phone === targetSale.customerPhone));
            if (isMatch) {
              const currentBalance = c.balance || 0;
              const currentKhata = c.khataBalance ?? c.balance ?? 0;
              const nextBalance = targetSale.paymentMethod === 'credit' ? Math.max(0, currentBalance - targetSale.total) : currentBalance;
              const nextKhata = targetSale.paymentMethod === 'credit' ? Math.max(0, currentKhata - targetSale.total) : currentKhata;

              const currentPoints = c.loyaltyPoints || 0;
              const netPointsChange = (targetSale.pointsEarned || 0) - (targetSale.pointsRedeemed || 0);
              const nextPoints = Math.max(0, currentPoints - netPointsChange);

              const updatedCust = {
                ...c,
                balance: nextBalance,
                khataBalance: nextKhata,
                loyaltyPoints: nextPoints,
              };
              restoredCustomer = updatedCust;
              return updatedCust;
            }
            return c;
          });
        }

        const voidedSale: Sale = {
          ...targetSale,
          voided: true,
          voidedAt,
          voidedBy,
        };

        const updatedSales = prev.sales.map((s) => (s.id === saleId ? voidedSale : s));

        const nextDb: AppDatabase = {
          ...prev,
          products: updatedProducts,
          customers: updatedCustomers,
          sales: updatedSales,
        };

        // Advance in-memory state and ref first
        dbRef.current = nextDb;
        setDb(nextDb);

        // Transactional multi-store save via saveBatch
        try {
          const idb = await getIDB();
          const ok = await saveBatch(idb, {
            sales: [voidedSale],
            products: restoredProducts,
            customers: restoredCustomer ? [restoredCustomer] : undefined,
          });

          if (!ok) {
            dbRef.current = prev;
            setDb(prev);
            toast('Failed to update voided sale in storage. Changes rolled back.', 'error');
            throw new Error('Failed to update voided sale in storage');
          }
          toast('Sale marked as VOID / Refunded. Stock and balance restored.', 'info');
        } catch (err) {
          dbRef.current = prev;
          setDb(prev);
          console.error('Storage error in handleVoidSale:', err);
          toast('Failed to update voided sale in storage. Changes rolled back.', 'error');
          throw err;
        }
      });
    },
    [activeStaff?.name, enqueueOp, getIDB, toast]
  );

  // Return items and issue Credit Note (Transactional saveBatch & rollback)
  const handleReturnSale = useCallback(
    (params: {
      saleId: string;
      returns: { itemIndex: number; qty: number }[];
      refundAmount: number;
      reason: string;
    }): Promise<void> => {
      return enqueueOp(async () => {
        const { saleId, returns, refundAmount, reason } = params;
        const prev = dbRef.current;
        const targetSale = prev.sales.find((s) => s.id === saleId);
        if (!targetSale) return;

        const creditNoteNumber = `CN-${targetSale.billNo}-${Date.now().toString().slice(-4)}`;
        const restoredProducts: Product[] = [];
        const creditNoteDoc: CommercialDocument = {
          id: `cn_${Date.now()}`,
          type: 'credit_note',
          docNumber: creditNoteNumber,
          date: new Date().toISOString().split('T')[0],
          partyName: targetSale.customer || 'Walk-In Customer',
          partyPhone: targetSale.customerPhone,
          items: returns.map((r) => {
            const item = targetSale.items[r.itemIndex];
            return {
              productId: item?.productId,
              name: item?.name || 'Item',
              qty: r.qty,
              price: item?.price || 0,
            };
          }),
          subtotal: refundAmount,
          total: refundAmount,
          notes: `Sales return for Bill #${targetSale.billNo}. Reason: ${reason}`,
          status: 'pending',
        };

        let updatedSaleRecord: Sale | null = null;
        const updatedSales = prev.sales.map((s) => {
          if (s.id !== saleId) return s;
          const nextItems = s.items.map((item, idx) => {
            const ret = returns.find((r) => r.itemIndex === idx);
            if (ret) {
              return {
                ...item,
                returnedQty: (item.returnedQty || 0) + ret.qty,
              };
            }
            return item;
          });
          const saleObj: Sale = {
            ...s,
            items: nextItems,
            returnedTotal: (s.returnedTotal || 0) + refundAmount,
            returnCreditNoteId: creditNoteDoc.id,
          };
          updatedSaleRecord = saleObj;
          return saleObj;
        });

        // Restore stock for returned products
        const updatedProducts = prev.products.map((p) => {
          const returnedItem = returns.find((r) => {
            const item = targetSale.items[r.itemIndex];
            return item && item.productId === p.id;
          });
          if (returnedItem) {
            const currentStock = p.stock ?? p.qty ?? 0;
            const restoredStock = currentStock + returnedItem.qty;
            const updatedProd = {
              ...p,
              stock: restoredStock,
              qty: restoredStock,
              updatedAt: new Date().toISOString(),
            };
            restoredProducts.push(updatedProd);
            return updatedProd;
          }
          return p;
        });

        const documents = [creditNoteDoc, ...(prev.documents || [])];

        const nextDb: AppDatabase = {
          ...prev,
          sales: updatedSales,
          products: updatedProducts,
          documents,
        };

        // Advance in-memory state and ref first
        dbRef.current = nextDb;
        setDb(nextDb);

        // Transactional multi-store save via saveBatch
        try {
          const idb = await getIDB();
          const ok = await saveBatch(idb, {
            estimates: [creditNoteDoc], // Stored under estimates / documents store
            sales: updatedSaleRecord ? [updatedSaleRecord] : undefined,
            products: restoredProducts,
          });

          if (!ok) {
            dbRef.current = prev;
            setDb(prev);
            toast('Failed to save credit note to storage. Changes rolled back.', 'error');
            throw new Error('Failed to save credit note to storage');
          }
          toast(
            `Credit Note #${creditNoteNumber} issued for ${prev.settings.currency || '₹'}${refundAmount.toFixed(2)}. Stock restored!`,
            'success'
          );
        } catch (err) {
          dbRef.current = prev;
          setDb(prev);
          console.error('Storage error in handleReturnSale:', err);
          toast('Failed to save credit note to storage. Changes rolled back.', 'error');
          throw err;
        }
      });
    },
    [enqueueOp, getIDB, toast]
  );

  // Product CRUD (Fine-grained per-record persistence)
  const handleSaveProduct = useCallback(
    async (product: Product) => {
      setDb((prev) => {
        const exists = prev.products.some((p) => p.id === product.id);
        const products = exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [product, ...prev.products];
        return { ...prev, products };
      });
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'products', product);
        if (!ok) toast('Failed to save product to device storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveProduct:', err);
        toast('Failed to save product to device storage', 'error');
      }
    },
    [getIDB, toast]
  );

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      setDb((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
      }));
      try {
        const idb = await getIDB();
        const ok = await deleteRecord(idb, 'products', productId);
        if (!ok) toast('Failed to delete product from storage', 'error');
      } catch (err) {
        console.error('Storage error in handleDeleteProduct:', err);
        toast('Failed to delete product from storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Customer CRUD (Fine-grained per-record persistence)
  const handleSaveCustomer = useCallback(
    async (customer: Customer) => {
      setDb((prev) => {
        const exists = prev.customers.some((c) => c.id === customer.id);
        const customers = exists
          ? prev.customers.map((c) => (c.id === customer.id ? customer : c))
          : [customer, ...prev.customers];
        return { ...prev, customers };
      });
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'customers', customer);
        if (!ok) toast('Failed to save customer to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveCustomer:', err);
        toast('Failed to save customer to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  const handleDeleteCustomer = useCallback(
    async (customerId: string) => {
      setDb((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== customerId),
      }));
      try {
        const idb = await getIDB();
        const ok = await deleteRecord(idb, 'customers', customerId);
        if (!ok) toast('Failed to delete customer from storage', 'error');
      } catch (err) {
        console.error('Storage error in handleDeleteCustomer:', err);
        toast('Failed to delete customer from storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Expense CRUD (Fine-grained per-record persistence)
  const handleSaveExpense = useCallback(
    async (expense: Expense) => {
      setDb((prev) => {
        const exists = prev.expenses.some((e) => e.id === expense.id);
        const expenses = exists
          ? prev.expenses.map((e) => (e.id === expense.id ? expense : e))
          : [expense, ...prev.expenses];
        return { ...prev, expenses };
      });
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'expenses', expense);
        if (!ok) toast('Failed to save expense to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveExpense:', err);
        toast('Failed to save expense to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  const handleDeleteExpense = useCallback(
    async (expenseId: string) => {
      setDb((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }));
      try {
        const idb = await getIDB();
        const ok = await deleteRecord(idb, 'expenses', expenseId);
        if (!ok) toast('Failed to delete expense from storage', 'error');
      } catch (err) {
        console.error('Storage error in handleDeleteExpense:', err);
        toast('Failed to delete expense from storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Supplier CRUD (Fine-grained per-record persistence)
  const handleSaveSupplier = useCallback(
    async (supplier: Supplier) => {
      setDb((prev) => {
        const exists = prev.suppliers.some((s) => s.id === supplier.id);
        const suppliers = exists
          ? prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s))
          : [supplier, ...prev.suppliers];
        return { ...prev, suppliers };
      });
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'suppliers', supplier);
        if (!ok) toast('Failed to save supplier to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveSupplier:', err);
        toast('Failed to save supplier to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  const handleDeleteSupplier = useCallback(
    async (supplierId: string) => {
      setDb((prev) => ({
        ...prev,
        suppliers: prev.suppliers.filter((s) => s.id !== supplierId),
      }));
      try {
        const idb = await getIDB();
        const ok = await deleteRecord(idb, 'suppliers', supplierId);
        if (!ok) toast('Failed to delete supplier from storage', 'error');
      } catch (err) {
        console.error('Storage error in handleDeleteSupplier:', err);
        toast('Failed to delete supplier from storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Staff CRUD (Fine-grained per-record persistence)
  const handleSaveStaff = useCallback(
    async (staff: Staff) => {
      setDb((prev) => {
        const exists = (prev.staff || []).some((s) => s.id === staff.id);
        const staffList = exists
          ? (prev.staff || []).map((s) => (s.id === staff.id ? staff : s))
          : [staff, ...(prev.staff || [])];
        return { ...prev, staff: staffList };
      });
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'staff', staff);
        if (!ok) toast('Failed to save staff member to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveStaff:', err);
        toast('Failed to save staff member to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  const handleDeleteStaff = useCallback(
    async (staffId: string) => {
      setDb((prev) => ({
        ...prev,
        staff: (prev.staff || []).filter((s) => s.id !== staffId),
      }));
      try {
        const idb = await getIDB();
        const ok = await deleteRecord(idb, 'staff', staffId);
        if (!ok) toast('Failed to delete staff member from storage', 'error');
      } catch (err) {
        console.error('Storage error in handleDeleteStaff:', err);
        toast('Failed to delete staff member from storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Document CRUD (Fine-grained per-record persistence)
  const handleSaveDocument = useCallback(
    async (doc: CommercialDocument) => {
      setDb((prev) => {
        const exists = (prev.documents || []).some((d) => d.id === doc.id);
        const documents = exists
          ? (prev.documents || []).map((d) => (d.id === doc.id ? doc : d))
          : [doc, ...(prev.documents || [])];
        return { ...prev, documents };
      });
      try {
        const idb = await getIDB();
        const store = doc.type === 'estimate' ? 'estimates' : doc.type === 'challan' ? 'deliveryChallans' : 'estimates';
        await saveRecord(idb, store, doc);
      } catch (err) {
        console.error('Storage error in handleSaveDocument:', err);
      }
    },
    [getIDB]
  );

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      setDb((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((d) => d.id !== docId),
      }));
      try {
        const idb = await getIDB();
        await deleteRecord(idb, 'estimates', docId);
        await deleteRecord(idb, 'deliveryChallans', docId);
      } catch (err) {
        console.error('Storage error in handleDeleteDocument:', err);
      }
    },
    [getIDB]
  );

  // Stock Adjustment CRUD (Fine-grained per-record persistence)
  const handleSaveStockAdjustment = useCallback(
    async (adj: StockAdjustment) => {
      setDb((prev) => ({
        ...prev,
        stockAdjustments: [adj, ...(prev.stockAdjustments || [])],
      }));
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'stockAdjustments', adj);
        if (!ok) toast('Failed to save stock adjustment to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveStockAdjustment:', err);
        toast('Failed to save stock adjustment to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Purchase Bill CRUD (Fine-grained per-record persistence)
  const handleSavePurchaseBill = useCallback(
    async (bill: PurchaseBill) => {
      setDb((prev) => ({
        ...prev,
        purchaseBills: [bill, ...(prev.purchaseBills || [])],
      }));
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'purchaseBills', bill);
        if (!ok) toast('Failed to save purchase bill to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSavePurchaseBill:', err);
        toast('Failed to save purchase bill to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  const handleNavigateToBarcodes = useCallback((productId?: string) => {
    setBarcodeSelectedProductId(productId);
    setActiveTab('barcodes');
  }, []);

  // Settings (Fine-grained KV persistence)
  const handleSaveSettings = useCallback(
    async (newSettings: ShopSettings) => {
      setDb((prev) => ({
        ...prev,
        settings: newSettings,
      }));
      try {
        const idb = await getIDB();
        const ok = await setKV(idb, 'settings', newSettings);
        if (!ok) toast('Failed to save settings to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveSettings:', err);
        toast('Failed to save settings to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Branch (Fine-grained KV & Record persistence)
  const handleSwitchBranch = useCallback(
    async (branchId: string) => {
      setDb((prev) => ({
        ...prev,
        activeBranchId: branchId,
      }));
      try {
        const idb = await getIDB();
        await setKV(idb, 'activeBranchId', branchId);
        toast('Switched branch', 'info');
      } catch (err) {
        console.error('Storage error in handleSwitchBranch:', err);
      }
    },
    [getIDB, toast]
  );

  const handleSaveBranch = useCallback(
    async (branch: Branch) => {
      setDb((prev) => {
        const exists = (prev.branches || []).some((b) => b.id === branch.id);
        const branches = exists
          ? (prev.branches || []).map((b) => (b.id === branch.id ? branch : b))
          : [...(prev.branches || []), branch];
        return { ...prev, branches };
      });
      try {
        const idb = await getIDB();
        const ok = await saveRecord(idb, 'branches', branch);
        if (!ok) toast('Failed to save branch to storage', 'error');
      } catch (err) {
        console.error('Storage error in handleSaveBranch:', err);
        toast('Failed to save branch to storage', 'error');
      }
    },
    [getIDB, toast]
  );

  // Backup & Restore
  const handleExportBackup = useCallback(() => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ShopPOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Database backup exported successfully', 'success');
  }, [db, toast]);

  const handleImportBackup = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          let parsed: unknown;
          try {
            parsed = JSON.parse(content);
          } catch {
            alert('The selected file is not a valid JSON file. Please check the file and try again.', 'Invalid File');
            return;
          }

          const validation = validateBackupData(parsed);
          if (!validation.valid || !validation.stats) {
            alert(validation.reason || 'Invalid backup file structure.', 'Validation Failed');
            return;
          }

          const ok = await confirm(
            `Validated backup file successfully!\n\n• Products: ${validation.stats.products}\n• Sales Records: ${validation.stats.sales}\n• Customers: ${validation.stats.customers}\n\nDo you want to restore this data and replace your current database?`,
            'Restore Database'
          );
          if (!ok) return;

          const restoredDb = parsed as AppDatabase;
          await saveDBToIndexedDB(restoredDb);
          setDb(restoredDb);
          const nowIso = new Date().toISOString();
          localStorage.setItem('shoppos_last_backup', nowIso);
          toast('Database restored successfully from backup', 'success');
        } catch (err: unknown) {
          console.error('Import error:', err);
          const errMsg = err instanceof Error ? err.message : String(err || '');
          alert('Could not restore backup file: ' + errMsg, 'Import Failed');
        }
      };
      reader.readAsText(file);
    },
    [toast, alert, confirm]
  );

  const handleResetDatabase = useCallback(async () => {
    await saveDBToIndexedDB(INITIAL_DATABASE);
    setDb(INITIAL_DATABASE);
    setActiveStaff(null);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 size={36} className="text-indigo-500 animate-spin mb-3" />
        <h2 className="text-base font-bold text-white tracking-tight">Initializing ShopPOS Pro...</h2>
        <p className="text-xs text-slate-500 mt-1">Booting offline local IndexedDB engine</p>
      </div>
    );
  }

  return (
    <div id="app-root-container" className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-150">
      {/* Network connectivity banner */}
      <OfflineIndicator />

      {/* Header Bar with Global Controls */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        db={db}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenManual={() => setIsManualOpen(true)}
        onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        activeStaff={activeStaff}
        onLogoutStaff={handleLogout}
        onSwitchBranch={handleSwitchBranch}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        cartCount={cartCount}
      />

      {/* Main View Area */}
      <main id="app-view-container" className="flex-1 flex overflow-hidden relative pb-16 lg:pb-0">
        {activeTab === 'pos' && (
          <POS
            db={db}
            onSaveSale={handleSaveSale}
            onOpenReceiptModal={(sale) => setReceiptSale(sale)}
            activeStaff={activeStaff}
            onCartCountChange={setCartCount}
            onOpenScanner={() => setIsScannerOpen(true)}
            scannedProductToAdd={scannedProductToAdd}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            db={db}
            onOpenSaleReceipt={(sale) => setReceiptSale(sale)}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onSaveDocument={handleSaveDocument}
          />
        )}

        {activeTab === 'inventory' && (
          <Inventory
            db={db}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onNavigateToBarcodes={handleNavigateToBarcodes}
            onSaveStockAdjustment={handleSaveStockAdjustment}
          />
        )}

        {activeTab === 'sales' && (
          <Sales
            db={db}
            onOpenReceipt={(sale) => setReceiptSale(sale)}
            onVoidSale={handleVoidSale}
            onReturnSale={handleReturnSale}
          />
        )}

        {activeTab === 'customers' && (
          <Customers
            db={db}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activeTab === 'reports' && (
          <Reports db={db} />
        )}

        {activeTab === 'barcodes' && (
          <BarcodeDesigner
            db={db}
            initialSelectedProductId={barcodeSelectedProductId}
          />
        )}

        {activeTab === 'expenses' && (
          <Expenses
            db={db}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === 'suppliers' && (
          <Suppliers
            db={db}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onSavePurchaseBill={handleSavePurchaseBill}
            onSaveProduct={handleSaveProduct}
          />
        )}

        {activeTab === 'staff' && (
          <StaffComponent
            db={db}
            onSaveStaff={handleSaveStaff}
            onDeleteStaff={handleDeleteStaff}
            onLoginStaff={(staff: Staff) => {
              setActiveStaff(staff);
              toast(`Active cashier: ${staff.name}`, 'info');
            }}
            onLogoutStaff={() => {
              setActiveStaff(null);
              toast('Cashier clocked out', 'info');
            }}
            activeStaff={activeStaff}
          />
        )}

        {activeTab === 'documents' && (
          <Documents
            db={db}
            onSaveDocument={handleSaveDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            db={db}
            onSaveSettings={handleSaveSettings}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetDatabase={handleResetDatabase}
            onSaveBranch={handleSaveBranch}
          />
        )}
      </main>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        continuous={activeTab === 'pos'}
        cartCount={cartCount}
      />

      {/* Receipt Preview & Thermal Print Hub Modal */}
      {receiptSale && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setReceiptSale(null)}
          sale={receiptSale}
          settings={db.settings}
        />
      )}

      {/* 10-Chapter User Manual & PDF Guide */}
      <ManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        settings={db.settings}
      />

      {/* Login / Shift Lock Modal with Fingerprint & ID/Password */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        staffList={db.staff || []}
        activeStaff={activeStaff}
        adminPwHash={db.auth?.pwHash}
        onMigrateAdminPin={handleMigrateAdminPin}
        onMigrateStaffPin={handleMigrateStaffPin}
        onLogout={() => {
          setActiveStaff(null);
          toast('Logged out successfully', 'info');
        }}
        onAuthenticate={(staff) => {
          setActiveStaff(staff);
          toast(`Logged in as ${staff.name} (${staff.role})`, 'success');
        }}
        onAdminAuthenticate={() => {
          setActiveStaff(null);
          toast('Authenticated as Administrator', 'success');
        }}
      />

      {/* Forced Owner PIN Setup on First Run */}
      <AdminPinSetupModal
        isOpen={isFirstRun}
        onSetAdminPin={handleSetAdminPin}
        shopName={db.settings?.shopName}
      />

      {/* Mobile Bottom Navigation Bar (Visible on mobile/tablet screens) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartCount}
        lowStockCount={lowStockCount}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenMore={() => setIsMobileMoreOpen(true)}
      />

      {/* Mobile More Navigation Drawer */}
      <MobileMoreDrawer
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMoreOpen(false);
        }}
        db={db}
        activeStaff={activeStaff}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenLogin={() => {
          setIsMobileMoreOpen(false);
          setIsLoginOpen(true);
        }}
        onOpenScanner={() => {
          setIsMobileMoreOpen(false);
          setIsScannerOpen(true);
        }}
        onOpenQuickSearch={() => {
          setIsMobileMoreOpen(false);
          setIsQuickSearchOpen(true);
        }}
        onLogoutStaff={() => {
          setIsMobileMoreOpen(false);
          handleLogout();
        }}
        onOpenManual={() => {
          setIsMobileMoreOpen(false);
          setIsManualOpen(true);
        }}
      />

      {/* Universal Quick Search / Command Palette (Ctrl+K or ⌘K) */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        db={db}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsQuickSearchOpen(false);
        }}
        onOpenReceipt={(sale) => {
          setReceiptSale(sale);
          setIsQuickSearchOpen(false);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LocalizationProvider>
        <DialogProvider>
          <AppContent />
        </DialogProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
