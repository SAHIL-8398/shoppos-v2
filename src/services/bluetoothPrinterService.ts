/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { formatDate } from '../utils';

// Common ESC/POS thermal printer Bluetooth service and characteristic UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosBank / Xprinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Gprinter
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common HM-10 / Serial BLE
];

const PRINTER_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
];

export interface BluetoothPrinterInfo {
  id: string;
  name: string;
  connected: boolean;
}

let connectedDeviceId: string | null = null;
let connectedDeviceName: string | null = null;
let activeServiceUuid: string | null = null;
let activeCharacteristicUuid: string | null = null;

// Web Bluetooth API cache
let webBluetoothDevice: any = null;
let webBluetoothCharacteristic: any = null;

let isBleInitialized = false;

async function ensureBleInitialized() {
  if (Capacitor.isNativePlatform() && !isBleInitialized) {
    try {
      await BleClient.initialize();
      isBleInitialized = true;
    } catch (e) {
      console.warn('[BLE] BleClient initialize error:', e);
    }
  }
}

/**
 * Check if Bluetooth is available / enabled
 */
export async function isBluetoothAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureBleInitialized();
      return await BleClient.isEnabled();
    } catch {
      return false;
    }
  }
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Scan for and connect to a Bluetooth thermal printer
 */
export async function scanAndConnectPrinter(): Promise<{
  success: boolean;
  deviceName?: string;
  deviceId?: string;
  error?: string;
}> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureBleInitialized();
      const device: BleDevice = await BleClient.requestDevice({
        allowDuplicates: false,
      });

      if (!device || !device.deviceId) {
        return { success: false, error: 'No printer selected.' };
      }

      await BleClient.connect(device.deviceId, (disconnectedDeviceId) => {
        console.log(`[BLE] Printer ${disconnectedDeviceId} disconnected`);
        if (connectedDeviceId === disconnectedDeviceId) {
          connectedDeviceId = null;
          connectedDeviceName = null;
          activeServiceUuid = null;
          activeCharacteristicUuid = null;
        }
      });

      connectedDeviceId = device.deviceId;
      connectedDeviceName = device.name || 'Bluetooth Thermal Printer';

      const services = await BleClient.getServices(device.deviceId);
      let foundService: string | null = null;
      let foundChar: string | null = null;

      for (const s of services) {
        const sUuid = s.uuid.toLowerCase();
        for (const c of s.characteristics) {
          const cUuid = c.uuid.toLowerCase();
          if (
            c.properties.write ||
            c.properties.writeWithoutResponse ||
            PRINTER_CHARACTERISTICS.includes(cUuid) ||
            PRINTER_SERVICES.includes(sUuid)
          ) {
            foundService = s.uuid;
            foundChar = c.uuid;
            break;
          }
        }
        if (foundChar) break;
      }

      if (!foundChar && services.length > 0) {
        for (const s of services) {
          for (const c of s.characteristics) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              foundService = s.uuid;
              foundChar = c.uuid;
              break;
            }
          }
          if (foundChar) break;
        }
      }

      activeServiceUuid = foundService;
      activeCharacteristicUuid = foundChar;

      localStorage.setItem('shoppos_bt_printer_name', connectedDeviceName);
      localStorage.setItem('shoppos_bt_printer_id', connectedDeviceId);

      return {
        success: true,
        deviceName: connectedDeviceName,
        deviceId: connectedDeviceId,
      };
    } catch (err: any) {
      console.error('[BLE] Native Bluetooth scan/connect failed:', err);
      return {
        success: false,
        error: err?.message || 'Failed to connect to Bluetooth printer',
      };
    }
  }

  // Web Bluetooth fallback (e.g. desktop Chrome)
  if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });

      if (!device) return { success: false, error: 'No device selected.' };

      const server = await device.gatt.connect();
      webBluetoothDevice = device;
      connectedDeviceName = device.name || 'Web Bluetooth Printer';

      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              webBluetoothCharacteristic = c;
              break;
            }
          }
          if (webBluetoothCharacteristic) break;
        } catch {}
      }

      return {
        success: true,
        deviceName: connectedDeviceName || undefined,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Web Bluetooth connection failed' };
    }
  }

  return {
    success: false,
    error: 'Bluetooth is not supported in this environment.',
  };
}

/**
 * Disconnect active Bluetooth printer
 */
export async function disconnectPrinter(): Promise<void> {
  if (Capacitor.isNativePlatform() && connectedDeviceId) {
    try {
      await BleClient.disconnect(connectedDeviceId);
    } catch (e) {
      console.warn('[BLE] Disconnect error:', e);
    }
  }
  if (webBluetoothDevice?.gatt?.connected) {
    try {
      webBluetoothDevice.gatt.disconnect();
    } catch {}
  }
  connectedDeviceId = null;
  connectedDeviceName = null;
  activeServiceUuid = null;
  activeCharacteristicUuid = null;
  webBluetoothDevice = null;
  webBluetoothCharacteristic = null;
  localStorage.removeItem('shoppos_bt_printer_name');
  localStorage.removeItem('shoppos_bt_printer_id');
}

export function getConnectedPrinterInfo(): BluetoothPrinterInfo {
  return {
    id: connectedDeviceId || '',
    name: connectedDeviceName || localStorage.getItem('shoppos_bt_printer_name') || '',
    connected: Boolean(connectedDeviceId || webBluetoothDevice?.gatt?.connected),
  };
}

/**
 * Send raw ESC/POS bytes to the connected printer
 */
export async function sendEscPosBytes(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
  if (Capacitor.isNativePlatform()) {
    if (!connectedDeviceId || !activeServiceUuid || !activeCharacteristicUuid) {
      const savedId = localStorage.getItem('shoppos_bt_printer_id');
      if (savedId) {
        const connRes = await scanAndConnectPrinter();
        if (!connRes.success) {
          return { success: false, error: 'Please connect a Bluetooth printer in Settings first.' };
        }
      } else {
        return { success: false, error: 'No Bluetooth printer connected. Tap "Connect Printer" first.' };
      }
    }
    try {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const dataView = numbersToDataView(Array.from(chunk));
        await BleClient.writeWithoutResponse(
          connectedDeviceId!,
          activeServiceUuid!,
          activeCharacteristicUuid!,
          dataView
        );
        await new Promise((r) => setTimeout(r, 25));
      }
      return { success: true };
    } catch (err: any) {
      console.error('[BLE] Error writing to Bluetooth printer:', err);
      return { success: false, error: err?.message || 'Error transmitting to printer' };
    }
  }

  if (webBluetoothCharacteristic) {
    try {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await webBluetoothCharacteristic.writeValue(chunk);
        await new Promise((r) => setTimeout(r, 25));
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to write via Web Bluetooth' };
    }
  }

  return { success: false, error: 'No active Bluetooth connection.' };
}

/**
 * Convert plain receipt text into standard ESC/POS commands
 */
export function buildEscPosReceipt(text: string, options?: { is58mm?: boolean; shopName?: string }): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  // ESC @: Initialize printer
  bytes.push(0x1b, 0x40);

  // Character code table: PC437 / Standard
  bytes.push(0x1b, 0x74, 0x00);

  // Line spacing default: ESC 2
  bytes.push(0x1b, 0x32);

  const lines = text.split('\n');
  for (const line of lines) {
    const encoded = encoder.encode(line + '\r\n');
    bytes.push(...Array.from(encoded));
  }

  // Feed 4 lines before cut
  bytes.push(0x1b, 0x64, 0x04);

  // GS V 66 0: Partial cut
  bytes.push(0x1d, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

/**
 * Print receipt text directly to connected Bluetooth thermal printer
 */
export async function printReceiptViaBluetooth(
  receiptText: string,
  options?: { is58mm?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const escPosData = buildEscPosReceipt(receiptText, options);
  return await sendEscPosBytes(escPosData);
}

/**
 * Print a test page to verify Bluetooth connectivity and paper alignment
 */
export async function printTestReceipt(shopName: string = 'ShopPOS Pro'): Promise<{
  success: boolean;
  error?: string;
}> {
  const date = new Date().toLocaleString();
  const testText = [
    '================================',
    `      ${shopName.toUpperCase()}      `,
    '    BLUETOOTH PRINTER TEST     ',
    '================================',
    `Date: ${date}`,
    'Status: Online & Ready',
    'Connection: Bluetooth LE Native',
    '--------------------------------',
    '1. Crisp Font 9x17 / 12x24 [OK]',
    '2. ESC/POS Packet Stream   [OK]',
    '3. Buffer Flush & Cut      [OK]',
    '================================',
    '   Thank You - ShopPOS Pro App  ',
    '================================',
  ].join('\n');

  return await printReceiptViaBluetooth(testText);
}

export const bluetoothPrinterService = {
  isConnected: () => {
    if (Capacitor.isNativePlatform()) {
      return connectedDeviceId !== null;
    }
    return webBluetoothDevice?.gatt?.connected || false;
  },
  requestAndConnect: async () => {
    const res = await scanAndConnectPrinter();
    return res.success;
  },
  printReceipt: async (options: { sale: any; settings: any; paperWidth?: string }) => {
    // Generate receipt text or test receipt
    const dateStr = options.sale.date || new Date().toISOString().split('T')[0];
    const cur = options.settings.currency || 'Rs.';
    const lines = [
      '================================',
      `       ${(options.settings.shopName || 'ShopPOS Pro').toUpperCase()}`,
      `Bill #${options.sale.billNo}    Date: ${formatDate(dateStr)}`,
      '--------------------------------',
      ...options.sale.items.map((i: any) => `${i.name.slice(0, 18).padEnd(18)} x${i.qty}  ${cur}${(i.price * i.qty).toFixed(2)}`),
      '--------------------------------',
      `TOTAL AMOUNT:        ${cur}${options.sale.total.toFixed(2)}`,
      `Payment: ${options.sale.paymentMethod || 'Cash'}`,
      '================================',
      '   THANK YOU! VISIT AGAIN       ',
      '================================',
    ].join('\n');

    const res = await printReceiptViaBluetooth(lines, { is58mm: options.paperWidth === '58mm' });
    return res.success;
  },
  disconnect: disconnectPrinter,
  printTest: printTestReceipt,
};
