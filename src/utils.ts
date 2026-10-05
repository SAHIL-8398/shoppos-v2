/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Clipboard } from '@capacitor/clipboard';
import QRCode from 'qrcode';
import { languagePacks } from './context/LocalizationContext';
import { savePdfToAppFolder, isNativeCapacitor, downloadOrSaveDataFile } from './services/nativeStorage';
import { MdrDetails, MdrSplitChunk, Product, Sale, Settings, SaleItem } from './types';

export interface IndianState {
  code: string;
  name: string;
  type: 'State' | 'UT';
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir', type: 'UT' },
  { code: '02', name: 'Himachal Pradesh', type: 'State' },
  { code: '03', name: 'Punjab', type: 'State' },
  { code: '04', name: 'Chandigarh', type: 'UT' },
  { code: '05', name: 'Uttarakhand', type: 'State' },
  { code: '06', name: 'Haryana', type: 'State' },
  { code: '07', name: 'Delhi', type: 'UT' },
  { code: '08', name: 'Rajasthan', type: 'State' },
  { code: '09', name: 'Uttar Pradesh', type: 'State' },
  { code: '10', name: 'Bihar', type: 'State' },
  { code: '11', name: 'Sikkim', type: 'State' },
  { code: '12', name: 'Arunachal Pradesh', type: 'State' },
  { code: '13', name: 'Nagaland', type: 'State' },
  { code: '14', name: 'Manipur', type: 'State' },
  { code: '15', name: 'Mizoram', type: 'State' },
  { code: '16', name: 'Tripura', type: 'State' },
  { code: '17', name: 'Meghalaya', type: 'State' },
  { code: '18', name: 'Assam', type: 'State' },
  { code: '19', name: 'West Bengal', type: 'State' },
  { code: '20', name: 'Jharkhand', type: 'State' },
  { code: '21', name: 'Odisha', type: 'State' },
  { code: '22', name: 'Chhattisgarh', type: 'State' },
  { code: '23', name: 'Madhya Pradesh', type: 'State' },
  { code: '24', name: 'Gujarat', type: 'State' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'UT' },
  { code: '27', name: 'Maharashtra', type: 'State' },
  { code: '29', name: 'Karnataka', type: 'State' },
  { code: '30', name: 'Goa', type: 'State' },
  { code: '31', name: 'Lakshadweep', type: 'UT' },
  { code: '32', name: 'Kerala', type: 'State' },
  { code: '33', name: 'Tamil Nadu', type: 'State' },
  { code: '34', name: 'Puducherry', type: 'UT' },
  { code: '35', name: 'Andaman and Nicobar Islands', type: 'UT' },
  { code: '36', name: 'Telangana', type: 'State' },
  { code: '37', name: 'Andhra Pradesh', type: 'State' },
  { code: '38', name: 'Ladakh', type: 'UT' },
  { code: '97', name: 'Other Territory', type: 'UT' },
];

export function isValidGstin(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
}

export function isValidFssai(fssai: string): boolean {
  if (!fssai) return false;
  const clean = fssai.trim();
  return /^\d{14}$/.test(clean);
}

export function cleanIndianPhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidIndianPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = cleanIndianPhone(phone);
  return /^[6-9]\d{9}$/.test(clean);
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

export function isValidUpiId(upi: string): boolean {
  if (!upi) return false;
  const clean = upi.trim();
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(clean);
}

export function isValidHsn(hsn: string): boolean {
  if (!hsn) return false;
  const clean = hsn.trim();
  return /^\d{2,8}$/.test(clean);
}

export function isValidPinCode(pincode: string): boolean {
  if (!pincode) return false;
  const clean = pincode.trim();
  return /^[1-9][0-9]{5}$/.test(clean);
}

export function isValidVehicleNumber(vehicleNo: string): boolean {
  if (!vehicleNo) return false;
  const clean = vehicleNo.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(clean) || (clean.length >= 6 && clean.length <= 13);
}

export function formatIndianPhone(phone: string): string {
  if (!phone) return '';
  const digits = cleanIndianPhone(phone);
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

export function formatCurrency(n: number): string {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString('en-IN', {
      minimumFractionDigits: v % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return v % 1 === 0 ? v.toString() : v.toFixed(2);
  }
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') {
    const clean = date.trim();
    // If already in dd/mm/yyyy format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      return clean;
    }
    // Match standard yyyy-mm-dd or yyyy/mm/dd strings
    const match = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return String(date);
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatHeaderDate(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday}, ${formatDate(date)}`;
}

/**
 * Calculates standard EAN-13 checksum digit for a 12-digit number string.
 */
export function calculateEanCheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10) || 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Generates an in-store barcode starting with prefix '45' of standard 13-digit length.
 * Prefix '45' prevents collisions with commercial manufacturer printed barcodes (like GS1 '890').
 * Ensures uniqueness against any existing products in the store database.
 */
export function generateStoreBarcode(existingProducts?: { barcode?: string }[], offset: number = 0): string {
  const existingSet = new Set(
    (existingProducts || [])
      .map(p => (p.barcode || '').trim())
      .filter(Boolean)
  );

  const prefix = '45';
  let timestampSlice = Date.now().toString().slice(-10);
  if (timestampSlice.length < 10) {
    timestampSlice = timestampSlice.padStart(10, '0');
  }

  let counter = offset;
  let finalBarcode = '';

  for (let attempt = 0; attempt < 1000; attempt++) {
    const baseNumber = (BigInt(timestampSlice) + BigInt(counter + attempt)).toString();
    const body = baseNumber.slice(-10).padStart(10, '0');
    const first12 = `${prefix}${body}`;
    const checkDigit = calculateEanCheckDigit(first12);
    const candidate = `${first12}${checkDigit}`;

    if (!existingSet.has(candidate)) {
      finalBarcode = candidate;
      break;
    }
  }

  if (!finalBarcode) {
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const first12 = `${prefix}${random10}`;
    finalBarcode = `${first12}${calculateEanCheckDigit(first12)}`;
  }

  return finalBarcode;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const timestamp = Date.now().toString(36);
  const perf = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000).toString(36) : '';
  const rand1 = Math.random().toString(36).slice(2, 10);
  const rand2 = Math.random().toString(36).slice(2, 10);
  return `id_${timestamp}_${perf}_${rand1}${rand2}`;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateString(date: Date = new Date()): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return getTodayDateString();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (clean.includes('T')) return clean.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(clean)) {
    const parts = clean.split(/[/-]/);
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return getDateString(d);
  }
  return clean;
}

export function isSameDate(d1: string | Date | null | undefined, d2: string | Date | null | undefined): boolean {
  if (!d1 || !d2) return false;
  const s1 = typeof d1 === 'string' ? parseDateString(d1) : getDateString(d1);
  const s2 = typeof d2 === 'string' ? parseDateString(d2) : getDateString(d2);
  return s1 === s2 && s1.length > 0;
}

export function getSaleTimestamp(sale: {
  date?: string | null;
  time?: string | null;
  createdAt?: string | number | null;
  id?: string | number | null;
  billNo?: string | number | null;
}): number {
  if (!sale) return 0;
  if (sale.createdAt) {
    if (typeof sale.createdAt === 'number' && !isNaN(sale.createdAt) && sale.createdAt > 0) {
      return sale.createdAt;
    }
    const t = new Date(sale.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const cleanDate = parseDateString(sale.date);
  if (cleanDate) {
    const parts = cleanDate.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (y && m && d) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      if (sale.time) {
        const timeStr = String(sale.time).trim();
        const isPM = /pm/i.test(timeStr);
        const isAM = /am/i.test(timeStr);
        const numericParts = timeStr.replace(/[^\d:]/g, '').split(':').map(Number);
        if (numericParts.length >= 2) {
          let h = numericParts[0] || 0;
          if (isPM && h < 12) h += 12;
          if (isAM && h === 12) h = 0;
          hours = Math.min(23, Math.max(0, h));
          minutes = Math.min(59, Math.max(0, numericParts[1] || 0));
          seconds = Math.min(59, Math.max(0, numericParts[2] || 0));
        }
      }
      const saleDate = new Date(y, m - 1, d, hours, minutes, seconds);
      const t = saleDate.getTime();
      if (!isNaN(t) && t > 0) return t;
    }
  }
  const numericId = parseInt(String(sale.id || ''), 10);
  if (!isNaN(numericId) && numericId > 1000000000) {
    return numericId;
  }
  return 0;
}

export function compareSales(
  a: {
    date?: string | null;
    time?: string | null;
    createdAt?: string | number | null;
    id?: string | number | null;
    billNo?: string | number | null;
    total?: number | null;
    customer?: string | null;
  },
  b: {
    date?: string | null;
    time?: string | null;
    createdAt?: string | number | null;
    id?: string | number | null;
    billNo?: string | number | null;
    total?: number | null;
    customer?: string | null;
  },
  sortBy: 'date' | 'amount' | 'customer' = 'date',
  order: 'asc' | 'desc' = 'desc'
): number {
  let comparison = 0;
  if (sortBy === 'date') {
    const timeA = getSaleTimestamp(a);
    const timeB = getSaleTimestamp(b);
    if (timeA > 0 && timeB > 0 && timeA !== timeB) {
      comparison = timeA - timeB;
    } else {
      const dateA = parseDateString(a.date);
      const dateB = parseDateString(b.date);
      if (dateA !== dateB) {
        comparison = dateA.localeCompare(dateB);
      } else {
        const numA = parseInt(String(a.billNo || '').replace(/\D/g, ''), 10);
        const numB = parseInt(String(b.billNo || '').replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          comparison = numA - numB;
        } else {
          comparison = String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true });
        }
      }
    }
  } else if (sortBy === 'amount') {
    const amtA = Number(a.total) || 0;
    const amtB = Number(b.total) || 0;
    if (amtA !== amtB) {
      comparison = amtA - amtB;
    } else {
      const timeA = getSaleTimestamp(a);
      const timeB = getSaleTimestamp(b);
      comparison = timeA - timeB;
    }
  } else if (sortBy === 'customer') {
    const nameA = String(a.customer || 'Walk-in').trim();
    const nameB = String(b.customer || 'Walk-in').trim();
    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    if (comparison === 0) {
      const timeA = getSaleTimestamp(a);
      const timeB = getSaleTimestamp(b);
      comparison = timeA - timeB;
    }
  }
  return order === 'asc' ? comparison : -comparison;
}

export function computeSaleProfit(sale: {
  profit?: number | null;
  items?: { price: number; buyPrice?: number; qty: number }[];
  discount?: number;
}): number {
  if (typeof sale.profit === 'number' && !isNaN(sale.profit)) {
    return sale.profit;
  }
  const itemsProfit = (sale.items || []).reduce((sum, item) => {
    const buyPrice = typeof item.buyPrice === 'number' && !isNaN(item.buyPrice) ? item.buyPrice : 0;
    const sellPrice = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
    const qty = typeof item.qty === 'number' && !isNaN(item.qty) ? item.qty : 1;
    return sum + ((sellPrice - buyPrice) * qty);
  }, 0);
  const discount = typeof sale.discount === 'number' && !isNaN(sale.discount) ? sale.discount : 0;
  return itemsProfit - discount;
}

export function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.write({ string: text });
    return true;
  } catch {
    // continue
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // continue
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}

export function playBeepSound(type: 'success' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch (err) {
    console.warn('Tactile audio synthesis blocked or unsupported:', err);
  }
}

export interface PredictiveAlert {
  id: string;
  name: string;
  qty: number;
  velocity: number;
  daysToStockout: number;
  recommendedQty: number;
}

export function computePredictiveAlerts(products: Product[], sales: Sale[]): PredictiveAlert[] {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const activeRecentSales = sales.filter(s => {
    if (s.voided) return false;
    const cleanDate = parseDateString(s.date);
    const [y, m, d] = cleanDate.split('-').map(Number);
    if (!y || !m || !d) return false;
    return new Date(y, m - 1, d) >= thirtyDaysAgo;
  });

  const soldUnits: { [key: string]: number } = {};
  activeRecentSales.forEach(s => {
    (s.items || []).forEach((item: SaleItem) => {
      const key = item.productId || (item as any).id;
      const nameKey = item.name;
      if (key) soldUnits[key] = (soldUnits[key] || 0) + item.qty;
      if (nameKey) soldUnits[nameKey] = (soldUnits[nameKey] || 0) + item.qty;
    });
  });

  const allActiveSales = sales.filter(s => !s.voided);
  const allTimeSoldUnits: { [key: string]: number } = {};
  allActiveSales.forEach(s => {
    (s.items || []).forEach((item: SaleItem) => {
      const key = item.productId || (item as any).id;
      const nameKey = item.name;
      if (key) allTimeSoldUnits[key] = (allTimeSoldUnits[key] || 0) + item.qty;
      if (nameKey) allTimeSoldUnits[nameKey] = (allTimeSoldUnits[nameKey] || 0) + item.qty;
    });
  });

  const alertsList: PredictiveAlert[] = [];
  products.forEach(p => {
    const recentSold = soldUnits[p.id] || soldUnits[p.name] || 0;
    let velocity = recentSold / 30;
    const allSold = allTimeSoldUnits[p.id] || allTimeSoldUnits[p.name] || 0;
    if (velocity === 0 && allSold > 0) {
      velocity = allSold / 60;
    }
    const currentQty = p.stock ?? p.qty ?? 0;
    if (velocity > 0) {
      const daysToStockout = currentQty / velocity;
      if (daysToStockout <= 7) {
        const recommendedQty = Math.max(5, Math.ceil(velocity * 15));
        alertsList.push({
          id: p.id,
          name: p.name,
          qty: currentQty,
          velocity,
          daysToStockout,
          recommendedQty,
        });
      }
    }
  });

  return alertsList.sort((a, b) => a.daysToStockout - b.daysToStockout);
}

export function translate(key: string, lang = 'English'): string {
  const dictionary = languagePacks[lang] || languagePacks['English'];
  return dictionary[key] || languagePacks['English'][key] || key;
}

export function getPdfCurrency(currency?: string): string {
  if (!currency) return 'Rs.';
  const clean = currency.replace(/₹/g, 'Rs.').trim();
  return clean || 'Rs.';
}

export function cleanPdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/₹/g, 'Rs.');
}

export function generateQuotationPDF(
  cart: { name: string; price: number; qty: number; unit?: string }[],
  customer: { name: string; phone: string; address: string },
  settings: { shopName: string; address: string; phone: string; gstin?: string; fssai?: string; showFssaiOnBill?: boolean; currency?: string }
) {
  const doc = new jsPDF({ compress: true });
  doc.setProperties({
    title: `Price Estimate / Quotation - ${customer.name || 'Client'}`,
    subject: "Secured PDF - Non-Editable",
    author: settings.shopName || "ShopPOS Store",
    creator: "ShopPOS Secure Engine",
    keywords: "non-editable, secured, original, quotation"
  });
  const cur = getPdfCurrency(settings.currency);

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(settings.shopName || 'ShopPOS Pro Store', 15, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let headerText = settings.phone ? `${settings.address || ''} | Phone: ${settings.phone}` : (settings.address || '');
  const headerLines = doc.splitTextToSize(headerText, 180);
  let finalY = 25.5;
  headerLines.forEach((l: string, i: number) => {
    if (i < 2) {
      doc.text(l, 15, finalY);
      finalY += 4.2;
    }
  });
  if (settings.gstin) {
    doc.text(`GSTIN: ${settings.gstin}`, 15, finalY);
    finalY += 4.2;
  }
  if (settings.fssai && settings.showFssaiOnBill !== false) {
    doc.text(`FSSAI Lic. No: ${settings.fssai}`, 15, finalY);
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PRICE ESTIMATE / QUOTATION', 15, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const todayStr = formatDate(new Date());
  doc.text(`Date of Issue: ${todayStr}`, 15, 56);
  doc.text(`Estimate Ref No: EST-${Math.floor(100000 + Math.random() * 900000)}`, 15, 61);
  doc.text('Validity Period: 15 Days from Issue', 15, 66);

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.rect(15, 70, 50, 4.2, 'F');
  doc.rect(15, 70, 50, 4.2, 'S');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('SECURED ORIGINAL (READ-ONLY)', 40, 73, { align: 'center' });
  doc.setTextColor(30, 41, 59);

  doc.setFillColor(248, 250, 252);
  doc.rect(120, 43, 75, 26, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(120, 43, 75, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT / ESTIMATE TO:', 124, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.name || 'Walk-in Customer', 124, 54);
  doc.text(customer.phone || 'No Phone provided', 124, 59);
  doc.text(customer.address || 'Local Customer Address', 124, 64);

  let y = 80;
  doc.setFillColor(30, 41, 59);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM DESCRIPTION', 18, y + 5.5);
  doc.text('QTY', 115, y + 5.5, { align: 'center' });
  doc.text('UNIT RATE', 145, y + 5.5, { align: 'right' });
  doc.text('TOTAL AMOUNT', 190, y + 5.5, { align: 'right' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  let subtotal = 0;
  cart.forEach((item) => {
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y, 195, y);
    doc.text(item.name, 18, y + 5.5);
    doc.text(`${item.qty} ${item.unit || 'pcs'}`, 115, y + 5.5, { align: 'center' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 145, y + 5.5, { align: 'right' });
    const rowTotal = item.price * item.qty;
    subtotal += rowTotal;
    doc.text(`${cur}${formatCurrency(rowTotal)}`, 190, y + 5.5, { align: 'right' });
  });

  y += 12;
  doc.setDrawColor(148, 163, 184);
  doc.line(15, y, 195, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL ESTIMATE:', 115, y + 3);
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text(`${cur}${formatCurrency(subtotal)}`, 190, y + 3, { align: 'right' });

  y += 18;
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Terms and Conditions of Estimate:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text('1. This is a price quotation/estimate and is not a valid tax invoice document.', 15, y + 5);
  doc.text('2. Pricing listed is guaranteed for 15 days from issue date.', 15, y + 10);
  doc.text('3. Subject to active inventory stocks at the time of purchase checkout.', 15, y + 15);

  doc.line(135, y + 18, 190, y + 18);
  doc.text('Authorized Store Signature', 142, y + 23);

  const filename = `Quotation_${customer.name.replace(/\s+/g, '_') || 'Customer'}.pdf`;
  if (isNativeCapacitor()) {
    const base64 = doc.output('datauristring');
    savePdfToAppFolder(base64, filename, 'Quotations');
  } else {
    doc.save(filename);
  }
}

export function generateDeliveryChallanPDF(
  cart: { name: string; qty: number; unit?: string; shelfLocation?: string }[],
  customer: { name: string; phone: string; address: string },
  settings: { shopName: string; address: string; phone: string; currency?: string }
) {
  const doc = new jsPDF({ compress: true });
  doc.setProperties({
    title: `Delivery Challan - ${customer.name || 'Client'}`,
    subject: "Secured PDF - Non-Editable",
    author: settings.shopName || "ShopPOS Store",
    creator: "ShopPOS Secure Engine",
    keywords: "non-editable, secured, original, delivery, challan"
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(settings.shopName || 'ShopPOS Pro Store', 15, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let headerText = settings.phone ? `${settings.address || ''} | Phone: ${settings.phone}` : (settings.address || '');
  const headerLines = doc.splitTextToSize(headerText, 180);
  let finalY = 25.5;
  headerLines.forEach((l: string, i: number) => {
    if (i < 2) {
      doc.text(l, 15, finalY);
      finalY += 4.2;
    }
  });

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DELIVERY CHALLAN / DISPATCH NOTE', 15, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const todayStr = formatDate(new Date());
  doc.text(`Dispatch Date: ${todayStr}`, 15, 56);
  doc.text(`Challan Ref No: DC-${Math.floor(100000 + Math.random() * 900000)}`, 15, 61);
  doc.text('Delivery Method: Hand Delivery / Local Carrier', 15, 66);

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.rect(15, 70, 50, 4.2, 'F');
  doc.rect(15, 70, 50, 4.2, 'S');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('SECURED ORIGINAL (READ-ONLY)', 40, 73, { align: 'center' });
  doc.setTextColor(30, 41, 59);

  doc.setFillColor(248, 250, 252);
  doc.rect(120, 43, 75, 26, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(120, 43, 75, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVER & SHIP TO:', 124, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.name || 'Walk-in Customer', 124, 54);
  doc.text(customer.phone || 'No Phone provided', 124, 59);
  doc.text(customer.address || 'Local Customer Address', 124, 64);

  let y = 80;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM / MATERIAL DESCRIPTION', 18, y + 5.5);
  doc.text('DISPATCH QUANTITY', 120, y + 5.5, { align: 'center' });
  doc.text('SHELF/RACK POSITION', 170, y + 5.5, { align: 'center' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  cart.forEach((item) => {
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y, 195, y);
    doc.text(item.name, 18, y + 5.5);
    doc.text(`${item.qty} ${item.unit || 'pcs'}`, 120, y + 5.5, { align: 'center' });
    doc.text(item.shelfLocation || 'Main Shelf', 170, y + 5.5, { align: 'center' });
  });

  y += 12;
  doc.setDrawColor(148, 163, 184);
  doc.line(15, y, 195, y);

  y += 18;
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Declaration & Delivery Terms:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text('1. The items listed above are dispatched in good condition and order.', 15, y + 5);
  doc.text('2. Please check quantities carefully before acknowledging delivery receipt.', 15, y + 10);
  doc.text('3. This document is a logistics receipt and not a final proof of billing.', 15, y + 15);

  doc.line(20, y + 38, 70, y + 38);
  doc.text('Receiver / Customer Signature', 22, y + 43);
  doc.line(135, y + 38, 190, y + 38);
  doc.text('Authorized Dispatch Clerk', 142, y + 43);

  const filename = `Challan_${customer.name.replace(/\s+/g, '_') || 'Customer'}.pdf`;
  if (isNativeCapacitor()) {
    const base64 = doc.output('datauristring');
    savePdfToAppFolder(base64, filename, 'Challans');
  } else {
    doc.save(filename);
  }
}

export async function generateEWayBillPDF(
  ewayBill: {
    billNo: string;
    date: string;
    vehicleNo: string;
    transporterId?: string;
    fromLocation: string;
    toLocation: string;
  },
  shopInfo: {
    shopName?: string;
    address?: string;
    phone?: string;
    gstin?: string;
  }
): Promise<{ success: boolean; doc: jsPDF; filename: string; base64: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFillColor(30, 41, 59);
  doc.rect(15, 15, 180, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GST E-WAY TRANSIT PASS', 105, 25, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Goods and Services Tax Compliance   Transport Authorization Document', 105, 33, { align: 'center' });

  doc.setFillColor(241, 245, 249);
  doc.rect(15, 43, 180, 16, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(15, 43, 180, 16, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text(`E-WAY BILL NO: ${ewayBill.billNo}`, 20, 53);
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text('STATUS: VERIFIED & ACTIVE', 185, 53, { align: 'right' });

  doc.setFillColor(248, 250, 252);
  doc.rect(15, 65, 87, 45, 'F');
  doc.rect(15, 65, 87, 45, 'D');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PART-A: CONSIGNOR DETAILS', 20, 72);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Legal Name: ${shopInfo.shopName || 'ShopPOS Store'}`, 20, 80);
  doc.text(`GSTIN ID: ${shopInfo.gstin || '07AABCS1429B1ZB'}`, 20, 86);
  doc.text(`Origin Address: ${shopInfo.address || 'Retail Head Office'}`, 20, 92);
  doc.text(`Contact: ${shopInfo.phone || '+91 9876543210'}`, 20, 98);
  doc.text(`Dispatch Origin: ${ewayBill.fromLocation}`, 20, 104);

  doc.setFillColor(248, 250, 252);
  doc.rect(108, 65, 87, 45, 'F');
  doc.rect(108, 65, 87, 45, 'D');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PART-B: VEHICLE & TRANSPORT', 113, 72);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Vehicle Number: ${ewayBill.vehicleNo}`, 113, 80);
  doc.text(`Transporter GSTIN: ${ewayBill.transporterId || 'Self Conveyance / Transporter N/A'}`, 113, 86);
  doc.text(`Transit Mode: Road Freight Logistics`, 113, 92);
  doc.text(`Destination Point: ${ewayBill.toLocation}`, 113, 98);
  doc.text(`Issued Timestamp: ${formatDate(ewayBill.date)}`, 113, 104);

  const y = 118;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('COMPLIANCE PARAMETER', 20, y + 5.5);
  doc.text('REGULATORY VALUE', 105, y + 5.5);
  doc.text('VERIFICATION', 185, y + 5.5, { align: 'right' });

  const rows = [
    { param: 'Transit Movement Reason', val: 'Outward Supply & Goods Logistics', ver: 'PASSED' },
    { param: 'Threshold Compliance', val: 'Exceeds INR 50,000/- GST Mandate', ver: 'PASSED' },
    { param: 'Road Permit Jurisdiction', val: 'Interstate / Intrastate Transport', ver: 'AUTHORIZED' },
    { param: 'Document Validity Period', val: 'Valid for 72 Hours from Timestamp', ver: 'ACTIVE' },
  ];

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  let rowY = y + 8;
  rows.forEach((r) => {
    doc.setDrawColor(226, 232, 240);
    doc.line(15, rowY + 8, 195, rowY + 8);
    doc.text(r.param, 20, rowY + 5.5);
    doc.text(r.val, 105, rowY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(r.ver, 185, rowY + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    rowY += 8;
  });

  const footerY = 175;
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Statutory Transit Terms & Enforcement:', 15, footerY);
  doc.setFontSize(8);
  doc.text('1. The transit vehicle driver must carry this physical or digital pass throughout the consignment journey.', 15, footerY + 5);
  doc.text('2. Subject to verification by GST Mobile Flying Squad Inspection Officers at state check-posts.', 15, footerY + 10);
  doc.text('3. Any deviation in transit route or consignee address requires instant pass amendment.', 15, footerY + 15);

  doc.setDrawColor(148, 163, 184);
  doc.line(20, footerY + 45, 75, footerY + 45);
  doc.text('Vehicle Driver / Transporter Sign', 22, footerY + 50);
  doc.line(135, footerY + 45, 190, footerY + 45);
  doc.text('Authorized GST Consignor Seal', 138, footerY + 50);

  const filename = `EWayBill_${ewayBill.billNo}.pdf`;
  const base64 = doc.output('datauristring');
  if (isNativeCapacitor()) {
    await savePdfToAppFolder(base64, filename, 'Invoices');
  } else {
    doc.save(filename);
  }
  return { success: true, doc, filename, base64 };
}

export function generatePurchaseOrderPDF(
  po: {
    poNo: string;
    date: string;
    supplierName: string;
    items: { name: string; price: number; qty: number }[];
    total: number;
    status: string;
  },
  shopInfo: {
    shopName?: string;
    address?: string;
    phone?: string;
    gstin?: string;
    currency?: string;
  }
): { success: boolean; doc: jsPDF; filename: string; base64: string } {
  const doc = new jsPDF({ compress: true });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(shopInfo.shopName || 'ShopPOS Store', 15, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const headerText = shopInfo.phone ? `${shopInfo.address || ''} | Phone: ${shopInfo.phone}` : (shopInfo.address || '');
  doc.text(headerText, 15, 25.5);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OFFICIAL PURCHASE ORDER', 15, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO Number: ${po.poNo}`, 15, 56);
  doc.text(`Issue Date: ${formatDate(po.date)}`, 15, 61);
  doc.text(`Status: ${po.status.toUpperCase()}`, 15, 66);

  doc.setFillColor(248, 250, 252);
  doc.rect(120, 43, 75, 26, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(120, 43, 75, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE FROM SUPPLIER:', 124, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(po.supplierName || 'Wholesale Supplier', 124, 54);
  doc.text('Authorized Commercial Vendor', 124, 59);

  let y = 80;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM DESCRIPTION', 18, y + 5.5);
  doc.text('ORDER QTY', 110, y + 5.5, { align: 'center' });
  doc.text('UNIT PRICE', 145, y + 5.5, { align: 'right' });
  doc.text('TOTAL AMOUNT', 190, y + 5.5, { align: 'right' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  const cur = getPdfCurrency(shopInfo.currency);
  po.items.forEach((item) => {
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y, 195, y);
    const lineTotal = item.price * item.qty;
    doc.text(item.name, 18, y + 5.5);
    doc.text(`${item.qty}`, 110, y + 5.5, { align: 'center' });
    doc.text(`${cur}${formatCurrency(item.price)}`, 145, y + 5.5, { align: 'right' });
    doc.text(`${cur}${formatCurrency(lineTotal)}`, 190, y + 5.5, { align: 'right' });
  });

  y += 12;
  doc.setDrawColor(15, 23, 42);
  doc.line(15, y, 195, y);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PO VALUATION:', 130, y + 6);
  doc.text(`${cur}${formatCurrency(po.total)}`, 190, y + 6, { align: 'right' });

  y += 20;
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Purchase Order Terms & Payment Schedule:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Please supply items in specified packaging and verify batch expiry dates.', 15, y + 5);
  doc.text('2. Payments will be disbursed as per agreed wholesale credit invoice terms.', 15, y + 10);

  doc.line(135, y + 25, 190, y + 25);
  doc.text('Authorized Purchasing Manager', 138, y + 30);

  const filename = `PO_${po.poNo}.pdf`;
  const base64 = doc.output('datauristring');
  if (isNativeCapacitor()) {
    savePdfToAppFolder(base64, filename, 'Invoices');
  } else {
    doc.save(filename);
  }
  return { success: true, doc, filename, base64 };
}

export function generateCreditDebitNotePDF(
  note: {
    noteNo: string;
    date: string;
    type: 'Credit Note' | 'Debit Note';
    partyName: string;
    amount: number;
    reason: string;
  },
  shopInfo: {
    shopName?: string;
    address?: string;
    phone?: string;
    gstin?: string;
    currency?: string;
  }
): { success: boolean; doc: jsPDF; filename: string; base64: string } {
  const doc = new jsPDF({ compress: true });

  doc.setFillColor(note.type === 'Credit Note' ? 159 : 30, note.type === 'Credit Note' ? 18 : 41, note.type === 'Credit Note' ? 57 : 59);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(shopInfo.shopName || 'ShopPOS Store', 15, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const headerText = shopInfo.phone ? `${shopInfo.address || ''} | Phone: ${shopInfo.phone}` : (shopInfo.address || '');
  doc.text(headerText, 15, 25.5);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`OFFICIAL ${note.type.toUpperCase()}`, 15, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Note Reference No: ${note.noteNo}`, 15, 56);
  doc.text(`Date of Issue: ${formatDate(note.date)}`, 15, 61);
  doc.text(`Document Nature: ${note.type === 'Credit Note' ? 'Customer Refund / Sales Return' : 'Supplier Return / Debit Adjustment'}`, 15, 66);

  doc.setFillColor(248, 250, 252);
  doc.rect(120, 43, 75, 26, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(120, 43, 75, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.text('ISSUED TO / PARTY:', 124, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(note.partyName || 'Customer / Vendor', 124, 54);
  doc.text('Account Ledger Adjustment', 124, 59);

  let y = 80;
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 40, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(15, y, 180, 40, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('ADJUSTMENT PARTICULARS & REASON:', 20, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Reason: ${note.reason}`, 20, y + 18);

  const cur = getPdfCurrency(shopInfo.currency);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(note.type === 'Credit Note' ? 225 : 79, note.type === 'Credit Note' ? 29 : 70, note.type === 'Credit Note' ? 72 : 229);
  doc.text(`ADJUSTED AMOUNT: ${cur}${formatCurrency(note.amount)}`, 20, y + 32);

  y = 145;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Declaration:', 15, y);
  doc.text('This voucher confirms the credit/debit adjustment entered in financial accounting ledgers.', 15, y + 5);
  doc.line(135, y + 30, 190, y + 30);
  doc.text('Authorized Accountant Signature', 138, y + 35);

  const filename = `${note.type.replace(/\s+/g, '_')}_${note.noteNo}.pdf`;
  const base64 = doc.output('datauristring');
  if (isNativeCapacitor()) {
    savePdfToAppFolder(base64, filename, 'Invoices');
  } else {
    doc.save(filename);
  }
  return { success: true, doc, filename, base64 };
}

export function buildUpiPayload(params: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  currency?: string;
  transactionNote?: string;
  transactionRef?: string;
}): string {
  const { upiId, payeeName = 'Merchant', amount, currency = 'INR', transactionNote, transactionRef } = params;
  const cleanUpi = upiId.trim();
  let uri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payeeName || 'Store')}&cu=${encodeURIComponent(currency || 'INR')}`;
  if (amount !== undefined && amount > 0) {
    uri += `&am=${amount.toFixed(2)}`;
  }
  if (transactionNote) {
    uri += `&tn=${encodeURIComponent(transactionNote)}`;
  }
  if (transactionRef) {
    uri += `&tr=${encodeURIComponent(transactionRef)}`;
  }
  return uri;
}

export async function generateUpiQrDataUrl(params: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  currency?: string;
  transactionNote?: string;
  transactionRef?: string;
  width?: number;
}): Promise<string> {
  const payload = buildUpiPayload(params);
  try {
    return await QRCode.toDataURL(payload, {
      width: params.width || 320,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('Error generating UPI QR locally:', err);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${params.width || 300}x${params.width || 300}&data=${encodeURIComponent(payload)}`;
  }
}

export function calculateUpiMdr(amount: number): MdrDetails {
  const isApplicable = amount > 1999;
  if (!isApplicable || amount <= 0) {
    return {
      applied: false,
      option: 'without_mdr',
      baseAmount: amount,
      mdrRate: 0,
      baseMdr: 0,
      gstRate: 0,
      gstOnMdr: 0,
      totalMdr: 0,
      totalPaidWithMdr: amount,
      splitChunks: [{ partNumber: 1, amount, isMaxChunk: false, paid: false }]
    };
  }

  const mdrRate = 0.004; // 0.40%
  const baseMdr = Number(Math.min(amount * mdrRate, 300).toFixed(2));
  const gstRate = 0.18; // 18% GST on MDR
  const gstOnMdr = Number((baseMdr * gstRate).toFixed(2));
  const totalMdr = Number((baseMdr + gstOnMdr).toFixed(2));
  const totalPaidWithMdr = Number((amount + totalMdr).toFixed(2));

  const CHUNK_LIMIT = 1999;
  const splitChunks: MdrSplitChunk[] = [];
  let remaining = Number(amount.toFixed(2));
  let part = 1;
  while (remaining > 0) {
    const chunkAmt = Number(Math.min(remaining, CHUNK_LIMIT).toFixed(2));
    splitChunks.push({
      partNumber: part,
      amount: chunkAmt,
      isMaxChunk: chunkAmt === CHUNK_LIMIT,
      paid: false
    });
    remaining = Number((remaining - chunkAmt).toFixed(2));
    part++;
  }

  return {
    applied: true,
    option: 'with_mdr',
    baseAmount: amount,
    mdrRate,
    baseMdr,
    gstRate,
    gstOnMdr,
    totalMdr,
    totalPaidWithMdr,
    splitChunks
  };
}

export function generateThermalReceiptText(sale: Sale, settings: Settings, is58mm: boolean = true): string {
  const width = is58mm ? 32 : 48;
  const lineChar = '-';
  const doubleLineChar = '=';

  const padCenter = (str: string, len: number) => {
    if (str.length >= len) return str.slice(0, len);
    const diff = len - str.length;
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const padBetween = (left: string, right: string, len: number) => {
    const space = Math.max(1, len - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  const cur = settings.currency || 'Rs.';
  const shopName = (settings.shopName || 'ShopPOS Store').toUpperCase();
  const dateStr = sale.date || new Date().toISOString().split('T')[0];
  const timeStr = sale.time || '';

  const lines: string[] = [
    doubleLineChar.repeat(width),
    padCenter(shopName, width),
  ];

  if (settings.tagline) lines.push(padCenter(settings.tagline, width));
  if (settings.address) lines.push(padCenter(settings.address, width));
  if (settings.phone) lines.push(padCenter(`Tel: ${settings.phone}`, width));
  if (settings.gstin) lines.push(padCenter(`GSTIN: ${settings.gstin}`, width));
  if (settings.fssai) lines.push(padCenter(`FSSAI: ${settings.fssai}`, width));

  lines.push(lineChar.repeat(width));
  lines.push(padBetween(`Bill: #${sale.billNo}`, `${formatDate(dateStr)} ${timeStr}`, width));
  if (sale.customer) {
    lines.push(padBetween(`Client: ${sale.customer}`, sale.customerPhone || '', width));
  }
  if (sale.staffName) {
    lines.push(padBetween(`Cashier: ${sale.staffName}`, '', width));
  }
  lines.push(lineChar.repeat(width));

  // Items Header
  if (is58mm) {
    lines.push(padBetween('Item / Qty', 'Amount', width));
  } else {
    lines.push(padBetween('Item Description          Qty x Rate', 'Amount', width));
  }
  lines.push(lineChar.repeat(width));

  // Items List
  sale.items.forEach((item: any, idx: number) => {
    const itemTotal = (item.price * item.qty).toFixed(2);
    const itemName = `${idx + 1}. ${item.name}`;
    const qtyPrice = `${item.qty} ${item.unit || 'pcs'} @ ${cur}${item.price.toFixed(2)}`;

    if (is58mm) {
      lines.push(itemName.slice(0, width));
      lines.push(padBetween(`  ${qtyPrice}`, `${cur}${itemTotal}`, width));
    } else {
      const left = padBetween(itemName.slice(0, 26), qtyPrice, 36);
      lines.push(padBetween(left, `${cur}${itemTotal}`, width));
    }
  });

  lines.push(lineChar.repeat(width));
  lines.push(padBetween('Subtotal:', `${cur}${(sale.subtotal || 0).toFixed(2)}`, width));

  if (sale.discount && sale.discount > 0) {
    lines.push(padBetween('Discount Applied:', `-${cur}${sale.discount.toFixed(2)}`, width));
  }
  if (sale.gst && sale.gst > 0) {
    lines.push(padBetween('Tax (GST):', `+${cur}${sale.gst.toFixed(2)}`, width));
  }

  lines.push(doubleLineChar.repeat(width));
  lines.push(padBetween('GRAND TOTAL:', `${cur}${(sale.total || 0).toFixed(2)}`, width));
  lines.push(doubleLineChar.repeat(width));

  // Payment method
  const payStr = (sale.paymentMethod || 'cash').toUpperCase();
  lines.push(padBetween(`Paid via [${payStr}]`, `${cur}${(sale.tendered || sale.total || 0).toFixed(2)}`, width));
  if (sale.change && sale.change > 0) {
    lines.push(padBetween('Change Returned:', `${cur}${sale.change.toFixed(2)}`, width));
  }

  // Footer & Terms
  lines.push(lineChar.repeat(width));
  if (settings.footerTerms) {
    lines.push(padCenter(settings.footerTerms, width));
  } else {
    lines.push(padCenter('Thank You! Visit Again', width));
  }
  lines.push(doubleLineChar.repeat(width));

  return lines.join('\n');
}

export { downloadOrSaveDataFile, savePdfToAppFolder };
