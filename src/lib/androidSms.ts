// androidSms.ts
// JS wrapper for a native Android SMS reader module.
// When running in the Expo-managed JS environment on Android, a custom native module
// must be provided and registered under `NativeModules.SmsReader` (or similar).

import { NativeModules, Platform } from 'react-native';
import { hasReadSmsPermission, requestReadSmsPermission } from './smsPermissions';

type SmsEntry = { id?: string; address?: string; body: string; date?: string };

const getNative = () => (NativeModules as any).SmsReader;

const isBridgeUnavailableError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err || '');
  return message.includes('_nativeModule') || message.includes('Native SmsReader bridge unavailable');
};

export const hasNativeSmsReader = (): boolean => {
  if (Platform.OS !== 'android') return false;
  try {
    const native = getNative();
    const available = !!native && typeof native.readInbox === 'function';
    console.log('SMS bridge available:', available);
    return available;
  } catch (err) {
    if (isBridgeUnavailableError(err)) {
      console.log('SMS bridge unavailable in this build/runtime; skipping native SMS sync');
      return false;
    }
    console.warn('Failed to inspect SMS bridge availability', err);
    return false;
  }
};

export async function readInbox(): Promise<string[]> {
  console.log('SMS bridge readInbox: entering');
  if (!hasNativeSmsReader()) return [];
  try {
    const granted = (await hasReadSmsPermission()) || (await requestReadSmsPermission());
    if (!granted) {
      throw new Error('SMS read permission denied');
    }

    // Native module should return an array of { id, address, body, date }
    const native = getNative();
    console.log('SMS bridge readInbox: native module resolved', !!native);
    if (!native || typeof native.readInbox !== 'function') {
      throw new Error('Native SmsReader bridge unavailable');
    }
    console.log('SMS bridge readInbox: invoking native method');
    const rows: SmsEntry[] = await native.readInbox();
    // Debug: log the native rows so we can see address/date/body and detect RCS/format issues.
    try {
      const preview = (rows || []).map((r) => ({ id: r.id || null, address: r.address || null, date: r.date || null, body: (r.body || '').slice(0, 240) }));
      console.log(`Native SmsReader rows: ${JSON.stringify(preview)}`);
    } catch (err) {
      console.warn('Failed to stringify native SmsReader rows for debug', err);
    }
    return (rows || []).map((r) => r.body || '');
  } catch (err) {
    if (isBridgeUnavailableError(err)) {
      console.log('SMS bridge unavailable during readInbox; returning no messages');
      return [];
    }
    throw err;
  }
}

export default { hasNativeSmsReader, readInbox };
