import React from 'react';
import { useAuth } from '../hooks/useAuth';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

export default function RootNavigator() {
  const { user } = useAuth();

  return user ? <AppNavigator /> : <AuthNavigator />;
}
