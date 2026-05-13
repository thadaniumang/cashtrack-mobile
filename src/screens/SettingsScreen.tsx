import React, { useState, useCallback } from 'react';
import { ScrollView, View, Switch, RefreshControl } from 'react-native';
import { Text, Card, Button, Divider, Dialog, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { appTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: reload settings if needed
    setRefreshing(false);
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setShowSignOutDialog(false);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: appTheme.colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant }}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 8 }}>
            Settings
          </Text>
          <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant }}>
            {user?.email}
          </Text>
        </View>

        {/* Account Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: 12, color: appTheme.colors.onSurfaceVariant }}
          >
            ACCOUNT
          </Text>

          <Card style={{ marginBottom: 16, backgroundColor: appTheme.colors.surface }}>
            <Card.Content style={{ paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                    Email
                  </Text>
                  <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                    {user?.email}
                  </Text>
                </View>
              </View>
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  Member Since
                </Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Preferences Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: 12, color: appTheme.colors.onSurfaceVariant }}
          >
            PREFERENCES
          </Text>

          <Card style={{ marginBottom: 16, backgroundColor: appTheme.colors.surface }}>
            <Card.Content>
              {/* Dark mode is enforced app-wide */}
              <View style={{ paddingVertical: 8 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  Dark Mode is enabled
                </Text>
              </View>
              <Divider style={{ marginVertical: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  Notifications
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                />
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Data Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: 12, color: appTheme.colors.onSurfaceVariant }}
          >
            DATA
          </Text>

          <Card style={{ backgroundColor: appTheme.colors.surface }}>
            <Card.Content style={{ paddingVertical: 0 }}>
              <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, paddingVertical: 8 }}>Create cards, transactions and categories from the Dashboard or Card details screens.</Text>
              <Button
                mode="text"
                style={{ marginVertical: 8 }}
                onPress={() => {
                  // TODO: implement export
                }}
              >
                Export Data as CSV
              </Button>
              <Divider />
              <Button
                mode="text"
                style={{ marginVertical: 8 }}
                onPress={() => {
                  // TODO: implement backup
                }}
              >
                Backup to Cloud
              </Button>
            </Card.Content>
          </Card>
        </View>

        {/* Danger Zone */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, marginBottom: 16 }}>
          <Button
            mode="contained"
            buttonColor="#dc2626"
            onPress={() => setShowSignOutDialog(true)}
            loading={loading}
            disabled={loading}
          >
            Sign Out
          </Button>
        </View>

        {/* Footer */}
        <View style={{ paddingHorizontal: 16, alignItems: 'center', marginTop: 24, paddingBottom: 16 }}>
          <Text
            variant="labelSmall"
            style={{ color: appTheme.colors.onSurfaceVariant, textAlign: 'center' }}
          >
            CashTrack v1.0.0
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: appTheme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}
          >
            © 2026 CashTrack. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* Sign Out Confirmation Dialog */}
      <Portal>
        <Dialog visible={showSignOutDialog} onDismiss={() => setShowSignOutDialog(false)}>
          <Dialog.Title>Sign Out</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to sign out?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSignOutDialog(false)}>
              Cancel
            </Button>
            <Button
              onPress={handleSignOut}
              loading={loading}
              disabled={loading}
              textColor="#dc2626"
            >
              Sign Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
