import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function emitTransactionChanged() {
  try {
    // emit on current navigator
    (navigationRef.current as any)?.emit?.({ type: 'transactionChanged' });
    // also try emitting on parent/root navigator if available
    try {
      const parent = (navigationRef.current as any)?.getParent?.();
      parent?.emit?.({ type: 'transactionChanged' });
    } catch (err) {
      // ignore
    }
  } catch (e) {
    // no-op
  }
}
