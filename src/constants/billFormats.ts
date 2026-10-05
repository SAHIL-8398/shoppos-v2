/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BillFormatKey = 'regular' | 'thermal' | 'stylish' | 'classic' | 'simple' | 'retail';

export interface BillFormatConfig {
  id: BillFormatKey;
  name: string;
  subtitle: string;
  tag: string;
  tagClass: string;
  accentHex: string;
  description: string;
  highlights: string[];
  bestFor: string;
  iconName: string;
  shortName?: string;
}

export const BILL_FORMATS: BillFormatConfig[] = [
  {
    id: 'regular',
    name: 'Regular / Standard GST',
    shortName: 'Regular GST',
    subtitle: 'Classic corporate tax invoice',
    tag: 'Vyapar Default',
    tagClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    accentHex: '#4338ca',
    description: 'Vyapar signature classic tax invoice with corporate navy accents, structured Billed-To box, full tax rate breakdown, and authorized signatory seal.',
    highlights: ['Full GST breakdown (CGST & SGST)', 'Authorized signatory seal block', 'Structured buyer/seller boxes', 'Standard A4 corporate layout'],
    bestFor: 'Wholesale, B2B, Distributors & General Retail',
    iconName: 'Building2',
  },
  {
    id: 'thermal',
    name: 'Thermal POS Slip',
    shortName: 'Thermal Roll',
    subtitle: 'Compact 2" & 3" roll receipt',
    tag: 'POS Roll',
    tagClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    accentHex: '#d97706',
    description: 'High-speed compact receipt optimized for 58mm & 80mm thermal rolls with dashed tear lines, itemized rates, instant UPI QR code, and return barcode.',
    highlights: ['58mm & 80mm roll printer support', 'Dotted tear separators & mono font', 'Dynamic UPI QR & linear barcode', 'Ultra-fast receipt spooling'],
    bestFor: 'Cafes, Bakeries, Quick Counters & Small Marts',
    iconName: 'Printer',
  },
  {
    id: 'stylish',
    name: 'Modern Stylish',
    shortName: 'Stylish Modern',
    subtitle: 'Contemporary bold accent theme',
    tag: 'Trendy / Modern',
    tagClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    accentHex: '#059669',
    description: 'Modern colorful invoice featuring an eye-catching header banner, status badge pills, alternating zebra-striped rows, and rounded financial cards.',
    highlights: ['Vibrant emerald header band', 'Zebra alternating row stripes', 'Status & payment pill badges', 'Customer savings callout'],
    bestFor: 'Boutiques, Salons, Lifestyle, Apparel & Tech Stores',
    iconName: 'Sparkles',
  },
  {
    id: 'classic',
    name: 'Classic Elegant',
    shortName: 'Classic Vintage',
    subtitle: 'Formal boxed layout with serif styling',
    tag: 'Formal Boxed',
    tagClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    accentHex: '#9f1239',
    description: 'Timeless prestige invoice with an elegant double-border frame, serif typography, dual-panel Consignor/Consignee boxes, and an official rubber-stamp box.',
    highlights: ['Double-line perimeter border', 'Classic serif typography', 'Side-by-side bordered grid', 'Rubber stamp seal box'],
    bestFor: 'Pharma, Hardware, Jewelers & Luxury Merchants',
    iconName: 'ScrollText',
  },
  {
    id: 'simple',
    name: 'Simple Minimalist',
    shortName: 'Simple Eco',
    subtitle: 'Clean black & white eco ink-saver',
    tag: 'Eco Ink-Saver',
    tagClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    accentHex: '#0f172a',
    description: 'Pure high-contrast monochrome layout with zero dark solid fills, razor-sharp hairline borders, and maximum legibility to preserve printer toner/ink.',
    highlights: ['Zero solid color fills (ink saver)', 'High-contrast black & white', 'Dot-matrix & laser optimized', 'Clean minimalist dividers'],
    bestFor: 'High-Volume Billing, Dot-Matrix & Laser Printers',
    iconName: 'FileText',
  },
  {
    id: 'retail',
    name: 'Retail Supermarket',
    shortName: 'Supermarket Retail',
    subtitle: 'Departmental store with MRP & savings',
    tag: 'MRP & Savings',
    tagClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    accentHex: '#7e22ce',
    description: 'Retail & grocery invoice with dedicated columns for MRP, Discount, Selling Rate, and an enthusiastic "Total You Saved: ₹XX" customer delight callout.',
    highlights: ['Dedicated MRP & discount columns', '"You Saved ₹XX" delight banner', 'High-density multi-item rows', 'Complete GST & return summary'],
    bestFor: 'Supermarkets, Grocery Marts, FMCG & Department Stores',
    iconName: 'ShoppingBag',
  },
];

export const getBillFormatConfig = (formatKey?: BillFormatKey): BillFormatConfig => {
  return BILL_FORMATS.find(f => f.id === formatKey) || BILL_FORMATS[0];
};
