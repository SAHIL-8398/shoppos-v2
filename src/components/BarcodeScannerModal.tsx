/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  continuous?: boolean;
  onToggleContinuous?: (enabled: boolean) => void;
  cartCount?: number;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  continuous = false,
  onToggleContinuous,
  cartCount,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);
  const [localContinuous, setLocalContinuous] = useState(continuous);
  const isContinuous = onToggleContinuous ? continuous : localContinuous;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-barcode-scanner';
  const isNative = Capacitor.isNativePlatform();
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const isContinuousRef = useRef(isContinuous);
  isContinuousRef.current = isContinuous;

  useEffect(() => {
    setLocalContinuous(continuous);
  }, [continuous]);

  useEffect(() => {
    if (!isOpen) {
      stopWebScanner();
      setLastScannedText(null);
      return;
    }

    let isMounted = true;

    // Native implementation using Google Play Services Code Scanner
    const runNativeScanner = async () => {
      try {
        setError(null);
        setIsScanning(true);

        // 1. Camera permission verification
        const permStatus = await BarcodeScanner.checkPermissions();
        if (permStatus.camera !== 'granted') {
          const req = await BarcodeScanner.requestPermissions();
          if (req.camera !== 'granted') {
            if (isMounted) {
              setError('Camera permission is required to scan barcodes. Please enable camera access in your device settings.');
              setIsScanning(false);
            }
            return;
          }
        }

        // 2. Google Play Services Code Scanner module check on Android
        try {
          const moduleCheck = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          if (!moduleCheck.available) {
            await BarcodeScanner.installGoogleBarcodeScannerModule();
          }
        } catch (moduleErr) {
          console.warn('[BarcodeScanner] Google module availability check:', moduleErr);
        }

        // Loop for continuous scan mode on native
        while (isMounted) {
          const result = await BarcodeScanner.scan({
            formats: [
              BarcodeFormat.Ean13,
              BarcodeFormat.Ean8,
              BarcodeFormat.Code128,
              BarcodeFormat.Code39,
              BarcodeFormat.UpcA,
              BarcodeFormat.UpcE,
              BarcodeFormat.QrCode,
            ],
          });

          if (!isMounted) break;

          if (result.barcodes && result.barcodes.length > 0) {
            const scannedValue = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
            if (scannedValue) {
              const code = scannedValue.trim();
              onScan(code);
              setLastScannedText(`Scanned: ${code}`);

              if (!isContinuousRef.current) {
                onClose();
                return;
              }
              // Wait briefly before opening viewfinder again in continuous mode
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
          }

          // User dismissed scanner UI without scanning
          onClose();
          break;
        }
      } catch (err: any) {
        if (!isMounted) return;
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('dismiss')) {
          onClose();
          return;
        }
        console.error('Native BarcodeScanner error:', err);
        if (msg.includes('module') || msg.includes('unavailable') || msg.includes('download')) {
          setError('Google Play Services Code Scanner module is currently unavailable on this device. Please check your internet connection or Google Play Services.');
        } else if (msg.includes('permission') || msg.includes('denied')) {
          setError('Camera permission was denied. Please allow camera permissions in App Settings.');
        } else {
          setError(err?.message || 'Could not launch native barcode scanner.');
        }
        setIsScanning(false);
      }
    };

    // Web fallback implementation using html5-qrcode
    const runWebScanner = async () => {
      try {
        setError(null);
        setIsScanning(true);

        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              const code = decodedText.trim();
              if (isContinuousRef.current) {
                // Debounce rapid continuous duplicate scans of the same barcode within 1.2s
                const now = Date.now();
                if (
                  lastScanRef.current &&
                  lastScanRef.current.code === code &&
                  now - lastScanRef.current.time < 1200
                ) {
                  return;
                }
                lastScanRef.current = { code, time: now };
                setLastScannedText(`Scanned: ${code}`);
                onScan(code);
              } else {
                onScan(code);
                stopWebScanner();
                onClose();
              }
            }
          },
          () => {
            // Ignore scan failures on empty frames
          }
        );
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Could not access camera. Please allow camera permissions.');
          setIsScanning(false);
        }
      }
    };

    if (isNative) {
      runNativeScanner();
    } else {
      const timer = setTimeout(() => {
        runWebScanner();
      }, 200);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopWebScanner();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, isNative, onScan, onClose]);

  const stopWebScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping web scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleToggleContinuousMode = () => {
    const next = !isContinuous;
    if (onToggleContinuous) {
      onToggleContinuous(next);
    } else {
      setLocalContinuous(next);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="barcode-scanner-modal-backdrop" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="barcode-scanner-modal" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white">
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-indigo-600/20 dark:text-indigo-400 rounded-xl">
              <Camera size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide">Barcode &amp; QR Scanner</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isNative ? 'Google Play Services Code Scanner' : 'Aim camera at product barcode'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleContinuousMode}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                isContinuous
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
              title="Continuous scan keeps camera open until you tap Done"
            >
              Continuous: {isContinuous ? 'ON' : 'OFF'}
            </button>
            <button
              id="close-scanner-btn"
              onClick={() => {
                stopWebScanner();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative bg-black min-h-[300px] flex items-center justify-center p-4">
          {!isNative && (
            <div id={scannerContainerId} className="w-full max-w-sm rounded-2xl overflow-hidden" />
          )}

          {isNative && !error && isScanning && (
            <div className="text-center text-slate-300 space-y-3 p-6">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">Opening Google Code Scanner...</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Scanning hardware is ready. Align the barcode within the Google Play viewfinder.
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-4 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center rounded-2xl">
              <AlertCircle size={44} className="text-rose-500 mb-3" />
              <p className="text-sm font-semibold text-rose-300 mb-2">Scanner Unavailable</p>
              <p className="text-xs text-slate-400 mb-4 max-w-xs">{error}</p>
              <button
                onClick={() => {
                  stopWebScanner();
                  onClose();
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          )}

          {isScanning && !error && !isNative && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 text-slate-300 text-xs flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Scanning active {isContinuous ? '(Continuous Mode)' : ''}</span>
            </div>
          )}

          {lastScannedText && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-emerald-400">
              ✓ {lastScannedText}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Supports EAN-13, EAN-8, UPC, Code-128 &amp; QR</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                stopWebScanner();
                onClose();
              }}
              className="text-slate-600 dark:text-slate-400 font-medium hover:underline cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="scanner-done-btn"
              onClick={() => {
                stopWebScanner();
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs shadow-md transition-all active:scale-95"
            >
              Done {cartCount !== undefined ? `(${cartCount} in cart)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
