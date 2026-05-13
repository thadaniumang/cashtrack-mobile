import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function emitTransactionChanged() {
  try {
    navigationRef.current?.emit?.({ type: 'transactionChanged' });
  } catch (e) {
    // no-op
  }
}
