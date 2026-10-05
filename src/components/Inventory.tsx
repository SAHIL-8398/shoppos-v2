/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Barcode,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Sliders,
  Grid,
  List,
  ArrowUpDown,
  TrendingUp,
  Tag,
  Boxes,
  Percent,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Camera,
} from 'lucide-react';
import { AppDatabase, Product, StockAdjustment } from '../types';
import { formatCurrency, formatDate, generateStoreBarcode } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { sound } from '../services/soundService';

interface InventoryProps {
  db: AppDatabase;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onNavigateToBarcodes?: (productId?: string) => void;
  onSaveStockAdjustment?: (adj: StockAdjustment) => void;
}

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type SortOption = 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_asc' | 'price_desc' | 'margin_desc';
type ViewMode = 'table' | 'grid';

export const Inventory: React.FC<InventoryProps> = ({
  db,
  onSaveProduct,
  onDeleteProduct,
  onNavigateToBarcodes,
  onSaveStockAdjustment,
}) => {
  const { t } = useLocalization();
  const { alert, toast, confirm } = useDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Edit / Add Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Stock Adjustment / Audit Modal
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [physicalCount, setPhysicalCount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<
    'physical_audit' | 'damaged' | 'expired' | 'theft' | 'sample' | 'other'
  >('physical_audit');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [cost, setCost] = useState('');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [hsn, setHsn] = useState('');
  const [gstPct, setGstPct] = useState('0');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  const handleScanBarcode = (scannedCode: string) => {
    sound.beep();
    sound.vibrate(50);
    const cleaned = scannedCode.trim();
    setBarcode(cleaned);
    if (!sku) {
      setSku(cleaned);
    }
    setIsBarcodeScannerOpen(false);
    toast(`Barcode scanned: ${cleaned}`, 'success');
  };

  const cur = db.settings.currency || '₹';
  const lowStockThreshold = db.settings.lowStockDefault || 10;

  // Categories list with item counts
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    db.products.forEach((p) => {
      const cat = p.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [db.products]);

  const categories = useMemo(() => {
    return ['All', ...Object.keys(categoryStats).sort()];
  }, [categoryStats]);

  // High-level inventory valuation metrics
  const inventoryMetrics = useMemo(() => {
    let totalItemsCount = db.products.length;
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    db.products.forEach((p) => {
      const s = p.stock ?? p.qty ?? 0;
      const c = p.cost || p.buyPrice || 0;
      const r = p.price ?? p.sellPrice ?? 0;

      totalStockUnits += s;
      totalCostValuation += s * c;
      totalRetailValuation += s * r;

      if (s <= 0) {
        outOfStockCount++;
      } else if (s <= lowStockThreshold) {
        lowStockCount++;
      }
    });

    const potentialProfit = Math.max(0, totalRetailValuation - totalCostValuation);
    const overallMarginPct =
      totalRetailValuation > 0 ? (potentialProfit / totalRetailValuation) * 100 : 0;

    return {
      totalItemsCount,
      totalStockUnits,
      totalCostValuation,
      totalRetailValuation,
      potentialProfit,
      overallMarginPct,
      lowStockCount,
      outOfStockCount,
    };
  }, [db.products, lowStockThreshold]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return db.products
      .filter((p) => {
        const pStock = p.stock ?? p.qty ?? 0;

        // Category filter
        const matchCat =
          selectedCategory === 'All' || (p.category || 'General') === selectedCategory;

        // Stock status filter
        let matchStock = true;
        if (stockFilter === 'in_stock') matchStock = pStock > lowStockThreshold;
        else if (stockFilter === 'low_stock') matchStock = pStock > 0 && pStock <= lowStockThreshold;
        else if (stockFilter === 'out_of_stock') matchStock = pStock <= 0;

        // Search filter
        const matchQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.hsn && p.hsn.toLowerCase().includes(q));

        return matchCat && matchStock && matchQuery;
      })
      .sort((a, b) => {
        const aStock = a.stock ?? a.qty ?? 0;
        const bStock = b.stock ?? b.qty ?? 0;
        const aPrice = a.price ?? a.sellPrice ?? 0;
        const bPrice = b.price ?? b.sellPrice ?? 0;
        const aCost = a.cost || a.buyPrice || 0;
        const bCost = b.cost || b.buyPrice || 0;
        const aMargin = aPrice > 0 ? ((aPrice - aCost) / aPrice) * 100 : 0;
        const bMargin = bPrice > 0 ? ((bPrice - bCost) / bPrice) * 100 : 0;

        switch (sortBy) {
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'stock_asc':
            return aStock - bStock;
          case 'stock_desc':
            return bStock - aStock;
          case 'price_asc':
            return aPrice - bPrice;
          case 'price_desc':
            return bPrice - aPrice;
          case 'margin_desc':
            return bMargin - aMargin;
          default:
            return 0;
        }
      });
  }, [db.products, selectedCategory, stockFilter, searchQuery, sortBy, lowStockThreshold]);

  // Open modal for Add
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setCategory('General');
    setBarcode(generateStoreBarcode(db.products));
    setSku(`SKU-${Date.now().toString().slice(-4)}`);
    setCost('');
    setMrp('');
    setPrice('');
    setStock('0');
    setUnit('pcs');
    setHsn('');
    setGstPct(db.settings.defaultGstPct?.toString() || '0');
    setBatchNo('');
    setExpiryDate('');
    setShelfLocation('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category || 'General');
    setBarcode(product.barcode || '');
    setSku(product.sku || '');
    setCost(product.cost?.toString() || product.buyPrice?.toString() || '');
    setMrp(product.mrp?.toString() || '');
    setPrice((product.price ?? product.sellPrice ?? 0).toString());
    setStock((product.stock ?? product.qty ?? 0).toString());
    setUnit(product.unit || 'pcs');
    setHsn(product.hsn || '');
    setGstPct(product.gstPct?.toString() || '0');
    setBatchNo(product.batchNo || '');
    setExpiryDate(product.expiryDate || '');
    setShelfLocation(product.shelfLocation || '');
    setIsModalOpen(true);
  };

  // Save product from form
  const handleSave = () => {
    if (!name.trim()) {
      alert('Product name is required.', 'Missing Field');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Please enter a valid selling price.', 'Invalid Price');
      return;
    }

    const costNum = cost ? parseFloat(cost) : 0;
    const mrpNum = mrp ? parseFloat(mrp) : undefined;
    const stockNum = stock ? parseFloat(stock) : 0;
    const gstNum = gstPct ? parseFloat(gstPct) : 0;

    const updatedProduct: Product = {
      id: editingProduct ? editingProduct.id : `prod_${Date.now()}`,
      name: name.trim(),
      category: category.trim() || 'General',
      barcode: barcode.trim() || generateStoreBarcode(db.products),
      sku: sku.trim() || undefined,
      cost: costNum,
      buyPrice: costNum,
      mrp: mrpNum,
      price: priceNum,
      sellPrice: priceNum,
      stock: stockNum,
      qty: stockNum,
      unit: unit || 'pcs',
      hsn: hsn.trim() || undefined,
      gstPct: gstNum,
      batchNo: batchNo.trim() || undefined,
      expiryDate: expiryDate || undefined,
      shelfLocation: shelfLocation.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSaveProduct(updatedProduct);
    setIsModalOpen(false);
    toast(
      editingProduct
        ? `Updated item "${updatedProduct.name}"`
        : `Added new item "${updatedProduct.name}"`,
      'success'
    );
  };

  // Delete product
  const handleDelete = async (product: Product) => {
    const isConfirmed = await confirm(
      `Are you sure you want to permanently delete "${product.name}"? This cannot be undone.`,
      'Delete Product'
    );
    if (isConfirmed) {
      onDeleteProduct(product.id);
      toast(`Deleted "${product.name}"`, 'info');
    }
  };

  // Quick Inline Stock Adjustment (+1 / -1)
  const handleQuickAdjustStock = (product: Product, delta: number) => {
    const current = product.stock ?? product.qty ?? 0;
    const next = Math.max(0, current + delta);
    onSaveProduct({
      ...product,
      stock: next,
      qty: next,
      updatedAt: new Date().toISOString(),
    });
    toast(
      `${product.name}: ${next} ${product.unit || 'pcs'} (${delta >= 0 ? '+' : ''}${delta})`,
      'info'
    );
  };

  // Open stock adjustment / physical count modal
  const handleOpenAdjustment = (product?: Product) => {
    const prod = product || filteredProducts[0] || db.products[0];
    if (!prod) {
      alert('No product selected to adjust stock.', 'Catalog Empty');
      return;
    }
    setAdjustingProduct(prod);
    setPhysicalCount((prod.stock ?? prod.qty ?? 0).toString());
    setAdjustmentReason('physical_audit');
    setAdjustmentNotes('');
    setIsAdjustmentOpen(true);
  };

  // Submit stock adjustment
  const handleSaveAdjustment = () => {
    if (!adjustingProduct) return;
    const newStockNum = parseFloat(physicalCount);
    if (isNaN(newStockNum) || newStockNum < 0) {
      alert('Please enter a valid stock count (0 or higher).', 'Invalid Count');
      return;
    }

    const currentStock = adjustingProduct.stock ?? adjustingProduct.qty ?? 0;
    const diff = newStockNum - currentStock;

    // Update product stock
    onSaveProduct({
      ...adjustingProduct,
      stock: newStockNum,
      qty: newStockNum,
      updatedAt: new Date().toISOString(),
    });

    const adjustmentRecord: StockAdjustment = {
      id: `adj_${Date.now()}`,
      productId: adjustingProduct.id,
      productName: adjustingProduct.name,
      oldStock: currentStock,
      newStock: newStockNum,
      adjustmentQty: diff,
      reason: adjustmentReason,
      notes: adjustmentNotes.trim() || undefined,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      staffName: 'Admin',
    };

    if (onSaveStockAdjustment) {
      onSaveStockAdjustment(adjustmentRecord);
    } else if (db.stockAdjustments) {
      db.stockAdjustments.unshift(adjustmentRecord);
    }

    setIsAdjustmentOpen(false);
    toast(
      `Stock adjusted for ${adjustingProduct.name}: ${currentStock} -> ${newStockNum} (${diff >= 0 ? '+' : ''}${diff})`,
      'success'
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Name',
      'Category',
      'Barcode',
      'SKU',
      'Cost',
      'MRP',
      'SellingPrice',
      'Stock',
      'Unit',
      'HSN',
      'GST_Percent',
      'BatchNo',
      'ShelfLocation',
    ];

    const rows = db.products.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.category || 'General').replace(/"/g, '""')}"`,
      `"${p.barcode || ''}"`,
      `"${p.sku || ''}"`,
      p.cost || p.buyPrice || 0,
      p.mrp || 0,
      p.price ?? p.sellPrice ?? 0,
      p.stock ?? p.qty ?? 0,
      p.unit || 'pcs',
      p.hsn || '',
      p.gstPct || 0,
      `"${p.batchNo || ''}"`,
      `"${p.shelfLocation || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `ShopPOS_Inventory_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Products exported to CSV', 'success');
  };

  // Calculate live margin for modal
  const formCostNum = parseFloat(cost) || 0;
  const formPriceNum = parseFloat(price) || 0;
  const formMarginAmt = formPriceNum - formCostNum;
  const formMarginPct = formPriceNum > 0 ? (formMarginAmt / formPriceNum) * 100 : 0;

  return (
    <div
      id="inventory-screen"
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6"
    >
      {/* 1. Executive Intelligence Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
              <Boxes size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Item &amp; Stock Master
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>{db.products.length} registered products</span>
                <span aria-hidden="true">·</span>
                <span>{inventoryMetrics.totalStockUnits} total inventory units</span>
                <span aria-hidden="true">·</span>
                <span>{categories.length - 1} categories</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {onNavigateToBarcodes && (
            <button
              onClick={() => onNavigateToBarcodes()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Print custom barcode stickers and price tags"
            >
              <Barcode size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span>Barcode Labels</span>
            </button>
          )}

          <button
            onClick={() => handleOpenAdjustment()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Perform physical stock audit and reconcile variances"
          >
            <Sliders size={15} className="text-amber-600 dark:text-amber-400" />
            <span>Stock Audit</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Download full catalog as spreadsheet"
          >
            <Download size={15} className="text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* 2. Key Valuation & Inventory Health Cards (Clean single elevation) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Cost Valuation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Inventory Cost Value</span>
            <Tag size={15} className="text-blue-500" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
              {cur}{formatCurrency(inventoryMetrics.totalCostValuation)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Wholesale capital invested
            </div>
          </div>
        </div>

        {/* Total Retail Valuation & Potential Margin */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Retail Valuation</span>
            <TrendingUp size={15} className="text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {cur}{formatCurrency(inventoryMetrics.totalRetailValuation)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Profit potential: <strong className="text-emerald-600 dark:text-emerald-400">+{cur}{formatCurrency(inventoryMetrics.potentialProfit)}</strong> ({inventoryMetrics.overallMarginPct.toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* Low Stock Alerts (Clickable Filter) */}
        <button
          onClick={() => setStockFilter(stockFilter === 'low_stock' ? 'all' : 'low_stock')}
          className={`border rounded-2xl p-4 text-left transition-all shadow-sm flex flex-col justify-between ${
            stockFilter === 'low_stock'
              ? 'bg-amber-50/80 border-amber-400 dark:bg-amber-950/30 dark:border-amber-500/50 ring-2 ring-amber-400/20'
              : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70 border-slate-200/80 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Low Stock Items</span>
            <AlertTriangle
              size={15}
              className={inventoryMetrics.lowStockCount > 0 ? 'text-amber-500' : 'text-slate-400'}
            />
          </div>
          <div className="mt-2">
            <div
              className={`text-lg sm:text-2xl font-black ${
                inventoryMetrics.lowStockCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {inventoryMetrics.lowStockCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Items at or below {lowStockThreshold} units · {stockFilter === 'low_stock' ? 'Active filter' : 'Click to filter'}
            </div>
          </div>
        </button>

        {/* Out of Stock Alerts (Clickable Filter) */}
        <button
          onClick={() => setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
          className={`border rounded-2xl p-4 text-left transition-all shadow-sm flex flex-col justify-between ${
            stockFilter === 'out_of_stock'
              ? 'bg-rose-50/80 border-rose-400 dark:bg-rose-950/30 dark:border-rose-500/50 ring-2 ring-rose-400/20'
              : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70 border-slate-200/80 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Out of Stock</span>
            <X
              size={15}
              className={inventoryMetrics.outOfStockCount > 0 ? 'text-rose-500' : 'text-slate-400'}
            />
          </div>
          <div className="mt-2">
            <div
              className={`text-lg sm:text-2xl font-black ${
                inventoryMetrics.outOfStockCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {inventoryMetrics.outOfStockCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Immediate restocking needed · {stockFilter === 'out_of_stock' ? 'Active filter' : 'Click to filter'}
            </div>
          </div>
        </button>
      </div>

      {/* 3. Category Horizontal Segmented Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const count = cat === 'All' ? db.products.length : categoryStats[cat] || 0;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] font-semibold opacity-70 ${
                  isActive ? 'text-slate-200 dark:text-slate-800' : ''
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Search, Stock Filter, Sort & View Mode Switcher Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input with clear button */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="inventory-search-input"
            type="text"
            placeholder="Search items by name, barcode, SKU or HSN code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Stock Filter segmented control */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockFilter === 'all'
                  ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockFilter === 'in_stock'
                  ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                stockFilter === 'low_stock'
                  ? 'bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Low ({inventoryMetrics.lowStockCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
            <ArrowUpDown size={13} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
              <option value="stock_asc">Stock: Low to High</option>
              <option value="stock_desc">Stock: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="margin_desc">Highest Margin %</option>
            </select>
          </div>

          {/* View Mode Toggle (Table / Grid) */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table List View"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Visual Cards View"
            >
              <Grid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Catalog Content: Table View OR Grid Cards View */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Package size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No products match your criteria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No items found matching "${searchQuery}". Try clearing search or selecting a different category.`
              : 'Your inventory catalog is currently empty. Add your first item to get started.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            {searchQuery || selectedCategory !== 'All' || stockFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setStockFilter('all');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Reset Filters
              </button>
            ) : (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
              >
                + Add First Product
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE LIST VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-extrabold">Item &amp; Identifiers</th>
                  <th className="py-3.5 px-3 font-extrabold">Category</th>
                  <th className="py-3.5 px-3 font-extrabold">Cost / Buy</th>
                  <th className="py-3.5 px-3 font-extrabold">MRP</th>
                  <th className="py-3.5 px-3 font-extrabold">Selling Price</th>
                  <th className="py-3.5 px-3 font-extrabold">Margin</th>
                  <th className="py-3.5 px-4 font-extrabold">Stock Health</th>
                  <th className="py-3.5 px-3 font-extrabold">Tax / HSN</th>
                  <th className="py-3.5 px-4 text-right font-extrabold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredProducts.map((p) => {
                  const pStock = p.stock ?? p.qty ?? 0;
                  const pPrice = p.price ?? p.sellPrice ?? 0;
                  const pCost = p.cost || p.buyPrice || 0;
                  const pMrp = p.mrp || 0;
                  const marginAmt = pPrice - pCost;
                  const marginPct = pPrice > 0 ? (marginAmt / pPrice) * 100 : 0;
                  const isLow = pStock > 0 && pStock <= lowStockThreshold;
                  const isOut = pStock <= 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Item Details */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-[180px]">
                          <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                            {p.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                            {p.barcode && <span>{p.barcode}</span>}
                            {p.barcode && p.sku && <span aria-hidden="true">·</span>}
                            {p.sku && <span>{p.sku}</span>}
                            {p.shelfLocation && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-blue-500 font-sans font-medium">
                                  Rack {p.shelfLocation}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                        {p.category || 'General'}
                      </td>

                      {/* Buy / Cost Rate */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono">
                        {cur}{formatCurrency(pCost)}
                      </td>

                      {/* MRP */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-400 font-mono">
                        {pMrp > 0 ? `${cur}${formatCurrency(pMrp)}` : '-'}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-3 whitespace-nowrap font-black text-slate-900 dark:text-white text-sm font-mono">
                        {cur}{formatCurrency(pPrice)}
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-bold text-xs ${
                            marginPct >= 25
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : marginPct > 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-400'
                          }`}
                        >
                          +{marginPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Stock Level with Step Controls */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isOut
                                    ? 'bg-rose-500 animate-pulse'
                                    : isLow
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                              />
                              <span
                                className={`font-black text-xs ${
                                  isOut
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : isLow
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {pStock} {p.unit || 'pcs'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {isOut ? 'Out of stock' : isLow ? 'Low stock alert' : 'In stock'}
                            </span>
                          </div>

                          {/* Fast Step Adjustment */}
                          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-inner">
                            <button
                              onClick={() => handleQuickAdjustStock(p, -1)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold transition-colors"
                              title="Decrease 1 unit"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleQuickAdjustStock(p, 1)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold transition-colors"
                              title="Increase 1 unit"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Tax & HSN */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        <div>{p.gstPct || 0}% GST</div>
                        {p.hsn && <div className="text-[10px] text-slate-400">HSN: {p.hsn}</div>}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {onNavigateToBarcodes && (
                            <button
                              onClick={() => onNavigateToBarcodes(p.id)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                              title="Print Barcode Tag"
                            >
                              <Barcode size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAdjustment(p)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                            title="Audit / Reconcile Stock"
                          >
                            <Sliders size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-white rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Item"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID / CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const pStock = p.stock ?? p.qty ?? 0;
            const pPrice = p.price ?? p.sellPrice ?? 0;
            const pCost = p.cost || p.buyPrice || 0;
            const pMrp = p.mrp || 0;
            const marginAmt = pPrice - pCost;
            const marginPct = pPrice > 0 ? (marginAmt / pPrice) * 100 : 0;
            const isLow = pStock > 0 && pStock <= lowStockThreshold;
            const isOut = pStock <= 0;

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar with Category & Margin */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {p.category || 'General'}
                    </span>
                    <span
                      className={`font-black text-xs ${
                        marginPct >= 25
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      +{marginPct.toFixed(0)}% Margin
                    </span>
                  </div>

                  {/* Title & Identifiers */}
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-2">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-1">
                    {p.barcode && <span>Bar: {p.barcode}</span>}
                    {p.sku && <span>· SKU: {p.sku}</span>}
                  </div>

                  {/* Pricing Overview */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Selling Price</span>
                      <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {cur}{formatCurrency(pPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Buy / MRP</span>
                      <div className="text-xs text-slate-500 font-mono">
                        {cur}{formatCurrency(pCost)} {pMrp > 0 ? `/ ${cur}${formatCurrency(pMrp)}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Stock Level & Progress Meter */}
                  <div className="mt-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">Stock in store</span>
                      <span
                        className={`font-black ${
                          isOut
                            ? 'text-rose-600'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {pStock} {p.unit || 'pcs'}
                      </span>
                    </div>
                    {/* Visual Meter */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(8, (pStock / 50) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Controls Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                    <button
                      onClick={() => handleQuickAdjustStock(p, -1)}
                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleQuickAdjustStock(p, 1)}
                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {onNavigateToBarcodes && (
                      <button
                        onClick={() => onNavigateToBarcodes(p.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                        title="Print Barcode Tag"
                      >
                        <Barcode size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenAdjustment(p)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                      title="Stock Audit"
                    >
                      <Sliders size={15} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Item"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                      title="Delete Item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ADD / EDIT PRODUCT MODAL (Organized 2-Column Responsive Layout) */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {editingProduct ? 'Edit Product Details' : 'Add New Item to Catalog'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set up barcode, buying &amp; selling prices, stock levels and tax rates
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Section 1: Item Identification */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  1. Item Identification
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Royal Basmati Rice 5kg"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Groceries"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs">
                        Barcode / EAN-13
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsBarcodeScannerOpen(true)}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                        title="Scan barcode from product using camera"
                      >
                        <Camera size={12} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Camera Scanner</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Scan or type barcode"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3 pr-9 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setIsBarcodeScannerOpen(true)}
                          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Scan product barcode with camera"
                        >
                          <Camera size={15} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBarcodeScannerOpen(true)}
                        className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Open camera barcode reader to scan product barcode"
                      >
                        <Camera size={14} />
                        <span>Scan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newCode = generateStoreBarcode(db.products);
                          setBarcode(newCode);
                          toast(`Generated custom in-store barcode: ${newCode}`, 'info');
                        }}
                        className="px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-blue-600 dark:text-indigo-400 font-bold text-xs transition-colors cursor-pointer"
                        title="Auto-generate a 13-digit barcode starting with 45 to prevent conflict with commercial items"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      SKU Code (Stock Keeping Unit)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-RICE-5K"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Pricing & Profit Margin Preview */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-indigo-400">
                    2. Pricing &amp; Profit Valuation
                  </span>
                  {formPriceNum > 0 && (
                    <span
                      className={`text-xs font-black ${
                        formMarginPct >= 20 ? 'text-emerald-600' : 'text-blue-600'
                      }`}
                    >
                      Profit Margin: {cur}{formatCurrency(formMarginAmt)} ({formMarginPct.toFixed(1)}%)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                      Buy / Cost Rate ({cur})
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Purchase cost</span>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                      MRP ({cur})
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Max printed price</span>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-emerald-700 dark:text-emerald-400 mb-1 font-bold">
                      Selling Price * ({cur})
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-black text-sm"
                    />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      POS counter checkout price
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Inventory Units & Stock Tracking */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  3. Stock &amp; Location
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Current Stock Quantity
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Unit of Measure
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                    >
                      {['pcs', 'kg', 'gm', 'ltr', 'ml', 'box', 'pack', 'meter', 'can', 'bottle'].map(
                        (u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Shelf / Rack Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. A3-Shelf"
                      value={shelfLocation}
                      onChange={(e) => setShelfLocation(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: GST & Statutory Details */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  4. GST Tax &amp; Batch Information
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      HSN / SAC Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1006"
                      value={hsn}
                      onChange={(e) => setHsn(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      GST Tax Slab
                    </label>
                    <select
                      value={gstPct}
                      onChange={(e) => setGstPct(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                    >
                      {['0', '5', '12', '18', '28'].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}% GST
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. B-104"
                      value={batchNo}
                      onChange={(e) => setBatchNo(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex justify-end items-center gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PHYSICAL STOCK AUDIT & RECONCILIATION MODAL */}
      {/* ========================================================================= */}
      {isAdjustmentOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                  <Sliders size={18} />
                </span>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Stock Audit &amp; Physical Count
                  </h4>
                  <p className="text-xs text-slate-500">
                    Item: <strong>{adjustingProduct.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAdjustmentOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current vs New Count Comparison */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Current System Stock
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {adjustingProduct.stock ?? adjustingProduct.qty ?? 0}{' '}
                  {adjustingProduct.unit || 'pcs'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Variance Difference
                </span>
                {(() => {
                  const curr = adjustingProduct.stock ?? adjustingProduct.qty ?? 0;
                  const next = parseFloat(physicalCount) || 0;
                  const diff = next - curr;
                  return (
                    <span
                      className={`text-xl font-black ${
                        diff === 0
                          ? 'text-slate-500'
                          : diff > 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff} {adjustingProduct.unit || 'pcs'}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Physical Count Input */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Actual Physical Counted Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  placeholder="Enter physical count"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-2xl font-black text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  autoFocus
                />
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Reason for Adjustment:
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="physical_audit">Physical Count Discrepancy (Stock Audit)</option>
                  <option value="damaged">Damaged / Broken Goods in Store</option>
                  <option value="expired">Expired Goods Written Off</option>
                  <option value="theft">Theft / Unaccounted Shrinkage</option>
                  <option value="sample">Free Promotional Sample / Gift</option>
                  <option value="other">Other / Miscellaneous Correction</option>
                </select>
              </div>

              {/* Remarks / Notes */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Audit Notes / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Month-end inventory verification count"
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdjustmentOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdjustment}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Save Stock Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner for adding/editing product */}
      {isBarcodeScannerOpen && (
        <BarcodeScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
          onScan={handleScanBarcode}
        />
      )}
    </div>
  );
};
