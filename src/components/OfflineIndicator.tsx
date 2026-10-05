import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-status-banner"
      className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xl shadow-amber-950/40 border border-amber-400/30 animate-in fade-in slide-in-from-bottom duration-300"
    >
      <WifiOff size={16} className="text-amber-200 shrink-0" />
      <div className="flex-1">
        <span className="font-bold">Offline Mode Active</span>
        <span className="block text-[10px] text-amber-100 font-normal">
          All sales and data are saving securely to local device storage.
        </span>
      </div>
    </div>
  );
};
