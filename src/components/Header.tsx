/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Store,
  ShoppingCart,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  Wallet,
  Truck,
  UserCheck,
  FileSpreadsheet,
  Settings as SettingsIcon,
  BookOpen,
  Camera,
  Globe,
  LogOut,
  Building,
  Clock,
  ShieldCheck,
  Download,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  TrendingUp,
  Barcode,
  FileText,
  Search,
  ChevronDown,
  Fingerprint,
  Calendar,
} from 'lucide-react';
import { AppDatabase, Staff } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useLocalization } from '../context/LocalizationContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../context/ThemeContext';
import { sound } from '../services/soundService';

export type ActiveTab =
  | 'pos'
  | 'dashboard'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'reports'
  | 'barcodes'
  | 'documents'
  | 'expenses'
  | 'suppliers'
  | 'staff'
  | 'settings';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  db: AppDatabase;
  onOpenScanner: () => void;
  onOpenManual: () => void;
  activeStaff: Staff | null;
  onLogoutStaff: () => void;
  onSwitchBranch: (branchId: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  cartCount?: number;
  onOpenQuickSearch?: () => void;
  onOpenLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  db,
  onOpenScanner,
  onOpenManual,
  activeStaff,
  onLogoutStaff,
  onSwitchBranch,
  soundEnabled = true,
  onToggleSound,
  cartCount = 0,
  onOpenQuickSearch,
  onOpenLogin,
}) => {
  const { language, setLanguage, t } = useLocalization();
  const { isDark, toggleTheme } = useTheme();
  const [time, setTime] = useState<string>('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const cur = db.settings.currency || '₹';

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const lowStockCount = db.products.filter(
    (p) => (p.stock ?? p.qty ?? 0) <= (db.settings.lowStockDefault || 10)
  ).length;

  // Real-time Today's Sales Summary (MyBillBook style quick glance)
  const now = new Date();
  const todayDayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const day = String(now.getDate()).padStart(2, '0');
  const mon = now.toLocaleDateString('en-US', { month: 'short' });
  const year = now.getFullYear();
  const todayTaglineDate = `${day} ${mon} ${year}`;
  const todayStr = now.toISOString().split('T')[0];
  const todaySales = db.sales.filter((s) => s.date === todayStr && !s.voided);
  const todayTotal = todaySales.reduce((acc, s) => acc + s.total, 0);

  // Sorted Primary Navigation Items (Dashboard first, then Billing)
  const primaryNavItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: t('dashboard') || 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'pos', label: t('pos') || 'POS Billing', icon: <ShoppingCart size={16} />, badge: cartCount },
    { id: 'sales', label: t('sales') || 'Invoices & Sales', icon: <Receipt size={16} /> },
    { id: 'inventory', label: t('inventory') || 'Items & Stock', icon: <Package size={16} />, badge: lowStockCount },
    { id: 'customers', label: t('customers') || 'Parties & Khata', icon: <Users size={16} /> },
    { id: 'reports', label: 'GST & P&L Reports', icon: <FileSpreadsheet size={16} /> },
  ];

  // Secondary Operations & Setup Modules
  const moreNavItems: { id: ActiveTab; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'barcodes', label: 'Barcode Stickers', desc: 'Price tag sheets & roll designer', icon: <Barcode size={16} /> },
    { id: 'suppliers', label: 'Suppliers & Purchases', desc: 'Vendor khata & inward stock entry', icon: <Truck size={16} /> },
    { id: 'documents', label: 'Quotations & B2B', desc: 'Estimates, POs & Delivery Challans', icon: <FileText size={16} /> },
    { id: 'expenses', label: 'Daily Expenses', desc: 'Petty cash & operating costs', icon: <Wallet size={16} /> },
    { id: 'staff', label: 'Staff PIN & Shifts', desc: 'Cashier shift lock & logs', icon: <UserCheck size={16} /> },
    { id: 'settings', label: 'Store Settings', desc: 'Hardware, GST, UPI & Backup', icon: <SettingsIcon size={16} /> },
  ];

  const activeMoreItem = moreNavItems.find((m) => m.id === activeTab);

  return (
    <header id="app-main-header" className="bg-blue-800 dark:bg-slate-900 border-b border-blue-900/60 dark:border-slate-800 text-white select-none sticky top-0 z-40 shadow-md">
      {/* Top Banner Row */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b border-white/10 text-xs">
        {/* Store Brand & Multi-Branch */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center font-black text-base shadow-sm ring-1 ring-white/30 dark:ring-slate-700 overflow-hidden shrink-0">
              {db.settings.shopLogo || db.settings.logo ? (
                <img
                  src={db.settings.shopLogo || db.settings.logo}
                  alt={db.settings.shopName || 'Store Logo'}
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <div className="w-full h-full bg-white text-blue-800 dark:bg-indigo-600 dark:text-white flex items-center justify-center">
                  <Store size={18} className="drop-shadow-sm" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base text-white tracking-tight block leading-tight">
                  {db.settings.shopName || 'ShopPOS Pro'}
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-400 text-blue-950 dark:bg-emerald-500/20 dark:text-emerald-400">
                  MYBILLBOOK MODE
                </span>
              </div>
              <span className="text-[10px] text-blue-200 dark:text-indigo-400 font-semibold tracking-wide uppercase block">
                {db.settings.tagline || 'Modern Fast Billing & Stock'}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-amber-300 dark:text-amber-400 font-bold tracking-tight mt-0.5">
                <Calendar size={11} className="shrink-0 text-amber-300 dark:text-amber-400" />
                <span>{todayDayName}, {todayTaglineDate}</span>
              </div>
            </div>
          </div>

          {/* Branch Switcher (if multi-branch configured) */}
          {db.branches && db.branches.length > 1 && (
            <div className="hidden md:flex items-center gap-1.5 ml-2 pl-3 border-l border-white/20">
              <Building size={14} className="text-blue-200" />
              <select
                id="branch-selector"
                value={db.activeBranchId || ''}
                onChange={(e) => onSwitchBranch(e.target.value)}
                className="bg-blue-950/60 dark:bg-slate-800 border border-white/20 text-white text-xs rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-white"
              >
                {db.branches.map((b) => (
                  <option key={b.id} value={b.id} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Center / Right Info Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Global Quick Search Button (Ctrl+K) */}
          {onOpenQuickSearch && (
            <button
              id="header-quick-search-btn"
              onClick={onOpenQuickSearch}
              className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-950/40 hover:bg-blue-950/70 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-white/20 dark:border-slate-700 text-blue-100 dark:text-slate-300 rounded-xl text-xs font-medium shadow-inner transition-all w-44 lg:w-56 justify-between group cursor-pointer"
              title="Quick Search products, parties, invoices or shortcuts (Ctrl+K)"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Search size={13} className="text-blue-300 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="truncate text-[11px]">Quick search...</span>
              </div>
              <kbd className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 dark:bg-slate-700 text-blue-200 dark:text-slate-300 font-bold border border-white/10 shrink-0">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Today's Sales Snapshot Pill (MyBillBook signature fast glance) */}
          <div
            onClick={() => setActiveTab('sales')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold border border-white/15 cursor-pointer transition-colors shadow-inner"
            title="Click to view today's sales register"
          >
            <TrendingUp size={13} className="text-emerald-300" />
            <span>Today:</span>
            <span className="text-emerald-300 font-extrabold">
              {cur}{formatCurrency(todayTotal)}
            </span>
            <span className="text-[10px] text-blue-200">({todaySales.length})</span>
          </div>

          {/* PWA Install Button */}
          {!isInstalled && isInstallable && (
            <button
              id="header-pwa-install-btn"
              onClick={install}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold shadow-sm transition-all transform active:scale-95"
              title="Install ShopPOS on this device"
            >
              <Download size={13} />
              <span className="hidden xs:inline">Install App</span>
            </button>
          )}

          {/* Real-time Clock */}
          <div className="hidden xl:flex items-center gap-1 text-blue-100 dark:text-slate-400 font-mono text-[11px] bg-blue-950/40 dark:bg-slate-900/90 px-2 py-1 rounded-lg border border-white/10 dark:border-slate-800">
            <Clock size={12} className="text-blue-300 dark:text-indigo-400" />
            <span>{time}</span>
          </div>

          {/* Barcode Scanner Launch Button */}
          <button
            id="header-scanner-btn"
            onClick={() => {
              sound.vibrate(20);
              onOpenScanner();
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg text-xs font-bold transition-all active:scale-95"
            title="Scan Barcode / QR Code"
          >
            <Camera size={14} className="text-emerald-300" />
            <span className="hidden sm:inline">{t('scanBarcode')}</span>
          </button>

          {/* App Guide / User Manual */}
          <button
            id="header-manual-btn"
            onClick={onOpenManual}
            className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg text-xs font-semibold transition-colors"
            title="Complete User Manual & PDF Guide"
          >
            <BookOpen size={14} className="text-emerald-300" />
            <span>{t('guide')}</span>
          </button>

          {/* Language Selector */}
          <div className="hidden sm:flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/15 text-xs">
            <Globe size={13} className="text-blue-200" />
            <select
              id="language-selector"
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="en" className="bg-slate-900 text-white">English</option>
              <option value="hi" className="bg-slate-900 text-white">हिंदी</option>
              <option value="mr" className="bg-slate-900 text-white">मराठी</option>
              <option value="ta" className="bg-slate-900 text-white">தமிழ்</option>
            </select>
          </div>

          {/* Staff User & Logout Symbol */}
          {activeStaff ? (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/20">
              <div className="flex items-center gap-1 bg-emerald-400 text-slate-950 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                <ShieldCheck size={13} />
                <span className="max-w-[70px] sm:max-w-[90px] truncate">{activeStaff.name}</span>
                <span className="hidden xs:inline text-[9px] uppercase tracking-wider text-slate-900 font-black">
                  ({activeStaff.role})
                </span>
              </div>
              <button
                id="staff-logout-btn"
                onClick={onLogoutStaff}
                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center"
                title="Log Out / Lock Shift"
                aria-label="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/20">
              <div className="hidden xs:flex items-center gap-1.5 text-[11px] text-blue-100">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">Admin</span>
              </div>
              <button
                id="admin-logout-btn"
                onClick={onLogoutStaff}
                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center"
                title="Log Out / Lock Shift"
                aria-label="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs Row (Visible on desktop/tablet) */}
      <nav id="app-nav-tabs" className="hidden lg:flex items-center px-4 overflow-visible gap-1.5 bg-blue-900/60 dark:bg-slate-900/90 border-t border-white/10 dark:border-slate-800/40 relative">
        {primaryNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => {
                sound.vibrate(10);
                setActiveTab(item.id);
                setIsMoreMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'border-white text-white bg-white/15 dark:bg-indigo-500/10 shadow-sm'
                  : 'border-transparent text-blue-200 hover:text-white hover:bg-white/10 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-blue-200 dark:text-slate-400'}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black shadow-sm ${
                    item.id === 'pos'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* More Modules Dropdown Menu (Sorted Secondary Tools) */}
        <div className="relative">
          <button
            id="nav-more-modules-btn"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-150 cursor-pointer ${
              activeMoreItem
                ? 'border-emerald-400 text-emerald-300 bg-white/15 shadow-sm'
                : 'border-transparent text-blue-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>{activeMoreItem ? `More: ${activeMoreItem.label}` : 'More Modules'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu Popup */}
          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsMoreMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-white">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Business &amp; Operations
                </div>
                {moreNavItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        sound.vibrate(10);
                        setActiveTab(item.id);
                        setIsMoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 text-blue-800 dark:bg-slate-800 dark:text-blue-300 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate leading-tight">{item.label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}

                {/* Quick Preferences: Theme & Sound (accessible in More) */}
                <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Preferences
                  </div>
                  {/* Theme Toggle */}
                  <button
                    id="more-theme-toggle-btn"
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-blue-500" />}
                      </div>
                      <span className="font-semibold">Appearance Theme</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {isDark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </button>

                  {/* Sound Toggle */}
                  {onToggleSound && (
                    <button
                      id="more-sound-toggle-btn"
                      type="button"
                      onClick={onToggleSound}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {soundEnabled ? <Volume2 size={15} className="text-emerald-500" /> : <VolumeX size={15} className="text-slate-400" />}
                        </div>
                        <span className="font-semibold">Sound Effects</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {soundEnabled ? 'Enabled' : 'Muted'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};
