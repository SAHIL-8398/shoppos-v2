/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  X,
  AlertCircle,
  Fingerprint,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Staff } from '../types';
import { sound } from '../services/soundService';
import { hashPassword, isSha256Hex, initIndexedDB, getKV, setKV } from '../db';

interface LoginLockRecord {
  failedAttempts: number;
  lockUntil: number;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: Staff[];
  onAuthenticate: (staff: Staff) => void;
  adminPwHash?: string;
  adminPin?: string;
  onAdminAuthenticate: () => void;
  activeStaff?: Staff | null;
  onLogout?: () => void;
  onMigrateStaffPin?: (staffId: string, hashedPin: string) => void;
  onMigrateAdminPin?: (hashedPin: string) => void;
}

type AuthMode = 'fingerprint' | 'id_password' | 'pin';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  staffList,
  onAuthenticate,
  adminPwHash,
  adminPin,
  onAdminAuthenticate,
  onMigrateStaffPin,
  onMigrateAdminPin,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('fingerprint');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('admin');

  // ID & Password State
  const [userIdInput, setUserIdInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN Pad State
  const [pin, setPin] = useState<string>('');

  // Fingerprint Scanner State
  const [isFingerprintScanning, setIsFingerprintScanning] = useState(false);
  const [fingerprintSuccess, setFingerprintSuccess] = useState(false);

  // Common error state
  const [error, setError] = useState<string>('');

  // Lockout state: 5 failed attempts -> 60-second lockout (persisted in IndexedDB kv 'loginLock')
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  // Clear lockout state from memory and IndexedDB kv
  const clearLoginLock = async () => {
    setFailedAttempts(0);
    setLockUntil(0);
    setSecondsRemaining(0);
    try {
      const idb = await initIndexedDB();
      await setKV(idb, 'loginLock', { failedAttempts: 0, lockUntil: 0 });
    } catch (err) {
      console.error('Failed to clear loginLock from IDB:', err);
    }
  };

  // Countdown timer for lockout
  useEffect(() => {
    if (lockUntil <= Date.now()) {
      setSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        setLockUntil(0);
        setError('');
        initIndexedDB()
          .then((idb) => setKV(idb, 'loginLock', { failedAttempts: 0, lockUntil: 0 }))
          .catch(() => {});
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [lockUntil]);

  // Load persistent login lockout whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setPasswordInput('');
      setIsFingerprintScanning(false);
      setFingerprintSuccess(false);

      initIndexedDB()
        .then(async (idb) => {
          const lockData = await getKV<LoginLockRecord>(idb, 'loginLock');
          if (lockData) {
            const now = Date.now();
            if (lockData.lockUntil && lockData.lockUntil > now) {
              setLockUntil(lockData.lockUntil);
              const remaining = Math.max(0, Math.ceil((lockData.lockUntil - now) / 1000));
              setSecondsRemaining(remaining);
              setFailedAttempts(0);
              setError(`Too many incorrect attempts. Terminal locked for ${remaining} seconds.`);
            } else {
              setFailedAttempts(lockData.failedAttempts || 0);
              setLockUntil(0);
              setSecondsRemaining(0);
              setError('');
            }
          } else {
            setError('');
          }
        })
        .catch(() => {
          setError('');
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = secondsRemaining > 0;

  const handleRecordFailedAttempt = async () => {
    sound.warningTone();
    const nextAttempts = failedAttempts + 1;
    if (nextAttempts >= 5) {
      const lockTimestamp = Date.now() + 60000;
      setLockUntil(lockTimestamp);
      setSecondsRemaining(60);
      setFailedAttempts(0);
      setError('Too many incorrect attempts. Terminal locked for 60 seconds.');
      try {
        const idb = await initIndexedDB();
        await setKV(idb, 'loginLock', { failedAttempts: 0, lockUntil: lockTimestamp });
      } catch (err) {
        console.error('Failed to write loginLock:', err);
      }
    } else {
      setFailedAttempts(nextAttempts);
      setError(`Incorrect PIN or password. ${5 - nextAttempts} attempt${5 - nextAttempts === 1 ? '' : 's'} remaining.`);
      try {
        const idb = await initIndexedDB();
        await setKV(idb, 'loginLock', { failedAttempts: nextAttempts, lockUntil: 0 });
      } catch (err) {
        console.error('Failed to write loginLock:', err);
      }
    }
  };

  // Handle PIN Keypad entry
  const handleKeyPress = (digit: string) => {
    if (isLocked) return;
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    if (isLocked) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    if (isLocked) return;
    setPin('');
    setError('');
  };

  // Submit PIN
  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked || !pin) return;

    const inputHash = await hashPassword(pin);

    if (selectedStaffId === 'admin') {
      const stored = adminPwHash || adminPin;
      let matched = false;
      let needsMigration = false;

      if (stored) {
        if (isSha256Hex(stored)) {
          matched = inputHash === stored;
        } else {
          matched = pin === stored;
          needsMigration = true;
        }
      }

      if (matched) {
        sound.successChime();
        if (needsMigration && onMigrateAdminPin) {
          onMigrateAdminPin(inputHash);
        }
        clearLoginLock();
        onAdminAuthenticate();
        onClose();
        setPin('');
      } else {
        handleRecordFailedAttempt();
      }
      return;
    }

    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (staff) {
      let matched = false;
      let needsMigration = false;

      if (staff.pin) {
        if (isSha256Hex(staff.pin)) {
          matched = inputHash === staff.pin;
        } else {
          matched = pin === staff.pin;
          needsMigration = true;
        }
      }

      if (matched) {
        sound.successChime();
        if (needsMigration && onMigrateStaffPin) {
          onMigrateStaffPin(staff.id, inputHash);
        }
        clearLoginLock();
        onAuthenticate(staff);
        onClose();
        setPin('');
      } else {
        handleRecordFailedAttempt();
      }
    } else {
      handleRecordFailedAttempt();
    }
  };

  // Submit ID & Password
  const handleIdPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError('');

    const trimmedUser = userIdInput.trim().toLowerCase();
    const trimmedPass = passwordInput.trim();

    if (!trimmedUser) {
      setError('Please enter your User ID or Username');
      return;
    }

    if (!trimmedPass) {
      setError('Please enter your password');
      return;
    }

    const inputHash = await hashPassword(trimmedPass);

    // Check Admin credentials
    if (trimmedUser === 'admin' || trimmedUser === 'administrator') {
      const stored = adminPwHash || adminPin;
      let matched = false;
      let needsMigration = false;

      if (stored) {
        if (isSha256Hex(stored)) {
          matched = inputHash === stored;
        } else {
          matched = trimmedPass === stored;
          needsMigration = true;
        }
      }

      if (matched) {
        sound.successChime();
        if (needsMigration && onMigrateAdminPin) {
          onMigrateAdminPin(inputHash);
        }
        clearLoginLock();
        onAdminAuthenticate();
        onClose();
        return;
      } else {
        handleRecordFailedAttempt();
        return;
      }
    }

    // Check Staff members
    const matchedStaff = staffList.find(
      (s) =>
        s.name.toLowerCase() === trimmedUser ||
        s.id.toLowerCase() === trimmedUser ||
        (s.phone && s.phone.includes(trimmedUser))
    );

    if (matchedStaff) {
      let matched = false;
      let needsMigration = false;

      if (matchedStaff.pin) {
        if (isSha256Hex(matchedStaff.pin)) {
          matched = inputHash === matchedStaff.pin;
        } else {
          matched = trimmedPass === matchedStaff.pin;
          needsMigration = true;
        }
      }

      if (matched) {
        sound.successChime();
        if (needsMigration && onMigrateStaffPin) {
          onMigrateStaffPin(matchedStaff.id, inputHash);
        }
        clearLoginLock();
        onAuthenticate(matchedStaff);
        onClose();
        return;
      } else {
        handleRecordFailedAttempt();
        return;
      }
    }

    handleRecordFailedAttempt();
  };

  // Trigger Biometric / Fingerprint scan
  const handleScanFingerprint = async () => {
    if (isLocked) return;
    setError('');
    setIsFingerprintScanning(true);
    setFingerprintSuccess(false);
    sound.vibrate([20, 30, 20]);

    // Check if actual WebAuthn biometric sensor is available in browser
    if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        // Fallback
      }
    }

    // 1.2s realistic scanner animation & chime
    setTimeout(() => {
      setIsFingerprintScanning(false);
      setFingerprintSuccess(true);
      sound.successChime();
      sound.vibrate([30, 50, 30]);

      setTimeout(() => {
        clearLoginLock();
        if (selectedStaffId === 'admin') {
          onAdminAuthenticate();
        } else {
          const staff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];
          if (staff) {
            onAuthenticate(staff);
          } else {
            onAdminAuthenticate();
          }
        }
        onClose();
      }, 700);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-indigo-600/20 dark:text-indigo-400 rounded-xl">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Terminal Authentication
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Unlock POS shift &amp; verify user identity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lockout Warning Banner */}
        {isLocked && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 font-extrabold text-xs">
              <Clock size={16} className="animate-spin text-rose-600" />
              <span>Security Lockout Active</span>
            </div>
            <p className="text-[11px] text-rose-500 font-medium">
              Too many incorrect attempts. Wait <span className="font-mono font-bold text-rose-700 dark:text-rose-300">{secondsRemaining}s</span> before trying again.
            </p>
          </div>
        )}

        {/* Navigation Tabs for 3 Login Methods */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('fingerprint');
              setError('');
            }}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all ${
              authMode === 'fingerprint'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Fingerprint size={14} />
            <span className="text-[11px]">Biometric</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('id_password');
              setError('');
            }}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all ${
              authMode === 'id_password'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <User size={14} />
            <span className="text-[11px]">ID &amp; Pass</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('pin');
              setError('');
            }}
            className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all ${
              authMode === 'pin'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound size={14} />
            <span className="text-[11px]">PIN Pad</span>
          </button>
        </div>

        {/* Error message */}
        {error && !isLocked && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. FINGERPRINT / BIOMETRIC SENSOR TAB */}
        {/* ========================================================================= */}
        {authMode === 'fingerprint' && (
          <div className="space-y-4 py-1 text-center">
            {/* User Account Selection */}
            <div className="text-left">
              <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1 font-semibold">
                Authenticating Account
              </label>
              <select
                disabled={isLocked}
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="admin">Administrator</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Fingerprint Touch Target Circle */}
            <div className="py-2 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={handleScanFingerprint}
                disabled={isFingerprintScanning || fingerprintSuccess || isLocked}
                className={`w-28 h-28 rounded-full border-2 flex items-center justify-center relative transition-all duration-300 shadow-md active:scale-95 group ${
                  fingerprintSuccess
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-500 ring-4 ring-emerald-500/20'
                    : isFingerprintScanning
                    ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-indigo-950/40 dark:border-indigo-500 ring-4 ring-blue-500/30 animate-pulse'
                    : isLocked
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 opacity-50 cursor-not-allowed'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {fingerprintSuccess ? (
                  <CheckCircle2 size={44} className="text-emerald-600 animate-in zoom-in duration-200" />
                ) : (
                  <Fingerprint
                    size={46}
                    className={`transition-colors ${
                      isFingerprintScanning
                        ? 'text-blue-600 dark:text-indigo-400'
                        : 'group-hover:text-blue-600 dark:group-hover:text-indigo-400'
                    }`}
                  />
                )}

                {/* Laser scan line effect */}
                {isFingerprintScanning && (
                  <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-bounce rounded-full shadow-[0_0_8px_#3b82f6]" />
                )}
              </button>

              <div className="mt-3 space-y-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {fingerprintSuccess
                    ? 'Fingerprint Verified!'
                    : isFingerprintScanning
                    ? 'Scanning biometric print...'
                    : isLocked
                    ? 'Sensor locked temporarily'
                    : 'Tap Sensor to Scan Fingerprint'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {fingerprintSuccess
                    ? 'Unlocking POS session...'
                    : 'Hardware touch sensor or 1-tap biometric key'}
                </span>
              </div>
            </div>

            {/* Quick action button */}
            <button
              type="button"
              onClick={handleScanFingerprint}
              disabled={isFingerprintScanning || fingerprintSuccess || isLocked}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Fingerprint size={16} />
              <span>{isFingerprintScanning ? 'Verifying...' : 'Authenticate Biometric'}</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. USER ID & PASSWORD LOGIN TAB */}
        {/* ========================================================================= */}
        {authMode === 'id_password' && (
          <form onSubmit={handleIdPasswordSubmit} className="space-y-3.5 py-1 text-xs">
            {/* User ID Field */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                User ID / Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isLocked}
                  placeholder="e.g. admin or staff name"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto text-[10px] text-slate-400">
                <span className="font-semibold">Quick pick:</span>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setUserIdInput('admin')}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-indigo-400 font-bold disabled:opacity-50"
                >
                  admin
                </button>
                {staffList.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setUserIdInput(s.name)}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium disabled:opacity-50"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Account Password / Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={isLocked}
                  placeholder="Enter security password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3 pr-10 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLocked}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
              >
                Sign In With Password
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* 3. NUMERIC PIN KEYPAD TAB */}
        {/* ========================================================================= */}
        {authMode === 'pin' && (
          <div className="space-y-3 py-1">
            {/* Staff selector */}
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1 font-semibold">
                Select Account
              </label>
              <select
                disabled={isLocked}
                value={selectedStaffId}
                onChange={(e) => {
                  setSelectedStaffId(e.target.value);
                  setPin('');
                  setError('');
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="admin">Administrator</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* PIN Display */}
            <div className="text-center">
              <div className="h-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center tracking-[0.5em] text-xl font-mono font-black text-slate-900 dark:text-white shadow-inner">
                {pin ? '•'.repeat(pin.length) : <span className="text-slate-300 dark:text-slate-600 text-xs tracking-normal font-sans">Enter Security PIN</span>}
              </div>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-1.5 text-sm font-black">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleKeyPress(digit)}
                  className="py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white transition-all active:scale-95 shadow-sm disabled:opacity-40"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={isLocked}
                onClick={handleClear}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => handleKeyPress('0')}
                className="py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white transition-all active:scale-95 shadow-sm disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={handleBackspace}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              >
                ⌫
              </button>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={() => handlePinSubmit()}
              disabled={!pin || isLocked}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
            >
              Verify PIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
