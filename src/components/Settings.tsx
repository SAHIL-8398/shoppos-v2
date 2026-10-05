/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Store,
  Printer,
  Shield,
  FileText,
  Download,
  Upload,
  RefreshCw,
  Building,
  Save,
  CheckCircle,
  HelpCircle,
  QrCode,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { AppDatabase, ShopSettings, Branch } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { getLastBackupTime } from '../services/nativeStorage';

interface SettingsProps {
  db: AppDatabase;
  onSaveSettings: (settings: ShopSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onResetDatabase: () => void;
  onSaveBranch: (branch: Branch) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  db,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  onSaveBranch,
}) => {
  const { t } = useLocalization();
  const { toast, confirm, alert } = useDialog();

  const [settings, setSettings] = useState<ShopSettings>({ ...db.settings });
  const [activeSection, setActiveSection] = useState<'store' | 'tax' | 'hardware' | 'invoice' | 'backup'>('store');
  const lastBackup = settings.lastBackupTime || getLastBackupTime();

  const handleChange = (field: keyof ShopSettings, val: any) => {
    setSettings((prev: ShopSettings) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    onSaveSettings(settings);
    toast('Settings saved successfully', 'success');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportBackup(file);
    e.target.value = '';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, SVG, WebP)', 'Invalid File Type');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size should be under 2MB for fast printing and rendering.', 'File Too Large');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (base64) {
        setSettings((prev) => {
          const updated = {
            ...prev,
            shopLogo: base64,
            logo: base64,
          };
          onSaveSettings(updated);
          return updated;
        });
        toast('Shop logo updated and applied to all bills & header!', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        shopLogo: undefined,
        logo: undefined,
      };
      onSaveSettings(updated);
      return updated;
    });
    toast('Shop logo removed.', 'info');
  };

  const handleConfirmReset = async () => {
    const ok = await confirm(
      'Are you sure you want to reset all data back to default initial state? All custom records will be replaced with fresh store demo data.',
      'Reset Database'
    );
    if (ok) {
      onResetDatabase();
      toast('Database reset to defaults', 'info');
    }
  };

  return (
    <div id="settings-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-6">
      {/* Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Store Preferences &amp; Hardware</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure business legal info, GST/FSSAI compliance, thermal printer widths &amp; data backups
          </p>
        </div>

        <button
          id="save-settings-btn"
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 self-start sm:self-auto"
        >
          <Save size={16} />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Navigation Pills */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'store', label: 'Store Identity', icon: <Store size={15} /> },
          { id: 'tax', label: 'Tax & Compliance', icon: <Shield size={15} /> },
          { id: 'hardware', label: 'Printer & POS Hardware', icon: <Printer size={15} /> },
          { id: 'invoice', label: 'Invoice Layouts', icon: <FileText size={15} /> },
          { id: 'backup', label: 'Backup & Restore', icon: <Download size={15} /> },
        ].map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shadow-sm ${
              activeSection === sec.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900'
            }`}
          >
            {sec.icon}
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* Content Form Sections */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm max-w-4xl space-y-6">
        {/* Store Profile */}
        {activeSection === 'store' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Store size={16} className="text-blue-600 dark:text-indigo-400" />
              Store Profile &amp; Contact Details
            </h3>

            {/* Store Brand Logo Upload Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                    {settings.shopLogo || settings.logo ? (
                      <img
                        src={settings.shopLogo || settings.logo}
                        alt="Shop Logo Preview"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <ImageIcon size={24} className="mb-0.5" />
                        <span className="text-[9px] font-bold">No Logo</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">Shop Brand Logo</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-0.5">
                      Your logo will appear on the top-left of the application header and will be printed on all types of bills, thermal receipts, quotations, and tax invoices.
                    </p>
                    {(settings.shopLogo || settings.logo) && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                        <CheckCircle size={11} /> Logo Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all active:scale-95">
                    <Upload size={14} />
                    <span>{settings.shopLogo || settings.logo ? 'Change Logo' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {(settings.shopLogo || settings.logo) && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                      title="Remove Logo"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Store / Shop Name *</label>
                <input
                  type="text"
                  value={settings.shopName || ''}
                  onChange={(e) => handleChange('shopName', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tagline / Motto</label>
                <input
                  type="text"
                  placeholder="e.g. Quality Groceries &amp; Daily Needs"
                  value={settings.tagline || ''}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Store Physical Address</label>
                <input
                  type="text"
                  value={settings.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Support Phone / Mobile</label>
                <input
                  type="text"
                  value={settings.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Email Address</label>
                <input
                  type="text"
                  value={settings.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currency || '₹'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold text-center"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  value={settings.lowStockDefault || 10}
                  onChange={(e) => handleChange('lowStockDefault', parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <div>
                  <label htmlFor="allow-negative-stock-toggle" className="font-semibold text-xs text-slate-800 dark:text-slate-200 block cursor-pointer">
                    Allow Negative Stock
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Permit billing even if item stock reaches zero or is insufficient. Default is OFF to prevent overselling.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="allow-negative-stock-toggle"
                    checked={settings.allowNegativeStock || false}
                    onChange={(e) => handleChange('allowNegativeStock', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Loyalty Program Toggle */}
              <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <div>
                  <label htmlFor="loyalty-program-toggle" className="font-semibold text-xs text-slate-800 dark:text-slate-200 block cursor-pointer">
                    Customer Loyalty Points Program
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Earn 1 point per ₹100 spent. Customers can redeem points directly for an instant discount at checkout.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="loyalty-program-toggle"
                    checked={settings.loyaltyEnabled || false}
                    onChange={(e) => handleChange('loyaltyEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tax & Fiscal Compliance */}
        {activeSection === 'tax' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Shield size={16} className="text-blue-600 dark:text-indigo-400" />
              GST, FSSAI &amp; Fiscal Compliance
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <input
                  type="checkbox"
                  id="gst-enable-checkbox"
                  checked={settings.gstEnabled || false}
                  onChange={(e) => handleChange('gstEnabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="gst-enable-checkbox" className="font-bold text-slate-900 dark:text-white cursor-pointer">
                  Enable Goods &amp; Services Tax (GST) Invoicing
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">15-Digit GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={settings.gstin || ''}
                    onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">FSSAI Food License #</label>
                  <input
                    type="text"
                    placeholder="14-digit FSSAI License"
                    value={settings.fssai || ''}
                    onChange={(e) => handleChange('fssai', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Default GST Tax Rate (%)</label>
                  <select
                    value={settings.defaultGstPct || 0}
                    onChange={(e) => handleChange('defaultGstPct', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}% GST
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">State / Jurisdiction</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra (Code 27)"
                    value={settings.state || ''}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hardware Configuration */}
        {activeSection === 'hardware' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Printer size={16} className="text-blue-600 dark:text-indigo-400" />
              Thermal Printers &amp; POS Peripherals
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Thermal Paper Roll Size</label>
                <select
                  value={settings.printerPaperWidth || '58mm'}
                  onChange={(e) => handleChange('printerPaperWidth', e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                >
                  <option value="58mm">58mm (2-inch standard portable roll)</option>
                  <option value="80mm">80mm (3-inch wide retail desktop roll)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Thermal Font Size</label>
                <select
                  value={settings.thermalFontSize || 'normal'}
                  onChange={(e) => handleChange('thermalFontSize', e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="small">Small (Condensed, saves paper)</option>
                  <option value="normal">Normal (Standard clear)</option>
                  <option value="large">Large (High legibility)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Store UPI VPA (For Bharat QR)</label>
                <input
                  type="text"
                  placeholder="e.g. shopname@okhdfcbank"
                  value={settings.upi || ''}
                  onChange={(e) => handleChange('upi', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Generates instant QR on customer screen and printed invoice
                </span>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Bluetooth / USB Auto-Connect</label>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Auto Print on Checkout</span>
                  <input
                    type="checkbox"
                    checked={settings.autoPrintReceipt || false}
                    onChange={(e) => handleChange('autoPrintReceipt', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Layouts */}
        {activeSection === 'invoice' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <FileText size={16} className="text-blue-600 dark:text-indigo-400" />
              Invoice Customization &amp; Templates
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-2 font-semibold">Default Invoice Design Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'regular', name: 'Regular Clean' },
                    { id: 'classic', name: 'Classic Thermal' },
                    { id: 'stylish', name: 'Modern Stylish' },
                    { id: 'simple', name: 'Simple Minimal' },
                    { id: 'retail', name: 'Supermarket Retail' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleChange('invoiceTemplate', tpl.id)}
                      className={`p-3 rounded-xl border text-center font-bold transition-all ${
                        (settings.invoiceTemplate || 'regular') === tpl.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Receipt Header Custom Note</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome to our store!"
                  value={settings.receiptHeader || ''}
                  onChange={(e) => handleChange('receiptHeader', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Receipt Footer / Return Policy</label>
                <textarea
                  placeholder="e.g. Goods once sold will not be taken back without receipt. Thank you, visit again!"
                  value={settings.footerTerms || ''}
                  onChange={(e) => handleChange('footerTerms', e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Backup & Restore */}
        {activeSection === 'backup' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Download size={16} className="text-blue-600 dark:text-indigo-400" />
              Offline Database Management &amp; JSON Backup
            </h3>

            {/* Last Backup & Auto-Backup Status Banner */}
            <div className="p-4 bg-blue-50 dark:bg-slate-800/80 rounded-2xl border border-blue-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-700 dark:text-blue-400 block">
                  Daily Auto-Backup Status
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Active (daily JSON snapshot saved automatically to device storage)
                </p>
              </div>
              <div className="sm:text-right">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Last Successful Backup</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {lastBackup ? new Date(lastBackup).toLocaleString() : 'No backup created yet'}
                </span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                ShopPOS Pro runs fully offline using client-side IndexedDB. You can export your full database
                (products, sales, customers, suppliers, expenses) to an encrypted JSON backup file anytime or import
                an existing backup file.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold transition-all shadow-sm group"
                >
                  <Download size={22} className="text-blue-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span>Download Backup JSON</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Full store database</span>
                </button>

                <label className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold transition-all shadow-sm group cursor-pointer">
                  <Upload size={22} className="text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span>Restore from Backup</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Upload JSON file</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="flex flex-col items-center justify-center p-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 rounded-2xl text-rose-700 dark:text-rose-300 font-bold transition-all shadow-sm group"
                >
                  <RefreshCw size={22} className="text-rose-600 dark:text-rose-400 mb-2 group-hover:rotate-180 transition-transform duration-500" />
                  <span>Reset to Demo Data</span>
                  <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Factory default reload</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
