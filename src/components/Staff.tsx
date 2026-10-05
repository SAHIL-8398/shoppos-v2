/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Shield,
  Key,
  Phone,
  Trash2,
  Edit2,
  CheckCircle2,
  LogOut,
  X,
  Lock,
} from 'lucide-react';
import { AppDatabase, Staff } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { useDialog } from '../context/DialogContext';
import { hashPassword, isSha256Hex } from '../db';

interface StaffProps {
  db: AppDatabase;
  activeStaff: Staff | null;
  onSaveStaff: (staff: Staff) => void;
  onDeleteStaff: (staffId: string) => void;
  onLoginStaff: (staff: Staff) => void;
  onLogoutStaff: () => void;
}

export const StaffComponent: React.FC<StaffProps> = ({
  db,
  activeStaff,
  onSaveStaff,
  onDeleteStaff,
  onLoginStaff,
  onLogoutStaff,
}) => {
  const { t } = useLocalization();
  const { alert, toast, confirm } = useDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'admin' | 'cashier' | 'manager'>('cashier');
  const [phone, setPhone] = useState('');

  const staffList = db.staff || [];

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setName('');
    setPin('');
    setRole('cashier');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Staff) => {
    setEditingStaff(s);
    setName(s.name);
    setPin(s.pin || '');
    setRole((s.role as any) || 'cashier');
    setPhone(s.phone || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Staff member name is required.', 'Validation Error');
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      alert('PIN must be at least 4 digits.', 'Validation Error');
      return;
    }

    const hashedPin = isSha256Hex(pin.trim()) ? pin.trim() : await hashPassword(pin.trim());

    const newStaff: Staff = {
      id: editingStaff ? editingStaff.id : `staff_${Date.now()}`,
      name: name.trim(),
      pin: hashedPin,
      role,
      phone: phone.trim(),
    };

    onSaveStaff(newStaff);
    setIsModalOpen(false);
    toast(editingStaff ? 'Staff updated' : 'Staff added', 'success');
  };

  const handleDelete = async (s: Staff) => {
    const ok = await confirm(`Remove staff member "${s.name}"?`, 'Confirm Delete');
    if (ok) {
      if (activeStaff?.id === s.id) {
        onLogoutStaff();
      }
      onDeleteStaff(s.id);
      toast('Staff member removed', 'info');
    }
  };

  return (
    <div id="staff-screen" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Staff &amp; Cashier Access Control</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              {staffList.length} Accounts
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage multi-cashier logins, security PINs, role privileges &amp; shift tracking
          </p>
        </div>

        <button
          id="add-staff-btn"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95"
        >
          <Plus size={16} />
          <span>+ Add Staff Member</span>
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
            No cashier accounts added yet. Running in default Admin mode.
          </div>
        ) : (
          staffList.map((s) => {
            const isCurrentlyActive = activeStaff?.id === s.id;
            return (
              <div
                key={s.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between shadow-sm ${
                  isCurrentlyActive
                    ? 'bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-900/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-black text-base">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm">{s.name}</h4>
                        <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                          {s.role}
                        </span>
                      </div>
                    </div>

                    {isCurrentlyActive && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle2 size={12} /> Active Shift
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Phone:</span>
                      <span className="text-slate-900 dark:text-white font-mono font-medium">{s.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security PIN:</span>
                      <span className="text-slate-900 dark:text-white font-mono font-medium">•••• (Protected)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {isCurrentlyActive ? (
                    <button
                      onClick={onLogoutStaff}
                      className="flex-1 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <LogOut size={13} />
                      <span>Clock Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onLoginStaff(s)}
                      className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <UserCheck size={13} />
                      <span>Clock In</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Staff"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Remove Staff"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-blue-600 dark:text-indigo-400" />
                {editingStaff ? 'Edit Staff Account' : 'Add Cashier / Staff'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Staff Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Amit Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">4-Digit Security PIN *</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-center text-base tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Role Privilege</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value="cashier">Cashier (Billing &amp; Receipts only)</option>
                  <option value="manager">Manager (Inventory, Reports &amp; Voids)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Mobile Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
