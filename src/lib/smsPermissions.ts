// smsPermissions.ts
// Small Android permission helper for SMS inbox access.

import { PermissionsAndroid, Platform } from 'react-native';

export const READ_SMS_PERMISSION = PermissionsAndroid.PERMISSIONS.READ_SMS;

export async function hasReadSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(READ_SMS_PERMISSION);
}

export async function requestReadSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const status = await PermissionsAndroid.request(READ_SMS_PERMISSION, {
    title: 'Allow SMS access',
    message: 'CashTrack needs access to SMS messages to detect credit card transactions automatically.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
    buttonNeutral: 'Ask me later',
  });

  return status === PermissionsAndroid.RESULTS.GRANTED;
}

export async function ensureReadSmsPermission(): Promise<boolean> {
  const granted = await hasReadSmsPermission();
  if (granted) return true;
  return requestReadSmsPermission();
}
