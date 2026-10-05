/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  Printer,
  Download,
  Settings as SettingsIcon,
  Search,
  Check,
  Plus,
  Minus,
  RefreshCw,
  Sliders,
  Grid,
  Tag,
  Store,
  Layers,
  Sparkles,
  Eye,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { AppDatabase, Product } from '../types';
import { formatCurrency, getPdfCurrency, cleanPdfText, generateStoreBarcode } from '../utils';
import { printPdfDocument, sharePdfDocument } from '../services/printService';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';

interface BarcodeDesignerProps {
  db: AppDatabase;
  initialSelectedProductId?: string;
}

type SheetLayout = 'a4_24' | 'a4_40' | 'a4_65' | 'thermal_50x25' | 'thermal_38x25';

interface LabelItemSelection {
  productId: string;
  qty: number;
}

// Single SVG Barcode Renderer
const BarcodeImage: React.FC<{ code: string; height?: number; width?: number; showText?: boolean }> = ({
  code,
  height = 28,
  width = 1.1,
  showText = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const cleanCode = (code || '00000000').trim();
    try {
      JsBarcode(svgRef.current, cleanCode, {
        format: 'CODE128',
        width,
        height,
        displayValue: showText,
        fontSize: 9,
        margin: 2,
        background: 'transparent',
      });
    } catch {
      // Fallback if code contains invalid characters for standard barcode
      try {
        JsBarcode(svgRef.current, '12345678', {
          format: 'CODE128',
          width,
          height,
          displayValue: false,
          margin: 2,
          background: 'transparent',
        });
      } catch (err) {
        console.warn('Barcode render error:', err);
      }
    }
  }, [code, height, width, showText]);

  return <svg ref={svgRef} className="max-w-full h-auto mx-auto" />;
};

// Generate high-resolution barcode lines as PNG DataURL for PDF embedding
const generateBarcodePngDataUrl = (code: string): string => {
  const canvas = document.createElement('canvas');
  const cleanCode = (code || '10001').trim();
  try {
    JsBarcode(canvas, cleanCode, {
      format: 'CODE128',
      width: 2.5,
      height: 48,
      displayValue: false,
      margin: 1,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch {
    try {
      JsBarcode(canvas, '12345678', {
        format: 'CODE128',
        width: 2.5,
        height: 48,
        displayValue: false,
        margin: 1,
        background: '#ffffff',
        lineColor: '#000000',
      });
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }
};

export const BarcodeDesigner: React.FC<BarcodeDesignerProps> = ({ db, initialSelectedProductId }) => {
  const { t } = useLocalization();
  const { toast, alert } = useDialog();

  const cur = db.settings.currency || '₹';

  // Selection list
  const [selectedItems, setSelectedItems] = useState<LabelItemSelection[]>(() => {
    if (initialSelectedProductId) {
      return [{ productId: initialSelectedProductId, qty: 24 }];
    }
    const firstProd = db.products[0];
    return firstProd ? [{ productId: firstProd.id, qty: 24 }] : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState<SheetLayout>('a4_24');

  // Label Customization Toggles
  const [showShopName, setShowShopName] = useState(true);
  const [customShopName, setCustomShopName] = useState(db.settings.shopName || 'Retail Store');
  const [showProductName, setShowProductName] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSalePrice, setShowSalePrice] = useState(true);
  const [showSaveBadge, setShowSaveBadge] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [showBatchNo, setShowBatchNo] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(cur);

  // Filtered product catalog for picker
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return db.products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [db.products, searchQuery]);

  // Toggle item selection
  const handleToggleProduct = (product: Product) => {
    const existing = selectedItems.find((i) => i.productId === product.id);
    if (existing) {
      setSelectedItems(selectedItems.filter((i) => i.productId !== product.id));
    } else {
      setSelectedItems([...selectedItems, { productId: product.id, qty: 10 }]);
    }
  };

  // Change quantity for an item
  const handleUpdateQty = (productId: string, delta: number) => {
    setSelectedItems(
      selectedItems
        .map((i) => {
          if (i.productId === productId) {
            const nextQty = Math.max(1, i.qty + delta);
            return { ...i, qty: nextQty };
          }
          return i;
        })
        .filter((i) => i.qty > 0)
    );
  };

  // Set quantity equal to current stock count
  const handleSetToStockQty = () => {
    setSelectedItems(
      selectedItems.map((item) => {
        const prod = db.products.find((p) => p.id === item.productId);
        const stock = prod?.stock ?? prod?.qty ?? 10;
        return { ...item, qty: Math.max(1, stock) };
      })
    );
    toast('Label counts matched to current stock inventory', 'info');
  };

  // Flattened array of all labels to render
  const flatLabelsToRender = useMemo(() => {
    const result: (Product & { labelId: string })[] = [];
    selectedItems.forEach((sel) => {
      const prod = db.products.find((p) => p.id === sel.productId);
      if (prod) {
        for (let i = 0; i < sel.qty; i++) {
          result.push({ ...prod, labelId: `${sel.productId}_lbl_${i}` });
        }
      }
    });
    return result;
  }, [selectedItems, db.products]);

  // Layout grid config
  const layoutConfig = useMemo(() => {
    switch (layout) {
      case 'a4_24':
        return {
          name: 'A4 Sheet (24 Labels - 3 x 8)',
          cols: 3,
          labelWidth: '70mm',
          labelHeight: '37mm',
          barcodeHeight: 24,
          barcodeWidth: 1.1,
          gridClass: 'grid-cols-3',
          paperSize: 'A4',
        };
      case 'a4_40':
        return {
          name: 'A4 Sheet (40 Labels - 4 x 10)',
          cols: 4,
          labelWidth: '48.5mm',
          labelHeight: '25.4mm',
          barcodeHeight: 18,
          barcodeWidth: 0.9,
          gridClass: 'grid-cols-4',
          paperSize: 'A4',
        };
      case 'a4_65':
        return {
          name: 'A4 Sheet (65 Labels - 5 x 13)',
          cols: 5,
          labelWidth: '38mm',
          labelHeight: '21.2mm',
          barcodeHeight: 14,
          barcodeWidth: 0.7,
          gridClass: 'grid-cols-5',
          paperSize: 'A4',
        };
      case 'thermal_50x25':
        return {
          name: 'Thermal Roll (50mm x 25mm)',
          cols: 1,
          labelWidth: '50mm',
          labelHeight: '25mm',
          barcodeHeight: 22,
          barcodeWidth: 1.0,
          gridClass: 'grid-cols-1 max-w-[50mm] mx-auto',
          paperSize: 'Roll',
        };
      case 'thermal_38x25':
        return {
          name: 'Thermal Roll (38mm x 25mm Tag)',
          cols: 1,
          labelWidth: '38mm',
          labelHeight: '25mm',
          barcodeHeight: 18,
          barcodeWidth: 0.85,
          gridClass: 'grid-cols-1 max-w-[38mm] mx-auto',
          paperSize: 'Roll',
        };
    }
  }, [layout]);

  // Generate Barcode Labels PDF Document (used for download and native printing)
  const buildBarcodeLabelsPdf = (): jsPDF | null => {
    if (flatLabelsToRender.length === 0) return null;

    const pdfCur = getPdfCurrency(currencySymbol);

    // 1. Thermal Roll Layouts
    if (layout === 'thermal_50x25' || layout === 'thermal_38x25') {
      const rollW = layout === 'thermal_38x25' ? 38 : 50;
      const rollH = 25;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [rollH, rollW],
      });

      flatLabelsToRender.forEach((prod, idx) => {
        if (idx > 0) {
          doc.addPage([rollH, rollW], 'landscape');
        }

        const pad = 2;
        const labelW = rollW - pad * 2;
        let currY = pad + 2.5;

        // Shop Name
        if (showShopName) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(rollW === 38 ? 6 : 7);
          doc.text(cleanPdfText(customShopName).slice(0, rollW === 38 ? 20 : 26), rollW / 2, currY, { align: 'center' });
          currY += 3;
        }

        // Product Name
        if (showProductName) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(rollW === 38 ? 6.5 : 7.5);
          doc.text(cleanPdfText(prod.name).slice(0, rollW === 38 ? 20 : 25), rollW / 2, currY, { align: 'center' });
          currY += 3;
        }

        // Price & MRP
        if (showSalePrice) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(rollW === 38 ? 7 : 8);
          const pStr = `Price: ${pdfCur} ${prod.price || prod.sellPrice || 0}`;
          doc.text(pStr, rollW / 2, currY, { align: 'center' });
          currY += 2.5;
        }

        // Barcode Lines (ACTUAL BARS/LINES!)
        const barcodeImg = generateBarcodePngDataUrl(prod.barcode || prod.sku || '10001');
        if (barcodeImg) {
          const bWidth = Math.min(labelW, rollW === 38 ? 32 : 42);
          const bHeight = rollW === 38 ? 7 : 8.5;
          const bX = (rollW - bWidth) / 2;
          doc.addImage(barcodeImg, 'PNG', bX, currY, bWidth, bHeight);
          currY += bHeight + 2;
        }

        // Human Readable Barcode Number
        if (showBarcodeText) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(6.5);
          doc.text(prod.barcode || prod.sku || '10001', rollW / 2, currY, { align: 'center' });
        }
      });

      return doc;
    }

    // 2. A4 Multi-Label Sheets (a4_24, a4_40, a4_65)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let cols = 3;
    let rows = 8;
    let colWidth = 63.5;
    let rowHeight = 33.9;
    let marginX = 7.5;
    let marginY = 13;
    let gapX = 2.5;
    let gapY = 0;

    if (layout === 'a4_40') {
      cols = 4;
      rows = 10;
      colWidth = 46;
      rowHeight = 25.4;
      marginX = 7;
      marginY = 18;
      gapX = 2;
      gapY = 0;
    } else if (layout === 'a4_65') {
      cols = 5;
      rows = 13;
      colWidth = 38.2;
      rowHeight = 21.2;
      marginX = 4.5;
      marginY = 10.7;
      gapX = 2.5;
      gapY = 0;
    }

    const labelsPerPage = cols * rows;

    flatLabelsToRender.forEach((prod, idx) => {
      const pageIndex = Math.floor(idx / labelsPerPage);
      const indexOnPage = idx % labelsPerPage;

      if (indexOnPage === 0 && pageIndex > 0) {
        doc.addPage('a4', 'portrait');
      }

      const col = indexOnPage % cols;
      const row = Math.floor(indexOnPage / cols);

      const x = marginX + col * (colWidth + gapX);
      const y = marginY + row * (rowHeight + gapY);

      // Draw light label boundary
      doc.setDrawColor(215, 215, 215);
      doc.rect(x, y, colWidth, rowHeight);

      let curY = y + 3.5;

      // 1. Shop Name
      if (showShopName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout === 'a4_65' ? 5.5 : layout === 'a4_40' ? 6.5 : 7);
        doc.text(cleanPdfText(customShopName).slice(0, layout === 'a4_65' ? 20 : 25), x + colWidth / 2, curY, { align: 'center' });
        curY += layout === 'a4_65' ? 2.5 : 3.2;
      }

      // 2. Product Name
      if (showProductName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout === 'a4_65' ? 6 : layout === 'a4_40' ? 7 : 7.5);
        doc.text(cleanPdfText(prod.name).slice(0, layout === 'a4_65' ? 18 : 22), x + colWidth / 2, curY, { align: 'center' });
        curY += layout === 'a4_65' ? 2.5 : 3.2;
      }

      // 3. Price & MRP Row
      if (showSalePrice || showMrp) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout === 'a4_65' ? 6 : layout === 'a4_40' ? 7 : 8);
        let priceStr = '';
        if (showSalePrice) priceStr += `Price: ${pdfCur} ${prod.price || prod.sellPrice || 0}`;
        if (showMrp && prod.mrp && prod.mrp > (prod.price || 0)) {
          priceStr += `  MRP: ${pdfCur} ${prod.mrp}`;
        }
        doc.text(priceStr, x + colWidth / 2, curY, { align: 'center' });
        curY += layout === 'a4_65' ? 2 : 2.8;
      }

      // 4. Barcode Actual Lines (IMAGE GENERATED WITH JSBARCODE!)
      const barcodeImg = generateBarcodePngDataUrl(prod.barcode || prod.sku || '10001');
      if (barcodeImg) {
        const barcodeW = colWidth - 8;
        const barcodeH = layout === 'a4_65' ? 6 : layout === 'a4_40' ? 7.5 : 10;
        const barcodeX = x + 4;
        doc.addImage(barcodeImg, 'PNG', barcodeX, curY, barcodeW, barcodeH);
        curY += barcodeH + 2;
      }

      // 5. Barcode human readable code
      if (showBarcodeText) {
        doc.setFont('courier', 'bold');
        doc.setFontSize(layout === 'a4_65' ? 5.5 : 6.5);
        doc.text(prod.barcode || prod.sku || '10001', x + colWidth / 2, curY, { align: 'center' });
      }
    });

    return doc;
  };

  // Print function with dedicated print styling (web fallback vs native capacitor-printer)
  const handlePrint = async () => {
    // Keep window.print() only for web
    if (!Capacitor.isNativePlatform()) {
      window.print();
      return;
    }

    if (flatLabelsToRender.length === 0) {
      alert('Please select at least one product to generate labels.', 'Empty Selection');
      return;
    }

    try {
      const doc = buildBarcodeLabelsPdf();
      if (!doc) return;
      const filename = `Barcode_Labels_${Date.now()}.pdf`;
      const base64 = doc.output('datauristring');
      const isThermal = layout.startsWith('thermal');
      const res = await printPdfDocument(base64, filename, {
        name: 'Barcode Labels',
        landscape: isThermal,
      });
      if (!res.success) {
        await sharePdfDocument({
          pdfBase64: base64,
          filename,
          title: 'Barcode Labels',
          subfolder: 'Barcodes',
        });
      }
    } catch (err: any) {
      console.error('Barcode print error on native:', err);
      toast('Failed to print barcode labels: ' + (err?.message || ''), 'error');
    }
  };

  // Download PDF with REAL barcode lines
  const handleDownloadPdf = () => {
    if (flatLabelsToRender.length === 0) {
      alert('Please select at least one product to generate labels.', 'Empty Selection');
      return;
    }

    try {
      const doc = buildBarcodeLabelsPdf();
      if (!doc) return;
      const isThermal = layout.startsWith('thermal');
      doc.save(`${isThermal ? 'Barcode_Roll' : 'Barcode_Labels'}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('Barcode Label PDF downloaded with actual barcode lines', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      toast('Could not generate PDF, please use browser Print', 'error');
    }
  };

  return (
    <div id="barcode-designer-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              <Barcode size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Barcode Label &amp; Price Tag Designer
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Vyapar &amp; MyBillBook Multi-Sheet &amp; Thermal Roll Sticker Printing Hub
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Download size={14} />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer size={15} />
            <span>Print Labels ({flatLabelsToRender.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Product Selection & Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Layout Template Selector */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Grid size={15} className="text-blue-600" />
              <span>Label Sheet / Paper Format:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
              {[
                { id: 'a4_24', label: 'A4 Sheet - 24 Labels (3x8)', desc: '70mm x 37mm Standard' },
                { id: 'a4_40', label: 'A4 Sheet - 40 Labels (4x10)', desc: '48.5mm x 25.4mm Compact' },
                { id: 'a4_65', label: 'A4 Sheet - 65 Labels (5x13)', desc: '38mm x 21.2mm Mini Tag' },
                { id: 'thermal_50x25', label: 'Thermal Roll 50x25mm', desc: 'Single roll barcode' },
                { id: 'thermal_38x25', label: 'Thermal Roll 38x25mm', desc: 'Jewelry & small item' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setLayout(fmt.id as SheetLayout)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    layout === fmt.id
                      ? 'bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs">{fmt.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Label Customization Options */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders size={15} className="text-blue-600" />
              <span>Visible Elements on Sticker:</span>
            </h3>

            {/* Shop Name row */}
            <div className="space-y-2 pt-1 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
                <span>Show Shop Name</span>
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
              </label>
              {showShopName && (
                <input
                  type="text"
                  value={customShopName}
                  onChange={(e) => setCustomShopName(e.target.value)}
                  placeholder="Shop / Brand Name"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                />
              )}
            </div>

            {/* Toggles list */}
            <div className="grid grid-cols-2 gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showProductName}
                  onChange={(e) => setShowProductName(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Product Title</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSalePrice}
                  onChange={(e) => setShowSalePrice(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Selling Price</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMrp}
                  onChange={(e) => setShowMrp(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Show MRP Strike</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSaveBadge}
                  onChange={(e) => setShowSaveBadge(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>"SAVE ₹XX" Tag</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBarcodeText}
                  onChange={(e) => setShowBarcodeText(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Barcode Digits</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBatchNo}
                  onChange={(e) => setShowBatchNo(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span>Batch Code</span>
              </label>
            </div>
          </div>

          {/* Product Selection List */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag size={15} className="text-blue-600" />
                <span>Select Items to Print ({selectedItems.length} selected):</span>
              </h3>
              <button
                onClick={handleSetToStockQty}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Match Stock Qty
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory items..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
              />
            </div>

            {/* Product Checkboxes / Quantities */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredProducts.map((prod) => {
                const selected = selectedItems.find((i) => i.productId === prod.id);
                return (
                  <div key={prod.id} className="py-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => handleToggleProduct(prod)}
                        className="rounded text-blue-600 w-4 h-4"
                      />
                      <div className="truncate">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{prod.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {prod.barcode || prod.sku || 'No Barcode'} • {cur}{prod.price} (Stock: {prod.stock ?? prod.qty ?? 0})
                        </div>
                      </div>
                    </label>

                    {selected && (
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                          onClick={() => handleUpdateQty(prod.id, -1)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-8 text-center font-bold text-xs">{selected.qty}</span>
                        <button
                          onClick={() => handleUpdateQty(prod.id, 1)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Sheet Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Eye size={15} className="text-blue-600" />
              <span>Realistic Sheet Preview ({flatLabelsToRender.length} Labels):</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              {layoutConfig.name}
            </span>
          </div>

          {/* Printable Sheet Container */}
          <div
            id="barcode-sheet-print-area"
            className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 shadow-inner max-h-[75vh] overflow-y-auto"
          >
            {flatLabelsToRender.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Barcode size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-xs">No products selected for barcode label generation.</p>
                <p className="text-[11px] text-slate-400">Choose one or more items from the catalog on the left.</p>
              </div>
            ) : (
              <div className={`grid gap-2.5 ${layoutConfig.gridClass}`}>
                {flatLabelsToRender.map((prod, idx) => {
                  const mrp = prod.mrp || 0;
                  const price = prod.price || prod.sellPrice || 0;
                  const savings = mrp > price ? mrp - price : 0;
                  const barcodeValue = prod.barcode || prod.sku || generateStoreBarcode(db.products, idx);

                  return (
                    <div
                      key={prod.labelId}
                      className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 rounded-lg text-center flex flex-col justify-between shadow-xs hover:border-blue-400 transition-colors select-none"
                      style={{ minHeight: layoutConfig.labelHeight }}
                    >
                      {/* Shop Name */}
                      {showShopName && (
                        <div className="text-[9px] font-black uppercase tracking-tight text-blue-800 dark:text-blue-400 truncate leading-none mb-0.5">
                          {customShopName}
                        </div>
                      )}

                      {/* Product Name */}
                      {showProductName && (
                        <div className="text-[10px] font-bold text-slate-900 dark:text-white line-clamp-1 leading-tight">
                          {prod.name}
                        </div>
                      )}

                      {/* Barcode Render */}
                      <div className="my-0.5 py-0.5 flex flex-col items-center justify-center">
                        <BarcodeImage
                          code={barcodeValue}
                          height={layoutConfig.barcodeHeight}
                          width={layoutConfig.barcodeWidth}
                          showText={false}
                        />
                        {showBarcodeText && (
                          <span className="font-mono text-[8px] tracking-widest text-slate-600 dark:text-slate-400 -mt-0.5">
                            {barcodeValue}
                          </span>
                        )}
                      </div>

                      {/* Pricing Row */}
                      <div className="flex items-center justify-center gap-1.5 text-slate-900 dark:text-white leading-none">
                        {showMrp && mrp > price && (
                          <span className="text-[9px] text-slate-400 line-through">
                            MRP {currencySymbol}{mrp}
                          </span>
                        )}
                        {showSalePrice && (
                          <span className="text-[11px] font-black text-slate-900 dark:text-white">
                            {currencySymbol}{price}
                          </span>
                        )}
                        {showSaveBadge && savings > 0 && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            SAVE {currencySymbol}{savings}
                          </span>
                        )}
                      </div>

                      {/* Batch & Expiry */}
                      {(showBatchNo || showExpiry) && (
                        <div className="text-[8px] text-slate-400 flex items-center justify-center gap-2 mt-0.5">
                          {showBatchNo && <span>B:{prod.batchNo || 'B-01'}</span>}
                          {showExpiry && <span>EXP:{prod.expiryDate || '12/26'}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global CSS for Print Output: Only prints the label sheet! */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #barcode-sheet-print-area, #barcode-sheet-print-area * {
            visibility: visible;
          }
          #barcode-sheet-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            max-height: none !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
};
