/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Share } from '@capacitor/share';

export interface WhatsAppShareOptions {
  phone?: string;
  text: string;
  title?: string;
}

/**
 * Universal WhatsApp message sender and bill sharing helper.
 * On native Capacitor:
 *   1. Attempts direct launch via AppLauncher (using wa.me link)
 *   2. Falls back to Capacitor Share dialog if WhatsApp app cannot be directly launched
 * On web:
 *   Opens wa.me in a new window/tab
 */
export async function sendWhatsAppMessage({
  phone,
  text,
  title = 'Invoice / Receipt',
}: WhatsAppShareOptions): Promise<void> {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const fullPhone = cleanPhone
    ? cleanPhone.length === 10
      ? `91${cleanPhone}`
      : cleanPhone
    : '';

  const waUrl = fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const canOpen = await AppLauncher.canOpenUrl({ url: waUrl });
      if (canOpen.value) {
        await AppLauncher.openUrl({ url: waUrl });
        return;
      }
    } catch (e) {
      console.warn('[WhatsApp] AppLauncher canOpenUrl check error:', e);
    }

    try {
      await AppLauncher.openUrl({ url: waUrl });
      return;
    } catch (launchErr) {
      console.warn('[WhatsApp] AppLauncher openUrl error, attempting Share fallback:', launchErr);
    }

    try {
      await Share.share({
        title,
        text,
        dialogTitle: title,
      });
    } catch (shareErr: any) {
      if (
        shareErr?.message?.toLowerCase().includes('cancel') ||
        shareErr?.message?.toLowerCase().includes('dismiss')
      ) {
        return;
      }
      console.warn('[WhatsApp] Native share fallback failed:', shareErr);
    }
  } else {
    window.open(waUrl, '_blank');
  }
}
