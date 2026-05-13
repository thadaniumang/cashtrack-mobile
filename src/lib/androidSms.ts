// androidSms.ts
// JS wrapper for a native Android SMS reader module.
// When running in the Expo-managed JS environment on Android, a custom native module
// must be provided and registered under `NativeModules.SmsReader` (or similar).

import { NativeModules, Platform } from 'react-native';
import { hasReadSmsPermission, requestReadSmsPermission } from './smsPermissions';

type SmsEntry = { id?: string; address?: string; body: string; date?: string };

const getNative = () => (NativeModules as any).SmsReader;

export const hasNativeSmsReader = (): boolean => {
  const native = getNative();
  return Platform.OS === 'android' && !!native && typeof native.readInbox === 'function';
};

export async function readInbox(): Promise<string[]> {
  if (!hasNativeSmsReader()) return [];
  const granted = (await hasReadSmsPermission()) || (await requestReadSmsPermission());
  if (!granted) {
    throw new Error('SMS read permission denied');
  }

  // Native module should return an array of { id, address, body, date }
  const native = getNative();
  if (!native || typeof native.readInbox !== 'function') {
    throw new Error('Native SmsReader bridge unavailable');
  }
  const rows: SmsEntry[] = await native.readInbox();
  // Debug: log the native rows so we can see address/date/body and detect RCS/format issues.
  try {
    const preview = (rows || []).map((r) => ({ id: r.id || null, address: r.address || null, date: r.date || null, body: (r.body || '').slice(0, 240) }));
    console.log(`Native SmsReader rows: ${JSON.stringify(preview)}`);
  } catch (err) {
    console.warn('Failed to stringify native SmsReader rows for debug', err);
  }
  return (rows || []).map((r) => r.body || '');
}

export default { hasNativeSmsReader, readInbox };
