/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  supplierId?: string | null;
  mrp?: number;
  sellPrice?: number;
  buyPrice?: number;
  qty?: number;
  unit?: string;
  price?: number; // alias for sellPrice
  stock?: number; // alias for qty
  cost?: number; // alias for buyPrice
  sku?: string;
  batchNo?: string;
  updatedAt?: string;
  lowStockAlert?: number | null;
  expiryDate?: string; // YYYY-MM-DD
  nearExpiryDays?: number | null;
  hsn?: string;
  createdAt?: string;
  subcategory?: string;
  brand?: string;
  variant?: string;
  wholesalePrice?: number;
  mfgDate?: string; // YYYY-MM-DD
  notes?: string;
  tags?: string;
  isFavorite?: boolean;
  image?: string; // base64 image data
  gstPct?: number; // product-specific GST rate (e.g. 5, 12, 18)
  batchCode?: string;
  shelfLocation?: string; // Shelf/Rack/Bin management
  hasAltUnit?: boolean;
  altUnitName?: string;
  altUnitFactor?: number;
  secondaryUnitName?: string; // e.g. "piece", "gram", "strip"
  conversionFactor?: number; // e.g. 24, meaning 1 base unit (box) = 24 secondary units (piece)
  secondaryUnitPrice?: number; // optional custom sell price per secondary unit
  branchId?: string; // optional branch isolation identifier
  bomItems?: { productId: string; qtyNeeded: number }[];
  isGeneratedBarcode?: boolean;
  barcodeType?: 'scanned' | 'generated';
}

export interface SaleItem {
  id?: string;
  productId?: string;
  name: string;
  price: number;
  cost?: number;
  mrp?: number;
  buyPrice?: number;
  qty: number;
  unit: string;
  selectedUnit?: string; // unit used when item was sold (e.g. 'pcs' vs 'box')
  unitConversionRatio?: number; // multiplier applied to base stock (e.g. 1/24)
  baseQtyDeduction?: number; // actual base stock units deducted
  returnedQty?: number;
  shelfLocation?: string;
  hsn?: string;
  gstPct?: number;
}

export interface Sale {
  id: string;
  billNo: string | number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  customer: string;
  customerId?: string;
  customerPhone?: string;
  customerAddress?: string;
  staffId?: string;
  staffName?: string;
  branchId?: string; // branch where sale took place
  items: SaleItem[];
  subtotal: number;
  discount: number;
  discountPct?: number;
  gst: number;
  gstPct?: number;
  total: number;
  profit?: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit' | 'split';
  splitDetails?: { 
    cashAmount: number; 
    upiAmount: number; 
    cardAmount?: number; 
    creditAmount?: number; 
  };
  tendered?: number;
  change?: number;
  creditPaid?: boolean;
  voided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
  creditCustId?: string | null;
  pointsRedeemed?: number;
  pointsEarned?: number;
  returnCreditNoteId?: string;
  returnedTotal?: number;
  interStateGst?: boolean; // toggle to split CGST/SGST or apply full IGST
  upiTxnId?: string; // UPI Transaction Reference / UTR Number
  mdrDetails?: MdrDetails; // Government of India UPI MDR details (> Rs. 1999)
  mdrSurcharge?: number; // Total MDR + 18% GST fee added to bill when 'with_mdr' chosen
  createdAt?: string | number;
  timestamp?: string | number;
}

export interface MdrSplitChunk {
  partNumber: number;
  amount: number;
  isMaxChunk: boolean;
  paid?: boolean;
}

export interface MdrDetails {
  applied: boolean;
  option: 'with_mdr' | 'without_mdr';
  baseAmount: number;
  mdrRate: number; // 0.004 (0.40%)
  baseMdr: number; // baseAmount * 0.40% (capped at 300)
  gstRate: number; // 0.18 (18%)
  gstOnMdr: number; // baseMdr * 0.18
  totalMdr: number; // baseMdr + gstOnMdr
  totalPaidWithMdr?: number; // baseAmount + totalMdr
  splitChunks?: MdrSplitChunk[];
}

export interface KhataEntry {
  id: string;
  date: string;
  desc: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  gstin?: string;
  createdAt?: string;
  balance?: number; // running credit balance
  khataBalance?: number; // running balance (positive = they owe)
  khataLedger?: KhataEntry[];
  loyaltyPoints?: number;
  lastReminderSent?: string; // ISO timestamp of last payment reminder
}

export interface Expense {
  id: string;
  title?: string; // name/title
  desc?: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  time?: string;
  paymentMode?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address: string;
  gstin?: string;
  balance?: number;
}

export interface PurchaseItem {
  id: string;
  name: string;
  qty: number;
  buyPrice: number;
  unit: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseItem[];
  total: number;
  date: string; // YYYY-MM-DD
  time: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  phone: string;
  pin?: string;
  fpId?: string | null;
  biometricEnabled?: boolean;
  commissionPct?: number;
  active?: boolean;
}

export interface StaffActivityLog {
  id: string;
  staffId: string;
  staffName: string;
  loginTime: string; // ISO string or locales
  logoutTime: string | null; // ISO string, or null if active
  durationMs: number | null; // null if active
}

export interface Settings {
  shopName: string;
  tagline?: string;
  address: string;
  phone: string;
  email?: string;
  gstin: string;
  fssai?: string;
  upi?: string;
  upiId?: string;
  footer?: string;
  lowStockDefault: number;
  nearExpiryDefault: number;
  requireStaffPin: boolean;
  allowNegativeStock?: boolean; // Permit POS billing even if recorded stock is zero/insufficient
  autoLockSession?: boolean;
  autoLogoutOnDayChange?: boolean; // Automatic logout on date/day change at midnight
  dayChangeWarningMinutes?: number; // Advance warning before midnight (default 5 min)
  logo?: string; // base64 brand logo
  shopLogo?: string; // base64 brand logo for bills & top-left header
  currency?: string; // currency symbol or code e.g. Rs. or ₹ or $
  language?: string; // Active UI language e.g. English, Hindi
  financialYear?: string; // e.g. 2026-27
  gstEnabled?: boolean;
  defaultGstPct?: number;
  state?: string;
  printerPaperWidth?: '58mm' | '80mm';
  thermalFontSize?: 'small' | 'normal' | 'large';
  invoiceTemplate?: string;
  receiptHeader?: string;
  footerTerms?: string;
  autoPrintReceipt?: boolean;
  lastBackupTime?: string;
  // Loyalty Program Settings
  loyaltyEnabled?: boolean; // Enable or disable loyalty rewards
  loyaltyPointValue?: number; // Value of 1 point in currency (e.g. 1 point = ₹1, default: 1)
  loyaltyPointsPerSpend?: number; // Rs. spend required to earn 1 point (default: 50, meaning ₹50 spend = 1 point)
  // Bill Format Settings (Vyapar-Style Formats)
  billFormat?: 'regular' | 'thermal' | 'stylish' | 'classic' | 'simple' | 'retail';
  preferredReceiptPaperSize?: '58mm' | '80mm';
  showShopNameOnBill?: boolean;
  showAddressOnBill?: boolean;
  showPhoneOnBill?: boolean;
  showGstinOnBill?: boolean;
  showFssaiOnBill?: boolean;
  showDateOnBill?: boolean;
  showCustomerOnBill?: boolean;
  showStaffOnBill?: boolean;
  showBarcodeOnBill?: boolean;
  showUpiQrOnBill?: boolean;
  showFooterOnBill?: boolean;
  showTermsOnBill?: boolean;
  termsTextOnBill?: string;
  // Barcode Label Typography & Brand Styling
  barcodeLabelShopNameFont?: 'serif-bold' | 'serif-italic' | 'sans-bold' | 'sans-black' | 'mono-bold';
  barcodeLabelShopNameColor?: 'indigo' | 'crimson' | 'emerald' | 'purple' | 'bronze' | 'charcoal' | 'black';
}

export type ShopSettings = Settings;

export interface Auth {
  userId: string;
  pwHash: string;
  fpId: string | null;
  rpId: string | null;
  firstLogin: boolean;
  attempts: number;
  lockUntil: number;
}

export interface Estimate {
  id: string;
  estimateNo: string;
  date: string;
  customer?: string;
  customerName?: string;
  customerPhone: string;
  customerAddress: string;
  items: (SaleItem | { name: string; price: number; qty: number; unit?: string })[];
  subtotal?: number;
  discount?: number;
  gst?: number;
  total: number;
  convertedToInvoice?: boolean;
  convertedInvoiceId?: string;
}

export interface DeliveryChallan {
  id: string;
  challanNo: string;
  date: string;
  customer?: string;
  customerName?: string;
  customerPhone?: string;
  items: (SaleItem | { name: string; qty: number; unit?: string; shelfLocation?: string })[];
  total?: number;
  vehicleNo?: string;
  status?: string;
}

export interface CreditDebitNote {
  id: string;
  noteNo: string;
  type: string;
  date: string;
  partyName: string;
  invoiceNo?: string;
  items?: SaleItem[];
  total?: number;
  amount: number;
  reason: string;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  legalName?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  state?: string;
  active?: boolean;
}

export interface AppDatabase {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  suppliers: Supplier[];
  purchases: PurchaseOrder[];
  staff: Staff[];
  settings: Settings;
  auth: Auth;
  meta: {
    billNo: number | string;
    estimateNo?: number;
    challanNo?: number;
    noteNo?: number;
  };
  estimates?: Estimate[];
  deliveryChallans?: DeliveryChallan[];
  creditDebitNotes?: CreditDebitNote[];
  branches?: Branch[];
  activeBranchId?: string;
  staffActivityLogs?: StaffActivityLog[];
  documents?: CommercialDocument[];
  stockAdjustments?: StockAdjustment[];
  purchaseBills?: PurchaseBill[];
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  oldStock: number;
  newStock: number;
  adjustmentQty: number; // e.g. -2, +5
  reason: 'physical_audit' | 'damaged' | 'expired' | 'theft' | 'sample' | 'other';
  notes?: string;
  date: string;
  timestamp?: string | number;
  staffName?: string;
}

export interface PurchaseBillItem {
  id?: string;
  productId?: string;
  name: string;
  qty: number;
  unit: string;
  costPrice: number;
  mrp?: number;
  sellPrice?: number;
  gstPct?: number;
  hsn?: string;
  taxAmount?: number;
  totalAmount: number;
}

export interface PurchaseBill {
  id: string;
  billNo: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  date: string; // YYYY-MM-DD
  items: PurchaseBillItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentMode?: 'cash' | 'bank' | 'upi' | 'credit';
  paidAmount?: number;
  notes?: string;
  createdAt?: string;
}

export interface CashDenominationCount {
  [denomination: number]: number;
}

export type CommercialDocType =
  | 'quotation'
  | 'purchase_order'
  | 'delivery_challan'
  | 'credit_note'
  | 'debit_note'
  | 'estimate'
  | 'challan';

export interface CommercialDocument {
  id: string;
  docNumber: string;
  type: CommercialDocType;
  date: string;
  dueDate?: string;
  partyName: string;
  partyPhone?: string;
  partyGstin?: string;
  partyAddress?: string;
  items: { name: string; qty: number; price: number; unit?: string }[];
  subtotal: number;
  tax?: number;
  total: number;
  status: string;
  notes?: string;
  createdAt?: string;
}

export interface CartItem {
  id?: string;
  productId?: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
  mrp?: number;
  cost?: number;
  buyPrice?: number;
  gstPct?: number;
  hsn?: string;
  discountPct?: number;
  taxPct?: number;
  product?: Product;
  selectedUnit?: string;
  unitConversionRatio?: number;
  baseQtyDeduction?: number;
  returnedQty?: number;
  shelfLocation?: string;
}

export type DashboardWidgetId =
  | 'store_profile'
  | 'alerts_banners'
  | 'summary_cards'
  | 'daily_sales_chart'
  | 'quick_actions'
  | 'predictive_alerts'
  | 'recent_transactions';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  name: string;
  description: string;
  iconName: string;
  visible: boolean;
}
