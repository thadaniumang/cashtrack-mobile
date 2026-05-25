import 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { Platform, View, ActivityIndicator, StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { Snackbar } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef, emitTransactionChanged } from './src/navigation/NavigationService';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from './src/hooks/useAuth';
import { useTheme, ThemeProvider } from './src/contexts/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { hasSupabaseEnv, supabase } from './src/lib/supabase';
import { hasNativeSmsReader } from './src/lib/androidSms';
import { ensureReadSmsPermission } from './src/lib/smsPermissions';
import { ingestSmsTransactions } from './src/lib/smsIngestion';

function AppContent() {
  const { user, isLoading } = useAuth();
  const { appTheme, navigationTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const smsPermissionStatus = useRef<'unknown' | 'granted' | 'denied'>('unknown');
  const smsSyncInFlight = useRef(false);
  const insets = useSafeAreaInsets();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarText, setSnackbarText] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    void MaterialCommunityIcons.loadFont().catch((error) => {
      console.warn('Failed to preload MaterialCommunityIcons font', error);
    });
  }, []);

  useEffect(() => {
    if (!isMounted || !user || !hasSupabaseEnv || Platform.OS !== 'android') {
      return;
    }

    let isCancelled = false;

    const syncSmsTransactions = async () => {
      if (smsSyncInFlight.current) {
        return;
      }

      if (!hasNativeSmsReader()) {
        console.log('SMS sync skipped: native SmsReader module is not available in this build');
        return;
      }

      smsSyncInFlight.current = true;

      try {
        if (smsPermissionStatus.current !== 'granted') {
          const granted = await ensureReadSmsPermission();
          if (isCancelled) return;
          smsPermissionStatus.current = granted ? 'granted' : 'denied';
          if (!granted) {
            console.log('SMS sync skipped: READ_SMS permission denied');
            return;
          }
        }

        const { data, error } = await supabase
          .from('cards')
          .select('id,name,last_4_digits')
          .eq('user_id', user.id);

        if (error) {
          console.warn('SMS sync skipped: failed to load cards', error.message);
          return;
        }

        if (isCancelled) return;

        const results = await ingestSmsTransactions(user.id, (data || []) as Array<{ id: string; name: string; last_4_digits?: string | null }>);
        const createdCount = results.filter((result) => result.createdTransaction && !('error' in result.createdTransaction)).length;
        const failedEntries = results.filter((result) => result.createdTransaction && 'error' in result.createdTransaction);
        const rejectedEntries = results.filter((result) => !result.createdTransaction);
        const createdEntries = results.filter((result) => result.createdTransaction && !('error' in result.createdTransaction));

        const previewMessage = (value: string | null | undefined, max = 140) => {
          const text = (value || '').replace(/\s+/g, ' ').trim();
          if (text.length <= max) return text;
          return `${text.slice(0, max)}...`;
        };

        const createdDetails = createdEntries.map((entry) => ({
          sms: previewMessage(entry.parsed.rawMessage),
          amount: entry.parsed.amount,
          matchedCardId: entry.match.cardId,
          matchedCardName: entry.match.matchedName,
          matchReason: entry.match.reason,
          confidence: entry.match.confidence,
          transactionId: (entry.createdTransaction as { id?: string })?.id || null,
          transactionDate: (entry.createdTransaction as { date?: string })?.date || null,
          validationStatus: (entry.createdTransaction as { validation_status?: string })?.validation_status || null,
        }));

        const rejectedDetails = rejectedEntries.map((entry) => ({
          sms: previewMessage(entry.parsed.rawMessage),
          reason: entry.match.reason,
          amount: entry.parsed.amount,
          matchedCardId: entry.match.cardId,
          matchedCardName: entry.match.matchedName,
          confidence: entry.match.confidence,
        }));

        const failedDetails = failedEntries.map((entry) => ({
          sms: previewMessage(entry.parsed.rawMessage),
          reason: entry.match.reason,
          error: String((entry.createdTransaction as { error?: unknown })?.error || 'Unknown error'),
          amount: entry.parsed.amount,
          matchedCardId: entry.match.cardId,
          matchedCardName: entry.match.matchedName,
          confidence: entry.match.confidence,
        }));

        // Log all entries for diagnostics as JSON strings to avoid React Native [Object] truncation.
        const logSummary = {
          total: results.length,
          created: createdCount,
          failed: failedEntries.length,
          rejected: rejectedEntries.length,
          rejectionReasons: rejectedEntries.map((r) => r.match.reason),
        };
        console.log(`SMS ingestion summary: ${JSON.stringify(logSummary)}`);
        if (createdDetails.length > 0) {
          console.log(`SMS created details: ${JSON.stringify(createdDetails)}`);
        }
        if (rejectedDetails.length > 0) {
          console.log(`SMS rejected details: ${JSON.stringify(rejectedDetails)}`);
        }
        if (failedDetails.length > 0) {
          console.warn(`SMS failed details: ${JSON.stringify(failedDetails)}`);
        }

        if (failedEntries.length > 0) {
          const firstError = String(failedEntries[0].createdTransaction?.error || 'Unknown SMS ingestion error');
          console.warn(`SMS sync scanned ${results.length} messages, created ${createdCount}, error: ${firstError}`);
          console.warn(`SMS sync had failures: ${JSON.stringify(failedDetails)}`);
        } else if (rejectedEntries.length > 0) {
          const rejectionSample = rejectedEntries.slice(0, 2).map((r) => `"${r.parsed.rawMessage?.substring(0, 30)}..." (${r.match.reason})`).join('; ');
          console.log(`SMS sync scanned ${results.length} messages, created ${createdCount}, rejected: ${rejectionSample}`);
        } else {
          console.log(`SMS sync scanned ${results.length} messages and created ${createdCount} transactions`);
        }
        // Show a snackbar toast when new transactions are created via background SMS ingestion
        if (createdCount > 0) {
          setSnackbarText(`Added ${createdCount} transactions via SMS — Refresh to see them`);
          setSnackbarVisible(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('SMS sync failed', error);
        console.warn(`SMS sync failed: ${message}`);
      } finally {
        smsSyncInFlight.current = false;
      }
    };

    void syncSmsTransactions();
    const intervalId = setInterval(syncSmsTransactions, 60_000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [isMounted, user?.id]);

  if (!isMounted || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={appTheme}>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        style={{ marginBottom: (insets?.bottom || 0) + 80 }}
      >
        {snackbarText}
      </Snackbar>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="default"
      />

      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top', 'bottom']}
      >
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
