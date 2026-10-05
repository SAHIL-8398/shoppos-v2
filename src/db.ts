/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppDatabase, Product, Sale, Customer, Expense, Supplier, Staff, PurchaseOrder, Estimate, DeliveryChallan, CreditDebitNote, Branch, StaffActivityLog, Settings, Auth, StockAdjustment, PurchaseBill } from './types';

// Password hashing helper matching the original SHA-256 hex schema
export async function hashPassword(pw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pw + '_shoppos_salt_v2');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const DB_NAME = 'ShopPOSPro';
const DB_VERSION = 3;

export const RECORD_STORES = [
  'products',
  'sales',
  'customers',
  'expenses',
  'suppliers',
  'purchases',
  'staff',
  'estimates',
  'deliveryChallans',
  'creditDebitNotes',
  'branches',
  'staffActivityLogs',
  'stockAdjustments',
  'purchaseBills',
] as const;

export type RecordStoreName = typeof RECORD_STORES[number];

export function getActiveDBKey(): string {
  const profileId = localStorage.getItem('shoppos_active_profile_id') || 'default';
  return `shoppos_db_${profileId}`;
}

export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }
      RECORD_STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    request.onerror = () => {
      reject(new Error('IndexedDB failed to initialize'));
    };
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export function getKV<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains('kv')) {
        resolve(null);
        return;
      }
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.v : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getDBFromIndexedDB(dbInstance?: IDBDatabase): Promise<AppDatabase | null> {
  try {
    const db = dbInstance || (await initIndexedDB());
    // 1. Check if legacy single-blob database exists in 'kv' store
    const legacyBlob = await getKV<AppDatabase>(db, getActiveDBKey());
    if (legacyBlob && typeof legacyBlob === 'object' && (legacyBlob.products || legacyBlob.settings)) {
      // Migrate legacy single blob into per-record stores
      await saveDBToIndexedDB(db, legacyBlob);
      // Clean up legacy blob to free memory and prevent re-migration
      try {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(getActiveDBKey());
      } catch (err) {
        console.warn('Could not clean up legacy blob key:', err);
      }
      return legacyBlob;
    }

    // 2. Fetch all collections in parallel from individual stores
    const [
      products,
      sales,
      customers,
      expenses,
      suppliers,
      purchases,
      staff,
      estimates,
      deliveryChallans,
      creditDebitNotes,
      branches,
      staffActivityLogs,
      stockAdjustments,
      purchaseBills,
      settings,
      auth,
      meta,
      activeBranchId,
    ] = await Promise.all([
      getAllFromStore<Product>(db, 'products'),
      getAllFromStore<Sale>(db, 'sales'),
      getAllFromStore<Customer>(db, 'customers'),
      getAllFromStore<Expense>(db, 'expenses'),
      getAllFromStore<Supplier>(db, 'suppliers'),
      getAllFromStore<PurchaseOrder>(db, 'purchases'),
      getAllFromStore<Staff>(db, 'staff'),
      getAllFromStore<Estimate>(db, 'estimates'),
      getAllFromStore<DeliveryChallan>(db, 'deliveryChallans'),
      getAllFromStore<CreditDebitNote>(db, 'creditDebitNotes'),
      getAllFromStore<Branch>(db, 'branches'),
      getAllFromStore<StaffActivityLog>(db, 'staffActivityLogs'),
      getAllFromStore<StockAdjustment>(db, 'stockAdjustments'),
      getAllFromStore<PurchaseBill>(db, 'purchaseBills'),
      getKV<Settings>(db, 'settings'),
      getKV<Auth>(db, 'auth'),
      getKV<{ billNo: number | string; estimateNo?: number; challanNo?: number; noteNo?: number }>(db, 'meta'),
      getKV<string>(db, 'activeBranchId'),
    ]);

    // Check if database has any existing data
    if (!settings && products.length === 0 && sales.length === 0 && !auth) {
      return null;
    }

    const defaultPwHash = await hashPassword('Shop@2024');
    const assembledDb: AppDatabase = {
      products,
      sales,
      customers,
      expenses,
      suppliers,
      purchases,
      staff,
      estimates,
      deliveryChallans,
      creditDebitNotes,
      branches: branches || [],
      activeBranchId: activeBranchId || (branches[0]?.id || ''),
      staffActivityLogs,
      stockAdjustments: stockAdjustments || [],
      purchaseBills: purchaseBills || [],
      settings: settings || {
        shopName: '',
        address: '',
        phone: '',
        gstin: '',
        fssai: '',
        upi: '',
        footer: 'Thank you! Come again',
        lowStockDefault: 10,
        nearExpiryDefault: 30,
        requireStaffPin: false,
      },
      auth: auth || {
        userId: 'admin',
        pwHash: defaultPwHash,
        fpId: null,
        rpId: null,
        firstLogin: true,
        attempts: 0,
        lockUntil: 0,
      },
      meta: meta || {
        billNo: sales.length ? Math.max(...sales.map(s => typeof s.billNo === 'number' ? s.billNo : parseInt(String(s.billNo)) || 0)) + 1 : 1,
        estimateNo: 1,
        challanNo: 1,
        noteNo: 1,
      },
    };

    return assembledDb;
  } catch (err) {
    console.error('Error reading from per-record IndexedDB stores:', err);
    return null;
  }
}

export async function saveDBToIndexedDB(
  dbOrData: IDBDatabase | AppDatabase,
  maybeData?: AppDatabase
): Promise<boolean> {
  let db: IDBDatabase;
  let data: AppDatabase;

  if ('objectStoreNames' in dbOrData) {
    db = dbOrData;
    data = maybeData!;
  } else {
    data = dbOrData;
    db = await initIndexedDB();
  }

  return new Promise((resolve) => {
    try {
      const activeStores = [...RECORD_STORES, 'kv'].filter(s => db.objectStoreNames.contains(s));
      const tx = db.transaction(activeStores, 'readwrite');
      
      const syncStore = (storeName: RecordStoreName, items: { id: string }[] | undefined) => {
        if (!db.objectStoreNames.contains(storeName)) return;
        const store = tx.objectStore(storeName);
        store.clear();
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (item && item.id) {
              store.put(item);
            }
          });
        }
      };

      syncStore('products', data.products);
      syncStore('sales', data.sales);
      syncStore('customers', data.customers);
      syncStore('expenses', data.expenses);
      syncStore('suppliers', data.suppliers);
      syncStore('purchases', data.purchases);
      syncStore('staff', data.staff);
      syncStore('estimates', data.estimates);
      syncStore('deliveryChallans', data.deliveryChallans);
      syncStore('creditDebitNotes', data.creditDebitNotes);
      syncStore('branches', data.branches);
      syncStore('staffActivityLogs', data.staffActivityLogs);
      syncStore('stockAdjustments', data.stockAdjustments);
      syncStore('purchaseBills', data.purchaseBills);

      if (db.objectStoreNames.contains('kv')) {
        const kvStore = tx.objectStore('kv');
        if (data.settings) kvStore.put({ k: 'settings', v: data.settings });
        if (data.auth) kvStore.put({ k: 'auth', v: data.auth });
        if (data.meta) kvStore.put({ k: 'meta', v: data.meta });
        if (data.activeBranchId) kvStore.put({ k: 'activeBranchId', v: data.activeBranchId });
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.error('Transaction error saving to IndexedDB:', err);
        resolve(false);
      };
      tx.onabort = () => resolve(false);
    } catch (err) {
      console.error('Exception saving to per-record IndexedDB stores:', err);
      resolve(false);
    }
  });
}

/**
 * Persist or update a single record into an individual object store directly.
 */
export function saveRecord<T extends { id: string }>(db: IDBDatabase, storeName: RecordStoreName, record: T): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Persist multiple records into an individual object store directly.
 */
export function saveRecords<T extends { id: string }>(
  db: IDBDatabase,
  storeName: RecordStoreName,
  records: T[]
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!records || records.length === 0) {
        resolve(true);
        return;
      }
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const rec of records) {
        if (rec && rec.id) {
          store.put(rec);
        }
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Set a key-value entry in the kv store.
 */
export function setKV<T>(db: IDBDatabase, key: string, value: T): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains('kv')) {
        resolve(false);
        return;
      }
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      store.put({ k: key, v: value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export interface SaveBatchOptions {
  sales?: Sale[];
  products?: Product[];
  customers?: Customer[];
  expenses?: Expense[];
  suppliers?: Supplier[];
  purchases?: PurchaseOrder[];
  staff?: Staff[];
  estimates?: (Estimate | { id: string })[];
  deliveryChallans?: DeliveryChallan[];
  creditDebitNotes?: CreditDebitNote[];
  branches?: Branch[];
  staffActivityLogs?: StaffActivityLog[];
  stockAdjustments?: StockAdjustment[];
  purchaseBills?: PurchaseBill[];
  kv?: Record<string, unknown>;
}

/**
 * Execute an atomic multi-store IndexedDB transaction for batch operations.
 */
export function saveBatch(
  db: IDBDatabase,
  batch: SaveBatchOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const storesToOpen = new Set<string>();

      for (const [key, val] of Object.entries(batch)) {
        if (key === 'kv') {
          if (val && typeof val === 'object' && Object.keys(val).length > 0) {
            storesToOpen.add('kv');
          }
        } else {
          if (Array.isArray(val) && val.length > 0) {
            storesToOpen.add(key);
          }
        }
      }

      if (storesToOpen.size === 0) {
        resolve(true);
        return;
      }

      const activeStores = Array.from(storesToOpen).filter((s) => db.objectStoreNames.contains(s));
      if (activeStores.length === 0) {
        resolve(false);
        return;
      }

      const tx = db.transaction(activeStores, 'readwrite');

      for (const storeName of activeStores) {
        if (storeName === 'kv') {
          const kvStore = tx.objectStore('kv');
          if (batch.kv) {
            for (const [k, v] of Object.entries(batch.kv)) {
              kvStore.put({ k, v });
            }
          }
        } else {
          const store = tx.objectStore(storeName);
          const items = batch[storeName as keyof Omit<SaveBatchOptions, 'kv'>] as { id?: string }[] | undefined;
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item && item.id) {
                store.put(item);
              }
            }
          }
        }
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.error('saveBatch transaction error:', err);
        resolve(false);
      };
      tx.onabort = () => resolve(false);
    } catch (err) {
      console.error('saveBatch exception:', err);
      resolve(false);
    }
  });
}

/**
 * Verifies if a string is a 64-character SHA-256 hex string.
 */
export function isSha256Hex(str?: string | null): boolean {
  return typeof str === 'string' && /^[0-9a-f]{64}$/i.test(str);
}

/**
 * Delete a single record from its individual object store directly.
 */
export function deleteRecord(db: IDBDatabase, storeName: RecordStoreName, id: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function estimateStorage(): Promise<{ used: number; total: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      total: estimate.quota || 0,
    };
  }
  return { used: 0, total: 0 };
}

export const INITIAL_DATABASE: AppDatabase = {
  products: [
    {
      id: 'prod_1',
      name: 'Royal Basmati Rice 5kg',
      category: 'Groceries',
      barcode: '8901030382012',
      sku: 'SKU-RICE-5K',
      cost: 390,
      mrp: 550,
      price: 480,
      stock: 45,
      unit: 'kg',
      hsn: '1006',
      gstPct: 5,
    },
    {
      id: 'prod_2',
      name: 'Fortune Sunlite Sunflower Oil 1L',
      category: 'Groceries',
      barcode: '8901030382029',
      sku: 'SKU-OIL-1L',
      cost: 118,
      mrp: 170,
      price: 145,
      stock: 60,
      unit: 'ltr',
      hsn: '1512',
      gstPct: 5,
    },
    {
      id: 'prod_3',
      name: 'Aashirvaad Shudh Chakki Atta 10kg',
      category: 'Groceries',
      barcode: '8901030382036',
      sku: 'SKU-ATTA-10K',
      cost: 310,
      mrp: 440,
      price: 395,
      stock: 32,
      unit: 'kg',
      hsn: '1101',
      gstPct: 5,
    },
    {
      id: 'prod_4',
      name: 'Britannia Good Day Butter Cookies',
      category: 'Snacks',
      barcode: '8901030382043',
      sku: 'SKU-GD-COOK',
      cost: 22,
      mrp: 35,
      price: 30,
      stock: 120,
      unit: 'pcs',
      hsn: '1905',
      gstPct: 18,
    },
    {
      id: 'prod_5',
      name: 'Tata Tea Gold Premium 500g',
      category: 'Beverages',
      barcode: '8901030382050',
      sku: 'SKU-TEA-500',
      cost: 230,
      mrp: 310,
      price: 280,
      stock: 28,
      unit: 'pcs',
      hsn: '0902',
      gstPct: 5,
    },
    {
      id: 'prod_6',
      name: 'Amul Pure Desi Ghee 1L Tin',
      category: 'Dairy',
      barcode: '8901030382067',
      sku: 'SKU-GHEE-1L',
      cost: 510,
      mrp: 650,
      price: 590,
      stock: 18,
      unit: 'ltr',
      hsn: '0405',
      gstPct: 12,
    },
    {
      id: 'prod_7',
      name: 'Dettol Original Antiseptic Liquid 250ml',
      category: 'Personal Care',
      barcode: '8901030382074',
      sku: 'SKU-DETTOL-250',
      cost: 105,
      mrp: 150,
      price: 135,
      stock: 35,
      unit: 'pcs',
      hsn: '3808',
      gstPct: 18,
    },
    {
      id: 'prod_8',
      name: 'Surf Excel Matic Front Load 1L',
      category: 'Household',
      barcode: '8901030382081',
      sku: 'SKU-SURF-1L',
      cost: 175,
      mrp: 250,
      price: 220,
      stock: 24,
      unit: 'ltr',
      hsn: '3402',
      gstPct: 18,
    },
    {
      id: 'prod_9',
      name: 'Maggi 2-Minute Masala Noodles 4-Pack',
      category: 'Snacks',
      barcode: '8901030382098',
      sku: 'SKU-MAGGI-4P',
      cost: 45,
      mrp: 60,
      price: 56,
      stock: 85,
      unit: 'pack',
      hsn: '1902',
      gstPct: 12,
    },
    {
      id: 'prod_10',
      name: 'Cadbury Dairy Milk Silk 60g',
      category: 'Confectionery',
      barcode: '8901030382104',
      sku: 'SKU-SILK-60',
      cost: 65,
      mrp: 85,
      price: 80,
      stock: 50,
      unit: 'pcs',
      hsn: '1806',
      gstPct: 18,
    },
  ],
  sales: [
    {
      id: 'sale_init_1',
      billNo: 1001,
      date: new Date().toISOString().split('T')[0],
      time: '10:30 AM',
      customer: 'Ramesh Sharma',
      customerPhone: '9876543210',
      items: [
        { productId: 'prod_1', name: 'Royal Basmati Rice 5kg', price: 480, qty: 1, unit: 'kg' },
        { productId: 'prod_2', name: 'Fortune Sunlite Sunflower Oil 1L', price: 145, qty: 2, unit: 'ltr' },
      ],
      subtotal: 770,
      discount: 0,
      gst: 38.5,
      total: 808.5,
      paymentMethod: 'cash',
      tendered: 1000,
      change: 191.5,
      staffName: 'Vikas Gupta',
    },
    {
      id: 'sale_init_2',
      billNo: 1002,
      date: new Date().toISOString().split('T')[0],
      time: '11:15 AM',
      customer: 'Priya Nair',
      customerPhone: '9823456789',
      items: [
        { productId: 'prod_5', name: 'Tata Tea Gold Premium 500g', price: 280, qty: 1, unit: 'pcs' },
        { productId: 'prod_4', name: 'Britannia Good Day Butter Cookies', price: 30, qty: 3, unit: 'pcs' },
      ],
      subtotal: 370,
      discount: 20,
      gst: 24.5,
      total: 374.5,
      paymentMethod: 'upi',
      tendered: 374.5,
      change: 0,
      staffName: 'Vikas Gupta',
    },
  ],
  customers: [
    {
      id: 'cust_1',
      name: 'Ramesh Sharma',
      phone: '9876543210',
      address: 'Shop 4, Market Yard, Pune',
      balance: 350,
    },
    {
      id: 'cust_2',
      name: 'Priya Nair',
      phone: '9823456789',
      address: 'B-102 Green Acres, Mumbai',
      balance: 0,
    },
    {
      id: 'cust_3',
      name: 'Anand Patel',
      phone: '9898765432',
      address: 'Plot 12, Station Road, Surat',
      balance: 1200,
    },
  ],
  expenses: [
    {
      id: 'exp_1',
      title: 'Store Electricity & Lighting Bill',
      category: 'Rent & Utilities',
      amount: 3400,
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'upi',
      notes: 'MSEDCL Monthly bill',
    },
    {
      id: 'exp_2',
      title: 'Staff Afternoon Refreshments & Tea',
      category: 'Staff Salaries & Tea',
      amount: 450,
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'cash',
    },
  ],
  suppliers: [
    {
      id: 'sup_1',
      name: 'Mahalakshmi Agro Distributorship',
      contactPerson: 'Anand Rao',
      phone: '9812345678',
      email: 'sales@mahalakshmi-agro.com',
      address: 'Warehouse #14, Grain Market, Navi Mumbai',
      gstin: '27AABCU1234F1Z1',
      balance: 15400,
    },
    {
      id: 'sup_2',
      name: 'Shree Krishna FMCG Agency',
      contactPerson: 'Mahesh Bhai',
      phone: '9822334455',
      address: 'Industrial Estate, Pune',
      gstin: '27AABCU5678F1Z2',
      balance: 8200,
    },
  ],
  purchases: [],
  staff: [
    {
      id: 'staff_1',
      name: 'Vikas Gupta',
      phone: '9811122233',
      role: 'cashier',
      pin: '1234',
      commissionPct: 2,
      active: true,
    },
    {
      id: 'staff_2',
      name: 'Sunita Rao',
      phone: '9822233344',
      role: 'manager',
      pin: '5678',
      commissionPct: 3,
      active: true,
    },
  ],
  settings: {
    shopName: 'ShopPOS Supermart',
    tagline: 'Quality Daily Needs & Wholesale Savings',
    address: 'Main Bazaar Road, Near Central Bank, Pune - 411001',
    phone: '+91 98765 43210',
    email: 'contact@shoppos-store.com',
    currency: '₹',
    language: 'English',
    financialYear: '2026-27',
    gstEnabled: true,
    defaultGstPct: 18,
    gstin: '27AABCU9603R1ZM',
    fssai: '11521012000345',
    upi: 'shoppos@okhdfcbank',
    printerPaperWidth: '58mm',
    thermalFontSize: 'normal',
    invoiceTemplate: 'regular',
    receiptHeader: 'Tax Invoice / Retail Bill',
    footerTerms: '1. Goods once sold will not be exchanged without receipt.\n2. All disputes subject to Pune jurisdiction. Thank you, visit again!',
    lowStockDefault: 10,
    nearExpiryDefault: 30,
    autoPrintReceipt: false,
    requireStaffPin: false,
  },
  auth: {
    userId: 'admin',
    pwHash: '',
    fpId: null,
    rpId: null,
    firstLogin: false,
    attempts: 0,
    lockUntil: 0,
  },
  meta: {
    billNo: 1003,
    estimateNo: 1,
    challanNo: 1,
    noteNo: 1,
  },
  estimates: [],
  deliveryChallans: [],
  creditDebitNotes: [],
  stockAdjustments: [
    {
      id: 'adj_1',
      productId: 'prod_1',
      productName: 'Royal Basmati Rice 5kg',
      oldStock: 50,
      newStock: 48,
      adjustmentQty: -2,
      reason: 'damaged',
      notes: 'Packaging tear during transit',
      date: '2026-09-28',
      staffName: 'Admin',
    },
  ],
  purchaseBills: [
    {
      id: 'pb_101',
      billNo: 'INV-2026-881',
      supplierId: 'sup_1',
      supplierName: 'Metro Cash & Carry Wholesale',
      supplierGstin: '27AABCU9603R1ZX',
      date: '2026-09-25',
      items: [
        {
          productId: 'prod_1',
          name: 'Royal Basmati Rice 5kg',
          qty: 20,
          unit: 'bag',
          costPrice: 420,
          mrp: 550,
          sellPrice: 499,
          gstPct: 5,
          hsn: '1006',
          taxAmount: 420,
          totalAmount: 8820,
        },
      ],
      subtotal: 8400,
      taxAmount: 420,
      totalAmount: 8820,
      paymentStatus: 'paid',
      paymentMode: 'bank',
      paidAmount: 8820,
      notes: 'Monthly stock inward delivery',
      createdAt: '2026-09-25T10:30:00.000Z',
    },
  ],
  branches: [
    {
      id: 'branch_main',
      name: 'Main Bazaar Branch',
      code: 'BR-01',
      address: 'Main Bazaar Road, Pune',
      phone: '+91 98765 43210',
    },
  ],
  activeBranchId: 'branch_main',
};

export async function createDefaultDatabase(): Promise<AppDatabase> {
  const defaultPwHash = await hashPassword('Shop@2024');
  return {
    ...INITIAL_DATABASE,
    auth: {
      ...INITIAL_DATABASE.auth!,
      pwHash: defaultPwHash,
    },
  };
}
