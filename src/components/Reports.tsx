/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Printer,
  DollarSign,
  PieChart,
  HelpCircle,
  FileText,
  Building,
  CheckCircle2,
  AlertCircle,
  Coins,
  Wallet,
  RefreshCw,
  Copy,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { AppDatabase, Sale, Expense, PurchaseBill, Customer } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
import { printPdfDocument, sharePdfDocument } from '../services/printService';

interface ReportsProps {
  db: AppDatabase;
}

type ReportSubTab = 'gst' | 'pnl' | 'daybook';

export const Reports: React.FC<ReportsProps> = ({ db }) => {
  const { t } = useLocalization();
  const { toast, alert } = useDialog();

  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('gst');
  const [gstType, setGstType] = useState<'gstr1' | 'gstr3b'>('gstr1');
  const [dateRange, setDateRange] = useState<'month' | 'today' | 'quarter' | 'year' | 'all'>('month');

  // Custom date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Daybook selected date
  const [daybookDate, setDaybookDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [openingCash, setOpeningCash] = useState<number>(2000);

  // Cash Denomination Calculator
  const [denominations, setDenominations] = useState<{ [denom: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });

  const cur = db.settings.currency || '₹';

  // Filtered sales based on date range
  const filteredSales = useMemo(() => {
    return (db.sales || []).filter((s) => {
      if (s.voided) return false;
      if (dateRange === 'all') return true;
      if (dateRange === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        return s.date === todayStr;
      }
      return s.date >= startDate && s.date <= endDate;
    });
  }, [db.sales, dateRange, startDate, endDate]);

  // Filtered expenses based on date range
  const filteredExpenses = useMemo(() => {
    return (db.expenses || []).filter((e) => {
      if (dateRange === 'all') return true;
      if (dateRange === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        return e.date === todayStr;
      }
      return e.date >= startDate && e.date <= endDate;
    });
  }, [db.expenses, dateRange, startDate, endDate]);

  // Filtered purchase bills based on date range
  const filteredPurchases = useMemo(() => {
    return (db.purchaseBills || []).filter((pb) => {
      if (dateRange === 'all') return true;
      if (dateRange === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        return pb.date === todayStr;
      }
      return pb.date >= startDate && pb.date <= endDate;
    });
  }, [db.purchaseBills, dateRange, startDate, endDate]);

  // --- GST GSTR-1 CALCULATIONS ---
  const gstr1Data = useMemo(() => {
    // 1. B2B Sales (Invoices with Customer GSTIN or identified as registered party)
    const b2bInvoices: Sale[] = [];
    const b2cInvoices: Sale[] = [];

    filteredSales.forEach((sale) => {
      const customer = db.customers.find((c) => c.name === sale.customer || (sale.customerPhone && c.phone === sale.customerPhone));
      if (customer?.gstin && customer.gstin.trim().length >= 15) {
        b2bInvoices.push(sale);
      } else {
        b2cInvoices.push(sale);
      }
    });

    const b2bTaxable = b2bInvoices.reduce((acc, s) => acc + (s.subtotal - (s.discount || 0)), 0);
    const b2bTax = b2bInvoices.reduce((acc, s) => acc + (s.gst || 0), 0);
    const b2bTotal = b2bInvoices.reduce((acc, s) => acc + s.total, 0);

    const b2cTaxable = b2cInvoices.reduce((acc, s) => acc + (s.subtotal - (s.discount || 0)), 0);
    const b2cTax = b2cInvoices.reduce((acc, s) => acc + (s.gst || 0), 0);
    const b2cTotal = b2cInvoices.reduce((acc, s) => acc + s.total, 0);

    // 2. HSN Summary (Table 12)
    const hsnMap = new Map<string, {
      hsn: string;
      desc: string;
      unit: string;
      qty: number;
      totalValue: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
    }>();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const prod = db.products.find((p) => p.id === item.productId || p.name === item.name);
        const hsn = prod?.hsn || item.hsn || 'General';
        const gstPct = prod?.gstPct ?? item.gstPct ?? db.settings.defaultGstPct ?? 0;
        const lineTotal = item.price * item.qty;
        // Approximate taxable value
        const lineTaxable = gstPct > 0 ? (lineTotal * 100) / (100 + gstPct) : lineTotal;
        const lineTax = lineTotal - lineTaxable;

        const isInterstate = !!sale.interStateGst;
        const igst = isInterstate ? lineTax : 0;
        const cgst = isInterstate ? 0 : lineTax / 2;
        const sgst = isInterstate ? 0 : lineTax / 2;

        const existing = hsnMap.get(hsn);
        if (existing) {
          existing.qty += item.qty;
          existing.totalValue += lineTotal;
          existing.taxableValue += lineTaxable;
          existing.igst += igst;
          existing.cgst += cgst;
          existing.sgst += sgst;
        } else {
          hsnMap.set(hsn, {
            hsn,
            desc: prod?.category || item.name,
            unit: item.unit || 'pcs',
            qty: item.qty,
            totalValue: lineTotal,
            taxableValue: lineTaxable,
            igst,
            cgst,
            sgst,
          });
        }
      });
    });

    const hsnSummary = Array.from(hsnMap.values());

    // 3. Rate-wise Tax Breakdown (0%, 5%, 12%, 18%, 28%)
    const rates = [0, 5, 12, 18, 28];
    const rateBreakdown = rates.map((rate) => {
      let taxable = 0;
      let tax = 0;

      filteredSales.forEach((sale) => {
        sale.items.forEach((item) => {
          const prod = db.products.find((p) => p.id === item.productId || p.name === item.name);
          const itemRate = prod?.gstPct ?? item.gstPct ?? db.settings.defaultGstPct ?? 0;
          if (itemRate === rate) {
            const lineTotal = item.price * item.qty;
            const lineTaxable = rate > 0 ? (lineTotal * 100) / (100 + rate) : lineTotal;
            taxable += lineTaxable;
            tax += (lineTotal - lineTaxable);
          }
        });
      });

      return { rate, taxable, tax };
    }).filter((r) => r.taxable > 0 || r.tax > 0);

    const totalIgst = hsnSummary.reduce((acc, h) => acc + h.igst, 0);
    const totalCgst = hsnSummary.reduce((acc, h) => acc + h.cgst, 0);
    const totalSgst = hsnSummary.reduce((acc, h) => acc + h.sgst, 0);
    const totalGrossSales = b2bTotal + b2cTotal;

    return {
      b2bInvoices,
      b2bTaxable,
      b2bTax,
      b2bTotal,
      b2cInvoices,
      b2cTaxable,
      b2cTax,
      b2cTotal,
      hsnSummary,
      rateBreakdown,
      totalTaxable: b2bTaxable + b2cTaxable,
      totalTax: b2bTax + b2cTax,
      totalIgst,
      totalCgst,
      totalSgst,
      totalGrossSales,
      grandTotal: b2bTotal + b2cTotal,
    };
  }, [filteredSales, db.customers, db.products, db.settings.defaultGstPct]);

  // --- GST GSTR-3B CALCULATIONS ---
  const gstr3bData = useMemo(() => {
    // 3.1 Outward supplies
    const outwardTaxable = gstr1Data.totalTaxable;
    const outwardTax = gstr1Data.totalTax;
    const outwardCgst = outwardTax / 2;
    const outwardSgst = outwardTax / 2;

    // 4. Eligible ITC (Input Tax Credit from purchase bills & operational expenses)
    const purchaseItc = filteredPurchases.reduce((acc, pb) => acc + (pb.taxAmount || 0), 0);
    // ITC from GST registered expenses (assume 18% if GST marked)
    const expenseItc = filteredExpenses
      .filter((e) => e.category === 'GST Tax' || (e.notes && e.notes.toLowerCase().includes('gst')))
      .reduce((acc, e) => acc + e.amount, 0);

    const totalItc = purchaseItc + expenseItc;
    const itcCgst = totalItc / 2;
    const itcSgst = totalItc / 2;

    // 6.1 Net Tax Payable
    const netTaxPayable = Math.max(0, outwardTax - totalItc);
    const netCgst = Math.max(0, outwardCgst - itcCgst);
    const netSgst = Math.max(0, outwardSgst - itcSgst);

    return {
      outwardTaxable,
      outwardTax,
      outwardCgst,
      outwardSgst,
      totalItc,
      itcCgst,
      itcSgst,
      netTaxPayable,
      netCgst,
      netSgst,
      purchaseCount: filteredPurchases.length,
    };
  }, [gstr1Data, filteredPurchases, filteredExpenses]);

  // --- PROFIT & LOSS CALCULATIONS ---
  const pnlData = useMemo(() => {
    let grossSales = 0;
    let totalDiscounts = 0;
    let cogs = 0; // Cost of Goods Sold

    filteredSales.forEach((sale) => {
      grossSales += sale.subtotal;
      totalDiscounts += (sale.discount || 0);

      // Calculate cost of items sold
      sale.items.forEach((item) => {
        const prod = db.products.find((p) => p.id === item.productId || p.name === item.name);
        const itemCost = item.cost ?? item.buyPrice ?? prod?.buyPrice ?? prod?.cost ?? (item.price * 0.7);
        cogs += itemCost * item.qty;
      });
    });

    const netSales = Math.max(0, grossSales - totalDiscounts);
    const grossProfit = netSales - cogs;
    const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    // Group expenses by category
    const expenseByCategory: { [cat: string]: number } = {};
    let totalExpenses = 0;

    filteredExpenses.forEach((exp) => {
      const cat = exp.category || 'General Operating';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp.amount;
      totalExpenses += exp.amount;
    });

    const netProfit = grossProfit - totalExpenses;
    const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    return {
      grossSales,
      totalDiscounts,
      netSales,
      cogs,
      grossProfit,
      grossMarginPct,
      expenseByCategory,
      totalExpenses,
      netProfit,
      netMarginPct,
    };
  }, [filteredSales, filteredExpenses, db.products]);

  // --- DAYBOOK CALCULATIONS ---
  const daybookData = useMemo(() => {
    const daySales = (db.sales || []).filter((s) => s.date === daybookDate && !s.voided);
    const dayExpenses = (db.expenses || []).filter((e) => e.date === daybookDate);

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let creditSales = 0;

    daySales.forEach((s) => {
      if (s.paymentMethod === 'cash') cashSales += s.total;
      else if (s.paymentMethod === 'upi') upiSales += s.total;
      else if (s.paymentMethod === 'card') cardSales += s.total;
      else if (s.paymentMethod === 'credit') creditSales += s.total;
      else if (s.paymentMethod === 'split' && s.splitDetails) {
        cashSales += (s.splitDetails.cashAmount || 0);
        upiSales += (s.splitDetails.upiAmount || 0);
        cardSales += (s.splitDetails.cardAmount || 0);
      }
    });

    const cashExpenses = dayExpenses
      .filter((e) => !e.paymentMode || e.paymentMode.toLowerCase() === 'cash')
      .reduce((acc, e) => acc + e.amount, 0);

    const digitalExpenses = dayExpenses
      .filter((e) => e.paymentMode && e.paymentMode.toLowerCase() !== 'cash')
      .reduce((acc, e) => acc + e.amount, 0);

    const totalCashIn = openingCash + cashSales;
    const expectedDrawerCash = totalCashIn - cashExpenses;

    // Physical count from denomination calculator
    const physicalCash = (Object.entries(denominations) as [string, number][]).reduce(
      (acc, [denom, count]) => acc + Number(denom) * (Number(count) || 0),
      0
    );

    const cashDifference = physicalCash - expectedDrawerCash;

    return {
      daySales,
      dayExpenses,
      cashSales,
      upiSales,
      cardSales,
      creditSales,
      totalSales: daySales.reduce((acc, s) => acc + s.total, 0),
      cashExpenses,
      digitalExpenses,
      totalExpenses: dayExpenses.reduce((acc, e) => acc + e.amount, 0),
      openingCash,
      expectedDrawerCash,
      physicalCash,
      cashDifference,
    };
  }, [db.sales, db.expenses, daybookDate, openingCash, denominations]);

  // Export GSTR-1 as CSV
  const handleExportGstr1Csv = () => {
    let csv = `GSTR-1 Monthly Sales Report - ${db.settings.shopName || 'Shop'}\n`;
    csv += `Period: ${startDate} to ${endDate}\n`;
    csv += `GSTIN: ${db.settings.gstin || 'UNREGISTERED'}\n`;
    csv += `Generated On: ${new Date().toLocaleString()}\n\n`;

    csv += `Section 1: B2B & B2C Invoices Itemized Details\n`;
    csv += `Invoice Number,Date,Type,Customer Name,Customer GSTIN,HSN Code,Item Description,Quantity,Tax Rate (%),Taxable Value,CGST,SGST,IGST,Total Invoice Value\n`;

    const allSortedSales = [...filteredSales].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    allSortedSales.forEach((s) => {
      const customer = db.customers.find(
        (c) =>
          (s.customerId && c.id === s.customerId) ||
          c.name === s.customer ||
          (s.customerPhone && c.phone === s.customerPhone)
      );
      const hasGstin = Boolean(customer?.gstin && customer.gstin.trim().length >= 15);
      const invoiceType = hasGstin ? 'B2B' : 'B2C';
      const custGstin = hasGstin ? customer!.gstin : 'Unregistered';
      const isInterstate = !!s.interStateGst;

      s.items.forEach((item) => {
        const prod = db.products.find((p) => p.id === item.productId || p.name === item.name);
        const hsn = prod?.hsn || item.hsn || 'General';
        const gstPct = prod?.gstPct ?? item.gstPct ?? s.gstPct ?? db.settings.defaultGstPct ?? 0;

        const lineTotal = item.price * item.qty;
        const discountRatio = s.subtotal > 0 ? (s.discount / s.subtotal) : 0;
        const lineNet = lineTotal * (1 - discountRatio);
        const taxable = gstPct > 0 ? (lineNet * 100) / (100 + gstPct) : lineNet;
        const tax = lineNet - taxable;

        const igst = isInterstate ? tax : 0;
        const cgst = isInterstate ? 0 : tax / 2;
        const sgst = isInterstate ? 0 : tax / 2;

        csv += `"${s.billNo}","${formatDate(s.date)}","${invoiceType}","${(s.customer || 'Walk-In').replace(/"/g, '""')}","${custGstin}","${hsn}","${item.name.replace(/"/g, '""')}",${item.qty},${gstPct}%,${taxable.toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},${igst.toFixed(2)},${s.total.toFixed(2)}\n`;
      });
    });

    csv += `\nSection 2: HSN Summary of Outward Supplies (Table 12)\n`;
    csv += `HSN Code,Description,UQC,Total Qty,Total Value,Taxable Value,IGST,CGST,SGST\n`;
    gstr1Data.hsnSummary.forEach((h) => {
      csv += `"${h.hsn}","${h.desc}","${h.unit}",${h.qty},${h.totalValue.toFixed(2)},${h.taxableValue.toFixed(2)},${h.igst.toFixed(2)},${h.cgst.toFixed(2)},${h.sgst.toFixed(2)}\n`;
    });

    csv += `\nSection 3: Rate-wise Tax Liability Summary\n`;
    csv += `GST Rate,Taxable Value,Tax Amount\n`;
    gstr1Data.rateBreakdown.forEach((r) => {
      csv += `${r.rate}%,${r.taxable.toFixed(2)},${r.tax.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR1_Monthly_Report_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('GSTR-1 CSV exported successfully!', 'success');
  };

  // Export GSTR-1 as JSON (GST Offline tool format)
  const handleExportGstr1Json = () => {
    const jsonPayload = {
      gstin: db.settings.gstin || 'UNREGISTERED',
      fp: `${startDate.slice(5, 7)}${startDate.slice(0, 4)}`,
      cur_gt: gstr1Data.grandTotal,
      gt: gstr1Data.grandTotal,
      b2cs: gstr1Data.b2cInvoices.map((s) => ({
        sply_ty: 'INTRA',
        rt: s.gstPct || db.settings.defaultGstPct || 0,
        txval: s.subtotal - (s.discount || 0),
        iamt: 0,
        camt: (s.gst || 0) / 2,
        samt: (s.gst || 0) / 2,
        csamt: 0,
      })),
      hsn: {
        data: gstr1Data.hsnSummary.map((h, idx) => ({
          num: idx + 1,
          hsn_sc: h.hsn,
          desc: h.desc,
          uqc: h.unit.toUpperCase(),
          qty: h.qty,
          val: h.totalValue,
          txval: h.taxableValue,
          iamt: h.igst,
          camt: h.cgst,
          samt: h.sgst,
          csamt: 0,
        })),
      },
    };

    const dataStr = JSON.stringify(jsonPayload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR1_Offline_JSON_${startDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('GSTR-1 JSON downloaded for GST Offline Tool', 'success');
  };

  // Export P&L Report as CSV
  const handleExportPnlCsv = () => {
    let csv = `Profit & Loss Statement - ${db.settings.shopName || 'Shop'}\n`;
    csv += `Period: ${startDate} to ${endDate}\n`;
    csv += `Generated On: ${new Date().toLocaleString()}\n\n`;

    csv += `PARTICULARS,AMOUNT (${cur})\n`;
    csv += `Gross Sales Revenue,${pnlData.grossSales.toFixed(2)}\n`;
    csv += `Less: Discounts Given,-${pnlData.totalDiscounts.toFixed(2)}\n`;
    csv += `NET SALES REVENUE,${pnlData.netSales.toFixed(2)}\n\n`;

    csv += `Cost of Goods Sold (COGS),${pnlData.cogs.toFixed(2)}\n`;
    csv += `GROSS PROFIT,${pnlData.grossProfit.toFixed(2)}\n`;
    csv += `Gross Profit Margin %,${pnlData.grossMarginPct.toFixed(2)}%\n\n`;

    csv += `OPERATING EXPENSES\n`;
    (Object.entries(pnlData.expenseByCategory) as [string, number][]).forEach(([cat, amt]) => {
      csv += `  ${cat},${Number(amt).toFixed(2)}\n`;
    });
    csv += `TOTAL OPERATING EXPENSES,${pnlData.totalExpenses.toFixed(2)}\n\n`;

    csv += `NET PROFIT (LOSS),${pnlData.netProfit.toFixed(2)}\n`;
    csv += `Net Profit Margin %,${pnlData.netMarginPct.toFixed(2)}%\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Profit_and_Loss_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('P&L Report CSV exported successfully!', 'success');
  };

  const handlePrintGstReport = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.print();
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const shopName = db.settings.shopName || 'ShopPOS Store';
      const isGstr1 = gstType === 'gstr1';
      const title = isGstr1 ? 'GSTR-1 Monthly Sales Report' : 'GSTR-3B Summary Tax Report';

      // Header Banner
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shopName, 15, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${title} | Period: ${startDate} to ${endDate}`, 15, 19);
      if (db.settings.gstin) {
        doc.text(`GSTIN: ${db.settings.gstin}`, 15, 24);
      }

      let y = 36;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Summary Overview', 15, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 24, 'F');
      doc.rect(15, y, 180, 24, 'S');

      doc.text(`Total Taxable Value: ${cur}${formatCurrency(gstr1Data.totalTaxable)}`, 20, y + 6);
      doc.text(`Total CGST: ${cur}${formatCurrency(gstr1Data.totalCgst)}`, 110, y + 6);
      doc.text(`Total SGST: ${cur}${formatCurrency(gstr1Data.totalSgst)}`, 20, y + 12);
      doc.text(`Total IGST: ${cur}${formatCurrency(gstr1Data.totalIgst)}`, 110, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Gross Sales (with Tax): ${cur}${formatCurrency(gstr1Data.totalGrossSales)}`, 20, y + 18);
      doc.text(`B2B / B2C Invoices: ${gstr1Data.b2bInvoices.length} / ${gstr1Data.b2cInvoices.length}`, 110, y + 18);

      y += 32;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('HSN Summary Breakdown', 15, y);
      y += 5;

      doc.setFillColor(241, 245, 249);
      doc.rect(15, y, 180, 6, 'F');
      doc.text('HSN', 18, y + 4.5);
      doc.text('Description', 45, y + 4.5);
      doc.text('Qty', 105, y + 4.5, { align: 'right' });
      doc.text('Taxable', 145, y + 4.5, { align: 'right' });
      doc.text('Tax', 190, y + 4.5, { align: 'right' });
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      gstr1Data.hsnSummary.slice(0, 25).forEach((h) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(String(h.hsn || 'N/A'), 18, y + 4);
        doc.text(String(h.desc || 'Product').slice(0, 30), 45, y + 4);
        doc.text(`${h.qty}`, 105, y + 4, { align: 'right' });
        doc.text(`${cur}${formatCurrency(h.taxableValue)}`, 145, y + 4, { align: 'right' });
        doc.text(`${cur}${formatCurrency(h.cgst + h.sgst + h.igst)}`, 190, y + 4, { align: 'right' });
        y += 5.5;
      });

      const base64 = doc.output('datauristring');
      const filename = `GST_Report_${startDate}_${endDate}.pdf`;
      const res = await printPdfDocument(base64, filename, { name: 'GST Report' });
      if (!res.success) {
        await sharePdfDocument({
          pdfBase64: base64,
          filename,
          title: 'GST Tax Report',
          subfolder: 'Reports',
        });
      }
    } catch (err: any) {
      console.error('Print GST Report error:', err);
      toast('Failed to print GST report: ' + (err?.message || ''), 'error');
    }
  };

  const handlePrintPnlReport = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.print();
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const shopName = db.settings.shopName || 'ShopPOS Store';

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shopName, 15, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Profit & Loss Statement | Period: ${startDate} to ${endDate}`, 15, 19);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 24);

      let y = 38;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Financial KPI Overview', 15, y);
      y += 8;

      const renderKpiBox = (label: string, value: string, sub: string, x: number, boxY: number, w: number) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(x, boxY, w, 20, 'F');
        doc.rect(x, boxY, w, 20, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x + 4, boxY + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(value, x + 4, boxY + 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(sub, x + 4, boxY + 17);
      };

      renderKpiBox('Net Sales Revenue', `${cur}${formatCurrency(pnlData.netSales)}`, `${filteredSales.length} sales settled`, 15, y, 42);
      renderKpiBox('Cost of Goods (COGS)', `${cur}${formatCurrency(pnlData.cogs)}`, 'Direct inventory cost', 61, y, 42);
      renderKpiBox('Gross Margin', `${cur}${formatCurrency(pnlData.grossProfit)}`, `${pnlData.grossMarginPct.toFixed(1)}% margin`, 107, y, 42);
      renderKpiBox('Net Profit', `${cur}${formatCurrency(pnlData.netProfit)}`, `${pnlData.netMarginPct.toFixed(1)}% net earnings`, 153, y, 42);

      y += 30;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Profit & Loss Breakdown', 15, y);
      y += 6;

      const pnlRows: [string, string, boolean][] = [
        ['Total Gross Revenue (Sales)', `${cur}${formatCurrency(pnlData.grossSales)}`, false],
        ['Less: Total Discounts Given', `-${cur}${formatCurrency(pnlData.totalDiscounts)}`, false],
        ['Net Sales Revenue', `${cur}${formatCurrency(pnlData.netSales)}`, true],
        ['Less: Cost of Goods Sold (Purchase Cost)', `-${cur}${formatCurrency(pnlData.cogs)}`, false],
        ['Gross Profit Margin', `${cur}${formatCurrency(pnlData.grossProfit)}`, true],
        ['Less: Operating / Petty Cash Expenses', `-${cur}${formatCurrency(pnlData.totalExpenses)}`, false],
        ['NET STORE PROFIT / (LOSS)', `${cur}${formatCurrency(pnlData.netProfit)}`, true],
      ];

      doc.setDrawColor(226, 232, 240);
      pnlRows.forEach(([lbl, val, isBold]) => {
        if (isBold) {
          doc.setFillColor(241, 245, 249);
          doc.rect(15, y, 180, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
        }
        doc.line(15, y + 7, 195, y + 7);
        doc.text(lbl, 20, y + 5);
        doc.text(val, 190, y + 5, { align: 'right' });
        y += 7.5;
      });

      const base64 = doc.output('datauristring');
      const filename = `PnL_Report_${startDate}_${endDate}.pdf`;
      const res = await printPdfDocument(base64, filename, { name: 'P&L Statement' });
      if (!res.success) {
        await sharePdfDocument({
          pdfBase64: base64,
          filename,
          title: 'P&L Statement',
          subfolder: 'Reports',
        });
      }
    } catch (err: any) {
      console.error('Print P&L Report error:', err);
      toast('Failed to print P&L report: ' + (err?.message || ''), 'error');
    }
  };

  return (
    <div id="reports-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              <FileSpreadsheet size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                GST Reports &amp; Financial Analytics
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                MyBillBook &amp; Vyapar Style CA Tax Filings, Daybook &amp; Profit Loss
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('gst')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
              activeSubTab === 'gst'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building size={15} />
            <span>GST Reports (GSTR-1/3B)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('pnl')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
              activeSubTab === 'pnl'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp size={15} />
            <span>Profit &amp; Loss</span>
          </button>
          <button
            onClick={() => setActiveSubTab('daybook')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
              activeSubTab === 'daybook'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Wallet size={15} />
            <span>Cashflow Daybook</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Toolbar (for GST & P&L) */}
      {activeSubTab !== 'daybook' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 flex items-center gap-1">
              <Calendar size={14} />
              <span>Period:</span>
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateRange('month');
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateRange('month');
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
            />
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hidden sm:inline">
              ({formatDate(startDate)} – {formatDate(endDate)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setStartDate(today);
                setEndDate(today);
                setDateRange('today');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] ${
                dateRange === 'today'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(1);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
                setDateRange('month');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] ${
                dateRange === 'month'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => {
                const d = new Date();
                // Indian FY starts April 1
                const currentYear = d.getFullYear();
                const startYear = d.getMonth() >= 3 ? currentYear : currentYear - 1;
                setStartDate(`${startYear}-04-01`);
                setEndDate(d.toISOString().split('T')[0]);
                setDateRange('year');
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] ${
                dateRange === 'year'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              FY 2026-27
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. GST REPORTS HUB (GSTR-1 & GSTR-3B) */}
      {/* ========================================================= */}
      {activeSubTab === 'gst' && (
        <div className="space-y-5">
          {/* Sub-toggle: GSTR-1 vs GSTR-3B */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <button
                onClick={() => setGstType('gstr1')}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                  gstType === 'gstr1'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                GSTR-1 (Outward Supplies &amp; HSN)
              </button>
              <button
                onClick={() => setGstType('gstr3b')}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                  gstType === 'gstr3b'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                GSTR-3B (Summary &amp; Net Tax)
              </button>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportGstr1Csv}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Download size={14} />
                <span>Export CSV / Excel</span>
              </button>
              <button
                onClick={handleExportGstr1Json}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <FileText size={14} />
                <span>GST Portal JSON</span>
              </button>
              <button
                onClick={handlePrintGstReport}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Printer size={14} />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          {/* GSTR-1 View */}
          {gstType === 'gstr1' && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Total Taxable Value
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {cur}{formatCurrency(gstr1Data.totalTaxable)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                    Across {filteredSales.length} total sales bills
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                    Total GST Collected
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                    {cur}{formatCurrency(gstr1Data.totalTax)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                    CGST: {cur}{formatCurrency(gstr1Data.totalTax / 2)} | SGST: {cur}{formatCurrency(gstr1Data.totalTax / 2)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                    B2B Registered Sales
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {cur}{formatCurrency(gstr1Data.b2bTotal)}
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                    {gstr1Data.b2bInvoices.length} Registered party invoices
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    B2C Retail Sales
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {cur}{formatCurrency(gstr1Data.b2cTotal)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                    {gstr1Data.b2cInvoices.length} Unregistered counter bills
                  </span>
                </div>
              </div>

              {/* Table 12: HSN Wise Summary */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Table 12: HSN Summary of Outward Supplies</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-extrabold">
                        {gstr1Data.hsnSummary.length} HSN Codes
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">Item-wise classification required for official GSTR-1 filing</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">HSN Code</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">UQC</th>
                        <th className="p-3 text-right">Total Qty</th>
                        <th className="p-3 text-right">Total Value</th>
                        <th className="p-3 text-right">Taxable Value</th>
                        <th className="p-3 text-right">IGST</th>
                        <th className="p-3 text-right">CGST</th>
                        <th className="p-3 text-right">SGST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {gstr1Data.hsnSummary.map((h, i) => (
                        <tr key={h.hsn || `${h.desc}_${i}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{h.hsn}</td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{h.desc}</td>
                          <td className="p-3 uppercase text-slate-500">{h.unit}</td>
                          <td className="p-3 text-right font-bold">{h.qty}</td>
                          <td className="p-3 text-right font-semibold">{cur}{formatCurrency(h.totalValue)}</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{cur}{formatCurrency(h.taxableValue)}</td>
                          <td className="p-3 text-right text-slate-500">{cur}{formatCurrency(h.igst)}</td>
                          <td className="p-3 text-right text-slate-700 dark:text-slate-300">{cur}{formatCurrency(h.cgst)}</td>
                          <td className="p-3 text-right text-slate-700 dark:text-slate-300">{cur}{formatCurrency(h.sgst)}</td>
                        </tr>
                      ))}
                      {gstr1Data.hsnSummary.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                            No sales records available in this period to compute HSN summary.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rate-Wise Tax Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Rate-wise Tax Liability Summary (0%, 5%, 12%, 18%, 28%)
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-200 dark:divide-slate-800">
                  {gstr1Data.rateBreakdown.map((r) => (
                    <div key={r.rate} className="p-4 text-center">
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {r.rate}% GST Slab
                      </span>
                      <div className="mt-2 font-black text-sm text-slate-900 dark:text-white">
                        {cur}{formatCurrency(r.taxable)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium block">Taxable</span>
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">
                        + {cur}{formatCurrency(r.tax)} Tax
                      </div>
                    </div>
                  ))}
                  {gstr1Data.rateBreakdown.length === 0 && (
                    <div className="col-span-5 p-6 text-center text-slate-400 text-xs">
                      No tax collected in this period.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GSTR-3B View */}
          {gstType === 'gstr3b' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 3.1 Outward Liability */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      3.1 Outward Tax Liability
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-700 font-bold">
                      Payable
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {cur}{formatCurrency(gstr3bData.outwardTax)}
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 font-medium">
                    <div className="flex justify-between">
                      <span>Taxable Sales:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{cur}{formatCurrency(gstr3bData.outwardTaxable)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Central Tax (CGST):</span>
                      <span className="font-bold">{cur}{formatCurrency(gstr3bData.outwardCgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>State Tax (SGST):</span>
                      <span className="font-bold">{cur}{formatCurrency(gstr3bData.outwardSgst)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Eligible ITC */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      4. Eligible Input Tax Credit (ITC)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 font-bold">
                      Credit Setoff
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {cur}{formatCurrency(gstr3bData.totalItc)}
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 font-medium">
                    <div className="flex justify-between">
                      <span>Purchases ITC ({gstr3bData.purchaseCount} bills):</span>
                      <span className="font-bold text-slate-900 dark:text-white">{cur}{formatCurrency(gstr3bData.totalItc)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ITC CGST:</span>
                      <span className="font-bold">{cur}{formatCurrency(gstr3bData.itcCgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ITC SGST:</span>
                      <span className="font-bold">{cur}{formatCurrency(gstr3bData.itcSgst)}</span>
                    </div>
                  </div>
                </div>

                {/* 6.1 Net Tax Payable */}
                <div className="bg-gradient-to-br from-blue-700 to-indigo-800 text-white p-5 rounded-xl shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-200">
                      6.1 Net Tax To Pay (Cash Ledger)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-black">
                      Final Due
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    {cur}{formatCurrency(gstr3bData.netTaxPayable)}
                  </div>
                  <p className="text-xs text-blue-100 font-medium">
                    Net liability after setting off Input Tax Credit from purchases and operating expenses.
                  </p>
                  <div className="pt-2 border-t border-white/20 text-xs flex justify-between font-bold text-blue-200">
                    <span>CGST Due: {cur}{formatCurrency(gstr3bData.netCgst)}</span>
                    <span>SGST Due: {cur}{formatCurrency(gstr3bData.netSgst)}</span>
                  </div>
                </div>
              </div>

              {/* GSTR-3B Official Summary Format */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  GSTR-3B Monthly Return Filing Computation
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Section</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Taxable Value</th>
                        <th className="p-3 text-right">Central Tax (CGST)</th>
                        <th className="p-3 text-right">State Tax (SGST)</th>
                        <th className="p-3 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="p-3 font-bold font-mono">3.1 (a)</td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">Outward taxable supplies (other than zero rated &amp; nil rated)</td>
                        <td className="p-3 text-right font-bold">{cur}{formatCurrency(gstr3bData.outwardTaxable)}</td>
                        <td className="p-3 text-right">{cur}{formatCurrency(gstr3bData.outwardCgst)}</td>
                        <td className="p-3 text-right">{cur}{formatCurrency(gstr3bData.outwardSgst)}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{cur}{formatCurrency(gstr3bData.outwardTax)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold font-mono">4 (A)(5)</td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">All other Input Tax Credit (ITC) from Inward Invoices</td>
                        <td className="p-3 text-right font-bold">-</td>
                        <td className="p-3 text-right">{cur}{formatCurrency(gstr3bData.itcCgst)}</td>
                        <td className="p-3 text-right">{cur}{formatCurrency(gstr3bData.itcSgst)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">({cur}{formatCurrency(gstr3bData.totalItc)})</td>
                      </tr>
                      <tr className="bg-slate-50/70 dark:bg-slate-800/40 font-bold">
                        <td className="p-3 font-mono">6.1</td>
                        <td className="p-3 text-slate-900 dark:text-white">Net Tax Payable in Cash / Challan</td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right text-blue-600">{cur}{formatCurrency(gstr3bData.netCgst)}</td>
                        <td className="p-3 text-right text-blue-600">{cur}{formatCurrency(gstr3bData.netSgst)}</td>
                        <td className="p-3 text-right text-blue-700 dark:text-blue-400 font-black text-sm">{cur}{formatCurrency(gstr3bData.netTaxPayable)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PROFIT & LOSS STATEMENT (P&L) */}
      {/* ========================================================= */}
      {activeSubTab === 'pnl' && (
        <div className="space-y-5">
          {/* Top Quick Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Trading &amp; Profit and Loss Statement
              </h2>
              <p className="text-xs text-slate-500">Real-time revenue, COGS, gross margin, and net earnings</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPnlCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Download size={14} />
                <span>Export P&amp;L CSV</span>
              </button>
              <button
                onClick={handlePrintPnlReport}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Printer size={14} />
                <span>Print P&amp;L</span>
              </button>
            </div>
          </div>

          {/* KPI Snapshot Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Sales */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Net Sales Revenue
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {cur}{formatCurrency(pnlData.netSales)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Gross: {cur}{formatCurrency(pnlData.grossSales)} - Disc: {cur}{formatCurrency(pnlData.totalDiscounts)}
              </span>
            </div>

            {/* COGS */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                Cost of Goods Sold (COGS)
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {cur}{formatCurrency(pnlData.cogs)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Total item procurement cost
              </span>
            </div>

            {/* Gross Profit */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                Gross Profit
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {cur}{formatCurrency(pnlData.grossProfit)}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
                {pnlData.grossMarginPct.toFixed(1)}% Gross Margin
              </span>
            </div>

            {/* Net Profit */}
            <div className={`p-4 rounded-xl border shadow-sm ${
              pnlData.netProfit >= 0
                ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900'
                : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900'
            }`}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Net Profit (Earnings)
              </span>
              <div className={`text-2xl font-black ${
                pnlData.netProfit >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-600'
              }`}>
                {cur}{formatCurrency(pnlData.netProfit)}
              </div>
              <span className="text-[11px] font-bold mt-1 block text-slate-600 dark:text-slate-400">
                {pnlData.netMarginPct.toFixed(1)}% Net Margin
              </span>
            </div>
          </div>

          {/* Detailed Statement Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Detailed Income &amp; Expense Breakdown
              </h3>
            </div>
            <div className="p-5 space-y-4 text-xs">
              {/* Revenue Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>1. Operating Income / Revenue</span>
                  <span>{cur}{formatCurrency(pnlData.netSales)}</span>
                </div>
                <div className="pl-4 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <div className="flex justify-between">
                    <span>Gross Sales Receipts:</span>
                    <span>{cur}{formatCurrency(pnlData.grossSales)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Less: Cash &amp; Line Discounts:</span>
                    <span>- {cur}{formatCurrency(pnlData.totalDiscounts)}</span>
                  </div>
                </div>
              </div>

              {/* COGS Section */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>2. Cost of Goods Sold (COGS)</span>
                  <span className="text-amber-600">- {cur}{formatCurrency(pnlData.cogs)}</span>
                </div>
                <div className="pl-4 text-slate-500 font-medium">
                  Calculated based on actual item purchase costs at time of sale
                </div>
              </div>

              {/* Gross Profit Banner */}
              <div className="flex justify-between items-center font-black text-sm bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <span>GROSS PROFIT (Income - COGS)</span>
                <span>{cur}{formatCurrency(pnlData.grossProfit)} ({pnlData.grossMarginPct.toFixed(1)}%)</span>
              </div>

              {/* Operating Expenses Section */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>3. Operating &amp; Indirect Expenses</span>
                  <span className="text-rose-600">- {cur}{formatCurrency(pnlData.totalExpenses)}</span>
                </div>
                <div className="pl-4 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  {(Object.entries(pnlData.expenseByCategory) as [string, number][]).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between">
                      <span>{cat}:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cur}{formatCurrency(Number(amt))}</span>
                    </div>
                  ))}
                  {Object.keys(pnlData.expenseByCategory).length === 0 && (
                    <div className="text-slate-400 italic">No operating expenses logged in this date range.</div>
                  )}
                </div>
              </div>

              {/* Final Net Profit Banner */}
              <div className={`flex justify-between items-center font-black text-base p-4 rounded-xl border ${
                pnlData.netProfit >= 0
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-rose-600 text-white border-rose-700'
              }`}>
                <div>
                  <div>NET BUSINESS PROFIT / (LOSS)</div>
                  <div className="text-xs font-normal text-white/80">Gross Profit minus Total Operating Expenses</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl">{cur}{formatCurrency(pnlData.netProfit)}</div>
                  <div className="text-xs text-white/90">{pnlData.netMarginPct.toFixed(1)}% Net Margin</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CASHFLOW DAYBOOK & DRAWER COUNTER */}
      {/* ========================================================= */}
      {activeSubTab === 'daybook' && (
        <div className="space-y-5">
          {/* Daybook Date Selector & Top Summary */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Select Date:</span>
              <input
                type="date"
                value={daybookDate}
                onChange={(e) => setDaybookDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
              />
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hidden xs:inline">
                ({formatDate(daybookDate)})
              </span>
              <button
                onClick={() => setDaybookDate(new Date().toISOString().split('T')[0])}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Opening Drawer Cash:</span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                  className="w-24 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-right font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Cash & Inflow/Outflow Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Inflows */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                Cash Sales Inflow
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {cur}{formatCurrency(daybookData.cashSales)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Physical currency received
              </span>
            </div>

            {/* UPI & Digital Inflows */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                UPI / Card Bank Inflow
              </span>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {cur}{formatCurrency(daybookData.upiSales + daybookData.cardSales)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Direct to bank settlement
              </span>
            </div>

            {/* Cash Outflows */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">
                Cash Expenses Outflow
              </span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {cur}{formatCurrency(daybookData.cashExpenses)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                Petty cash paid from drawer
              </span>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-4 rounded-xl shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
                Expected Cash in Drawer
              </span>
              <div className="text-2xl font-black text-white">
                {cur}{formatCurrency(daybookData.expectedDrawerCash)}
              </div>
              <span className="text-[11px] text-blue-200 font-medium mt-1 block">
                Opening ({cur}{openingCash}) + Sales - Expenses
              </span>
            </div>
          </div>

          {/* Physical Cash Denomination Counter (Vyapar & MyBillBook Cash Counter) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins size={17} className="text-amber-500" />
                  <span>Physical Currency Denomination Counter (Cash Reconciliation)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Count notes in your cash drawer at shift end to detect surplus or shortage
                </p>
              </div>
              <button
                onClick={() =>
                  setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 })
                }
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Clear Counts
              </button>
            </div>

            {/* Denomination Input Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[500, 200, 100, 50, 20, 10, 5, 2, 1].map((denom) => {
                const count = denominations[denom] || 0;
                const lineTotal = denom * count;
                return (
                  <div
                    key={denom}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                        {cur}{denom}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {cur}{formatCurrency(lineTotal)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Qty:</span>
                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setDenominations({ ...denominations, [denom]: val });
                        }}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-right font-bold text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reconciliation Comparison Bar */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-xs text-slate-500 font-semibold">Physical Counted Cash:</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {cur}{formatCurrency(daybookData.physicalCash)}
                </div>
              </div>

              <div className="space-y-1 text-center sm:text-left">
                <span className="text-xs text-slate-500 font-semibold">System Expected Cash:</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {cur}{formatCurrency(daybookData.expectedDrawerCash)}
                </div>
              </div>

              <div className={`px-4 py-2 rounded-xl text-center font-bold text-xs ${
                daybookData.cashDifference === 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : daybookData.cashDifference > 0
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
              }`}>
                <div className="text-[10px] uppercase tracking-wide">
                  {daybookData.cashDifference === 0
                    ? 'Drawer Balanced'
                    : daybookData.cashDifference > 0
                    ? 'Surplus (+)'
                    : 'Shortage (-)'}
                </div>
                <div className="text-lg font-black">
                  {daybookData.cashDifference > 0 ? '+' : ''}
                  {cur}{formatCurrency(daybookData.cashDifference)}
                </div>
              </div>

              <button
                onClick={() => {
                  toast(`Daybook register reconciled for ${formatDate(daybookDate)}. Status: ${daybookData.cashDifference === 0 ? 'Balanced' : 'Discrepancy ' + cur + daybookData.cashDifference}`, 'success');
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all whitespace-nowrap"
              >
                Save &amp; Close Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
