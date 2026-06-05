// smsPermissions.ts
// Small Android permission helper for SMS inbox access.

import { PermissionsAndroid, Platform } from 'react-native';

export const READ_SMS_PERMISSION = PermissionsAndroid.PERMISSIONS.READ_SMS;

export async function hasReadSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(READ_SMS_PERMISSION);
  } catch (err) {
    console.warn('SMS permission check unavailable:', err);
    return false;
  }
}

export async function requestReadSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const status = await PermissionsAndroid.request(READ_SMS_PERMISSION, {
      title: 'Allow SMS access',
      message: 'CashTrack needs access to SMS messages to detect credit card transactions automatically.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
      buttonNeutral: 'Ask me later',
    });

    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('SMS permission request unavailable:', err);
    return false;
  }
}

export async function ensureReadSmsPermission(): Promise<boolean> {
  const granted = await hasReadSmsPermission();
  if (granted) return true;
  return requestReadSmsPermission();
}
