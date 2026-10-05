/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ActiveTab } from './Header';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Wallet,
  Truck,
  UserCheck,
  Settings as SettingsIcon,
  BookOpen,
  Camera,
  X,
  Store,
  Download,
  Volume2,
  VolumeX,
  Globe,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Barcode,
  TrendingUp,
  Search,
  Sun,
  Moon,
  LogOut,
  Fingerprint,
} from 'lucide-react';
import { AppDatabase, Staff } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { useTheme } from '../context/ThemeContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  db: AppDatabase;
  activeStaff: Staff | null;
  onOpenScanner?: () => void;
  onOpenManual: () => void;
  onOpenQuickSearch?: () => void;
  onOpenLogin?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onLogoutStaff?: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  db,
  activeStaff,
  onOpenScanner,
  onOpenManual,
  onOpenQuickSearch,
  onOpenLogin,
  soundEnabled = true,
  onToggleSound,
  onLogoutStaff,
}) => {
  const { t, language, setLanguage } = useLocalization();
  const { isDark, toggleTheme } = useTheme();
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();

  if (!isOpen) return null;

  const modules: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
  }[] = [
    {
      id: 'reports',
      label: 'GST & P&L Reports',
      icon: <TrendingUp size={20} />,
      color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20 border-indigo-100',
      desc: 'GSTR-1, GSTR-3B, Daybook & P&L calculation',
    },
    {
      id: 'barcodes',
      label: 'Barcode Label Hub',
      icon: <Barcode size={20} />,
      color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20 border-rose-100',
      desc: 'Multi-label sheets & thermal roll sticker printing',
    },
    {
      id: 'dashboard',
      label: t('dashboard') || 'Analytics Dashboard',
      icon: <LayoutDashboard size={20} />,
      color: 'text-blue-600 bg-blue-50 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20 border-blue-100',
      desc: 'Sales reports, revenue & inventory insights',
    },
    {
      id: 'documents',
      label: t('documents') || 'Quotations & B2B',
      icon: <FileSpreadsheet size={20} />,
      color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/20 border-cyan-100',
      desc: 'Quotations, Challans, POs, Estimates',
    },
    {
      id: 'expenses',
      label: t('expenses') || 'Expenses Log',
      icon: <Wallet size={20} />,
      color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 border-amber-100',
      desc: 'Daily store expenses & cash register outflows',
    },
    {
      id: 'suppliers',
      label: t('suppliers') || 'Suppliers & Vendors',
      icon: <Truck size={20} />,
      color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 border-emerald-100',
      desc: 'Wholesale suppliers and purchase logs',
    },
    {
      id: 'staff',
      label: t('staff') || 'Staff & Cashiers',
      icon: <UserCheck size={20} />,
      color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/20 border-purple-100',
      desc: 'Cashier PINs, shift attendance & permissions',
    },
    {
      id: 'settings',
      label: t('settings') || 'Settings & Backup',
      icon: <SettingsIcon size={20} />,
      color: 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700 border-slate-200',
      desc: 'GST tax, thermal printer, backups & branch',
    },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        {/* Handle Bar & Header */}
        <div className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {db.settings.shopLogo || db.settings.logo ? (
                <img
                  src={db.settings.shopLogo || db.settings.logo}
                  alt={db.settings.shopName || 'Store Logo'}
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <Store size={18} className="text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate max-w-[200px]">
                {db.settings.shopName || 'More Modules & Tools'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Settings, Reports &amp; Tools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 pb-8 text-slate-800 dark:text-slate-200">
          {/* User Session & Fast Logout / Login Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-xl text-white shadow-sm ${activeStaff ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                {activeStaff ? <ShieldCheck size={18} /> : <UserCheck size={18} />}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                  {activeStaff ? activeStaff.name : 'Administrator'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                  {activeStaff ? `Role: ${activeStaff.role}` : 'Full Terminal Access'}
                </span>
              </div>
            </div>

            {/* Only show Logout symbol */}
            {onLogoutStaff && (
              <button
                onClick={() => {
                  onClose();
                  onLogoutStaff();
                }}
                className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-sm transition-all active:scale-95 shrink-0 flex items-center justify-center"
                title="Log Out / Lock Shift"
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>

          {/* Quick Universal Search Bar */}
          {onOpenQuickSearch && (
            <button
              onClick={() => {
                onClose();
                onOpenQuickSearch();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-left transition-all shadow-inner"
            >
              <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                <Search size={16} className="text-blue-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Search items, customers, bills...
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-800">
                Find
              </span>
            </button>
          )}

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                onClose();
                onOpenScanner?.();
              }}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-indigo-950/40 dark:border-indigo-600/30 dark:hover:bg-indigo-900/30 border border-blue-200/60 text-left transition-all shadow-sm"
            >
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                <Camera size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Barcode Scan</span>
                <span className="text-[10px] text-blue-600 dark:text-indigo-300">Camera / Barcode</span>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenManual();
              }}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-600/30 dark:hover:bg-emerald-900/30 border border-emerald-200/60 text-left transition-all shadow-sm"
            >
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                <BookOpen size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">User Manual</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-300">Complete Guide</span>
              </div>
            </button>
          </div>

          {/* Install PWA Prompt Banner if installable */}
          {!isInstalled && isInstallable && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 text-white rounded-xl">
                  <Download size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Install App on Phone</h4>
                  <p className="text-[11px] text-blue-100">Full offline speed & home screen icon</p>
                </div>
              </div>
              <button
                onClick={install}
                className="px-3 py-1.5 bg-white text-blue-700 font-extrabold text-xs rounded-xl shadow transition-transform active:scale-95"
              >
                Install
              </button>
            </div>
          )}

          {/* Modules List */}
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Store Management
            </span>
            <div className="grid grid-cols-1 gap-2">
              {modules.map((m) => {
                const isActive = activeTab === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectTab(m.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                      isActive
                        ? 'bg-blue-50/80 border-blue-400 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${m.color}`}>
                        {m.icon}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900 dark:text-white block">{m.label}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{m.desc}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Preferences: Language & Sound */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              App Preferences
            </span>

            {/* Appearance Theme Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                {isDark ? <Moon size={16} className="text-amber-400" /> : <Sun size={16} className="text-amber-500" />}
                <span className="font-semibold">Appearance</span>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold transition-all shadow-sm"
              >
                {isDark ? (
                  <>
                    <Sun size={13} className="text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon size={13} className="text-blue-600" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Globe size={16} className="text-blue-600 dark:text-indigo-400" />
                <span className="font-semibold">Language / भाषा</span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>

            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">Sound Effects (Beep / Chime)</span>
              <button
                onClick={() => onToggleSound?.()}
                className={`p-2 rounded-xl border transition-all ${
                  soundEnabled
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                }`}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </div>

            {/* Active Staff info banner */}
            {activeStaff && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-600/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck size={16} />
                  <span>Logged in as: <strong className="text-emerald-950 dark:text-white">{activeStaff.name}</strong> ({activeStaff.role})</span>
                </div>
                {onLogoutStaff && (
                  <button
                    onClick={onLogoutStaff}
                    className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-sm flex items-center justify-center"
                    title="Logout"
                    aria-label="Logout"
                  >
                    <LogOut size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
