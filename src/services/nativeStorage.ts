/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const APP_DIR_NAME = 'ShopPOS Pro';
const INVOICES_DIR = `${APP_DIR_NAME}/Invoices`;
const PRODUCT_IMAGES_DIR = `${APP_DIR_NAME}/ProductImages`;
const QUOTATIONS_DIR = `${APP_DIR_NAME}/Quotations`;
const CHALLANS_DIR = `${APP_DIR_NAME}/Challans`;
const BARCODES_DIR = `${APP_DIR_NAME}/Barcodes`;
const BACKUPS_DIR = `${APP_DIR_NAME}/Backups`;

export interface SaveFileResult {
  success: boolean;
  uri?: string;
  path?: string;
  isNative: boolean;
  error?: string;
}

/**
 * Initialize dedicated app folders on native device storage
 */
export async function initAppStorage(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const directories = [
      APP_DIR_NAME,
      INVOICES_DIR,
      PRODUCT_IMAGES_DIR,
      QUOTATIONS_DIR,
      CHALLANS_DIR,
      BARCODES_DIR,
      BACKUPS_DIR,
    ];
    for (const dir of directories) {
      try {
        await Filesystem.mkdir({
          path: dir,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (err: any) {
        if (!err.message?.includes('exists') && !err.message?.includes('OS error 17')) {
          console.warn(`[Capacitor Filesystem] Note on creating directory '${dir}':`, err);
        }
      }
    }
    return true;
  } catch (error) {
    console.error('[Capacitor Filesystem] Error initializing app storage folders:', error);
    return false;
  }
}

/**
 * Save a generated PDF directly into the dedicated app folder.
 */
export async function savePdfToAppFolder(
  base64Data: string,
  filename: string,
  subfolder: string = 'Invoices'
): Promise<SaveFileResult> {
  const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
  if (Capacitor.isNativePlatform()) {
    try {
      await initAppStorage();
      const today = new Date().toISOString().slice(0, 10);
      const targetFolder = `${APP_DIR_NAME}/${subfolder}/${today}`;
      const filePath = `${targetFolder}/${filename}`;
      const writeResult = await Filesystem.writeFile({
        path: filePath,
        data: cleanBase64,
        directory: Directory.Documents,
        recursive: true,
      });
      return {
        success: true,
        uri: writeResult.uri,
        path: filePath,
        isNative: true,
      };
    } catch (error: any) {
      console.error('[Capacitor Filesystem] Failed to write PDF to native storage:', error);
      return {
        success: false,
        isNative: true,
        error: error.message || 'Failed to save PDF to device storage',
      };
    }
  }
  return {
    success: true,
    isNative: false,
    path: filename,
  };
}

/**
 * Save an uploaded product image directly into ShopPOS Pro/ProductImages/
 */
export async function saveProductImageToAppFolder(
  imageBase64: string,
  productName: string = 'product'
): Promise<{ success: boolean; imageUri: string; relativePath?: string }> {
  if (!imageBase64) {
    return { success: false, imageUri: '' };
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await initAppStorage();
      const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+]+);base64,(.*)$/);
      let ext = 'jpg';
      let cleanData = imageBase64;
      if (match) {
        const mime = match[1];
        if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
        else if (mime.includes('gif')) ext = 'gif';
        cleanData = match[2];
      }
      const cleanName = productName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 30);
      const timestamp = Date.now();
      const filename = `prod_${cleanName}_${timestamp}.${ext}`;
      const filePath = `${PRODUCT_IMAGES_DIR}/${filename}`;
      const result = await Filesystem.writeFile({
        path: filePath,
        data: cleanData,
        directory: Directory.Documents,
        recursive: true,
      });
      const webSrc = Capacitor.convertFileSrc(result.uri);
      return {
        success: true,
        imageUri: webSrc || result.uri,
        relativePath: filePath,
      };
    } catch (err: any) {
      console.error('[Capacitor Filesystem] Error saving product image to native folder:', err);
      return {
        success: true,
        imageUri: imageBase64,
      };
    }
  }
  return {
    success: true,
    imageUri: imageBase64,
  };
}

export function isNativeCapacitor(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Universal file saver & downloader that works seamlessly on both Web and Native Android.
 */
export async function downloadOrSaveDataFile(params: {
  filename: string;
  content: string;
  mimeType: string;
  subfolder?: string;
}): Promise<{ success: boolean; message: string; uri?: string }> {
  const { filename, content, mimeType, subfolder = 'Exports' } = params;
  if (Capacitor.isNativePlatform()) {
    try {
      await initAppStorage();
      const targetFolder = `${APP_DIR_NAME}/${subfolder}`;
      const filePath = `${targetFolder}/${filename}`;
      const writeResult = await Filesystem.writeFile({
        path: filePath,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return {
        success: true,
        message: `File saved to Documents/${filePath}`,
        uri: writeResult.uri,
      };
    } catch (err: any) {
      console.error('[Capacitor Filesystem] Error saving data file to native storage:', err);
    }
  }
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
    return {
      success: true,
      message: `File "${filename}" downloaded successfully.`,
    };
  } catch (webErr: any) {
    console.error('Web file download error:', webErr);
    return {
      success: false,
      message: webErr?.message || 'Failed to download file.',
    };
  }
}

/**
 * Save a complete JSON backup of the application database directly into ShopPOS Pro/Backups/
 */
export async function saveBackupJsonToAppFolder(
  jsonContent: string,
  filename?: string
): Promise<SaveFileResult> {
  const finalFilename = filename || `shoppos_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
  if (Capacitor.isNativePlatform()) {
    try {
      await initAppStorage();
      const filePath = `${BACKUPS_DIR}/${finalFilename}`;
      const writeResult = await Filesystem.writeFile({
        path: filePath,
        data: jsonContent,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return {
        success: true,
        uri: writeResult.uri,
        path: filePath,
        isNative: true,
      };
    } catch (error: any) {
      console.error('[Capacitor Filesystem] Failed to write backup to native storage:', error);
      return {
        success: false,
        isNative: true,
        error: error.message || 'Failed to save backup to device storage',
      };
    }
  }
  return {
    success: true,
    isNative: false,
    path: finalFilename,
  };
}

/**
 * Complete Database Export & Native Share workflow
 */
export async function exportAndShareDatabaseBackup(dbData: any): Promise<{
  success: boolean;
  message: string;
  uri?: string;
  filename: string;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const timestamp = Date.now();
  const filename = `shoppos_backup_${today}_${timestamp}.json`;
  const jsonString = JSON.stringify(dbData, null, 2);

  const nowIso = new Date().toISOString();
  localStorage.setItem('shoppos_last_backup', nowIso);

  if (Capacitor.isNativePlatform()) {
    try {
      const saveRes = await saveBackupJsonToAppFolder(jsonString, filename);
      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Filesystem write failure');
      }
      try {
        await Share.share({
          title: 'ShopPOS Pro Database Backup',
          text: `ShopPOS Pro Database Backup exported on ${new Date().toLocaleString()}.\nKeep this file safe to restore all products, sales, and accounts.`,
          url: saveRes.uri,
          files: saveRes.uri ? [saveRes.uri] : undefined,
          dialogTitle: 'Save / Share ShopPOS Database Backup',
        });
      } catch (shareErr: any) {
        console.warn('Share sheet was dismissed or failed:', shareErr);
      }
      return {
        success: true,
        message: `Backup saved to Documents/ShopPOS Pro/Backups/${filename}`,
        uri: saveRes.uri,
        filename,
      };
    } catch (err: any) {
      console.error('Native backup export error:', err);
    }
  }

  try {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);

    return {
      success: true,
      message: `Backup file "${filename}" generated and downloaded successfully.`,
      filename,
    };
  } catch (webErr: any) {
    return {
      success: false,
      message: webErr?.message || 'Failed to export backup JSON.',
      filename,
    };
  }
}

/**
 * Validates a backup JSON payload structure before replacing database.
 */
export function validateBackupData(data: unknown): {
  valid: boolean;
  reason?: string;
  stats?: { products: number; sales: number; customers: number };
} {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'File content is empty or not a valid JSON object.' };
  }

  const payload = data as Record<string, any>;
  if (!Array.isArray(payload.products)) {
    return { valid: false, reason: 'Missing or corrupt "products" array in backup file.' };
  }
  if (!payload.settings || typeof payload.settings !== 'object') {
    return { valid: false, reason: 'Missing or corrupt "settings" configuration in backup file.' };
  }

  return {
    valid: true,
    stats: {
      products: payload.products.length,
      sales: Array.isArray(payload.sales) ? payload.sales.length : 0,
      customers: Array.isArray(payload.customers) ? payload.customers.length : 0,
    },
  };
}

/**
 * Executes a daily auto-backup to device Downloads/Documents folder via @capacitor/filesystem
 */
export async function runDailyAutoBackup(dbData: any): Promise<{ performed: boolean; filename?: string; error?: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = localStorage.getItem('shoppos_last_auto_backup_date');
    if (lastDate === today) {
      return { performed: false };
    }

    const filename = `shoppos_auto_backup_${today}.json`;
    const jsonString = JSON.stringify(dbData, null, 2);

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: jsonString,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch {
        // Fallback to Documents backup directory
        await saveBackupJsonToAppFolder(jsonString, filename);
      }
    }

    const nowIso = new Date().toISOString();
    localStorage.setItem('shoppos_last_backup', nowIso);
    localStorage.setItem('shoppos_last_auto_backup_date', today);
    return { performed: true, filename };
  } catch (err: any) {
    console.warn('[AutoBackup] Daily auto-backup note:', err);
    return { performed: false, error: err?.message };
  }
}

/**
 * Gets the ISO string timestamp of the last successful backup
 */
export function getLastBackupTime(): string | null {
  return localStorage.getItem('shoppos_last_backup');
}
