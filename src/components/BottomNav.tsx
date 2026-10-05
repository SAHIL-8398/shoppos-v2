/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ActiveTab } from './Header';
import { ShoppingCart, LayoutDashboard, Package, Receipt, Users, MoreHorizontal } from 'lucide-react';
import { sound } from '../services/soundService';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  cartCount: number;
  lowStockCount: number;
  onOpenMore: () => void;
  onOpenScanner?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  lowStockCount,
  onOpenMore,
  onOpenScanner,
}) => {
  const isMoreTab = ![
    'pos',
    'dashboard',
    'inventory',
    'sales',
    'customers',
  ].includes(activeTab);

  const handleTabClick = (tab: ActiveTab) => {
    sound.vibrate(15);
    setActiveTab(tab);
  };

  return (
    <div
      id="mobile-bottom-navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.45)] pb-[env(safe-area-inset-bottom)] transition-colors duration-150"
    >
      <div className="grid grid-cols-6 h-16 max-w-lg mx-auto items-center px-1">
        {/* Dashboard Tab (First) */}
        <button
          id="mobile-nav-dashboard"
          onClick={() => handleTabClick('dashboard')}
          className={`flex flex-col items-center justify-center h-full relative transition-all duration-150 ${
            activeTab === 'dashboard'
              ? 'text-blue-600 dark:text-indigo-400 font-extrabold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-indigo-600/20 dark:text-indigo-400 dark:ring-indigo-500/40'
                : ''
            }`}
          >
            <LayoutDashboard size={19} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">Dashboard</span>
        </button>

        {/* POS / Billing Tab (Second) */}
        <button
          id="mobile-nav-pos"
          onClick={() => handleTabClick('pos')}
          className={`flex flex-col items-center justify-center h-full relative transition-all duration-150 ${
            activeTab === 'pos'
              ? 'text-blue-600 dark:text-indigo-400 font-extrabold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'pos'
                  ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-indigo-600/20 dark:text-indigo-400 dark:ring-indigo-500/40'
                  : ''
              }`}
            >
              <ShoppingCart size={19} />
            </div>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-emerald-500 text-white dark:text-slate-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">Billing</span>
        </button>

        {/* Inventory Tab */}
        <button
          id="mobile-nav-inventory"
          onClick={() => handleTabClick('inventory')}
          className={`flex flex-col items-center justify-center h-full relative transition-all duration-150 ${
            activeTab === 'inventory'
              ? 'text-blue-600 dark:text-indigo-400 font-extrabold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'inventory'
                  ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-indigo-600/20 dark:text-indigo-400 dark:ring-indigo-500/40'
                  : ''
              }`}
            >
              <Package size={19} />
            </div>
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white dark:text-slate-950 font-bold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">Items</span>
        </button>

        {/* Sales / Bills Tab */}
        <button
          id="mobile-nav-sales"
          onClick={() => handleTabClick('sales')}
          className={`flex flex-col items-center justify-center h-full relative transition-all duration-150 ${
            activeTab === 'sales'
              ? 'text-blue-600 dark:text-indigo-400 font-extrabold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'sales'
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-indigo-600/20 dark:text-indigo-400 dark:ring-indigo-500/40'
                : ''
            }`}
          >
            <Receipt size={19} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">Invoices</span>
        </button>

        {/* Customers / Khata Tab */}
        <button
          id="mobile-nav-customers"
          onClick={() => handleTabClick('customers')}
          className={`flex flex-col items-center justify-center h-full relative transition-all duration-150 ${
            activeTab === 'customers'
              ? 'text-blue-600 dark:text-indigo-400 font-extrabold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'customers'
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-indigo-600/20 dark:text-indigo-400 dark:ring-indigo-500/40'
                : ''
            }`}
          >
            <Users size={19} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">Khata</span>
        </button>

        {/* More / Menu Drawer */}
        <button
          id="mobile-nav-more"
          onClick={() => {
            sound.vibrate(10);
            onOpenMore();
          }}
          className={`flex flex-col items-center justify-center h-full relative transition-all duration-150 ${
            isMoreTab
              ? 'text-blue-600 dark:text-indigo-400 font-extrabold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              isMoreTab
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-indigo-600/20 dark:text-indigo-400 dark:ring-indigo-500/40'
                : ''
            }`}
          >
            <MoreHorizontal size={19} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">More</span>
        </button>
      </div>
    </div>
  );
};
