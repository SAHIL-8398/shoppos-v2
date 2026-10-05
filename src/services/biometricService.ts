/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { BiometricAuth, CheckBiometryResult, BiometryType, AndroidBiometryStrength } from '@aparajita/capacitor-biometric-auth';

export interface BiometricCheckResult {
  isAvailable: boolean;
  isNative: boolean;
  biometryType: string;
  strongBiometryIsAvailable: boolean;
  error?: string;
}

/**
 * Check if biometric hardware (fingerprint, Face ID, etc.) is available on the device
 */
export async function checkBiometricsAvailability(): Promise<BiometricCheckResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info: CheckBiometryResult = await BiometricAuth.checkBiometry();
      const typeStr =
        info.biometryType === BiometryType.fingerprintAuthentication || info.biometryType === BiometryType.touchId
          ? 'Fingerprint'
          : info.biometryType === BiometryType.faceId || info.biometryType === BiometryType.faceAuthentication
          ? 'Face Recognition'
          : info.biometryType === BiometryType.irisAuthentication
          ? 'Iris Scan'
          : info.isAvailable
          ? 'Biometrics'
          : 'None';

      return {
        isAvailable: info.isAvailable,
        isNative: true,
        biometryType: typeStr,
        strongBiometryIsAvailable: info.strongBiometryIsAvailable ?? info.isAvailable,
        error: info.reason,
      };
    } catch (err: any) {
      console.warn('[BiometricAuth] Native check failed:', err);
      return {
        isAvailable: false,
        isNative: true,
        biometryType: 'Native Biometrics',
        strongBiometryIsAvailable: false,
        error: err.message,
      };
    }
  }

  // Web Browser fallback: WebAuthn check
  const hasWebAuthn =
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials;

  return {
    isAvailable: hasWebAuthn,
    isNative: false,
    biometryType: hasWebAuthn ? 'WebAuthn Fingerprint' : 'Simulated Virtual Touch',
    strongBiometryIsAvailable: hasWebAuthn,
  };
}

/**
 * Perform native biometric prompt (Fingerprint / Face unlock dialog) on Android / iOS
 */
export async function authenticateWithNativeBiometrics(
  reason: string = 'Scan your fingerprint or face to unlock ShopPOS Pro'
): Promise<{ success: boolean; error?: string; isNative: boolean }> {
  if (Capacitor.isNativePlatform()) {
    try {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        androidBiometryStrength: AndroidBiometryStrength.weak,
      });
      return { success: true, isNative: true };
    } catch (err: any) {
      console.warn('[BiometricAuth] Native auth cancelled or failed:', err);
      return {
        success: false,
        isNative: true,
        error: err.message || 'Biometric authentication failed or was cancelled.',
      };
    }
  }

  return { success: false, isNative: false };
}
