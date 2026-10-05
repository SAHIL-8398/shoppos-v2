/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, Check } from 'lucide-react';
import { sound } from '../services/soundService';

interface AdminPinSetupModalProps {
  isOpen: boolean;
  onSetAdminPin: (pin: string) => Promise<void>;
  shopName?: string;
}

export const AdminPinSetupModal: React.FC<AdminPinSetupModalProps> = ({
  isOpen,
  onSetAdminPin,
  shopName,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanPin) {
      setError('Please enter a 4-to-6 digit Admin PIN');
      sound.warningTone();
      return;
    }

    if (cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
      setError('Admin PIN must be between 4 and 6 digits (numbers only)');
      sound.warningTone();
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setError('PIN confirmation does not match');
      sound.warningTone();
      return;
    }

    try {
      setIsSubmitting(true);
      await onSetAdminPin(cleanPin);
      sound.successChime();
    } catch (err) {
      console.error('Failed to set admin pin:', err);
      setError('Failed to save security PIN. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-50 dark:bg-indigo-950/60 border border-blue-200 dark:border-indigo-800 text-blue-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Set Owner Security PIN
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Welcome to <span className="font-semibold text-slate-700 dark:text-slate-200">{shopName || 'ShopPOS Pro'}</span>. For your store security, please configure your primary Admin Security PIN before starting.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              New Admin Security PIN (4-6 digits)
            </label>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              Confirm Admin Security PIN
            </label>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {confirmPin && pin === confirmPin && (
                <Check size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 font-bold" />
              )}
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold">Important Security Notice:</p>
            <p className="text-amber-700 dark:text-amber-400">
              This PIN protects your revenue reports, staff PIN management, database backups, and store settings. Memorize it carefully.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4 || confirmPin !== pin}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all active:scale-[0.99] cursor-pointer"
          >
            {isSubmitting ? 'Securing Store...' : 'Save Admin PIN & Open Store'}
          </button>
        </form>
      </div>
    </div>
  );
};
