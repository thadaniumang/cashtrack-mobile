import type { Card, CardCategory, Transaction } from '../lib/cashbackCore';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { FAB, Text, ActivityIndicator, IconButton, Snackbar, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { loadDashboardReadModel } from '../lib/dashboardReadService';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { StatsCard } from '../components/StatsCard';
import { CreditCardTile } from '../components/CreditCardTile';
import { TransactionRow } from '../components/TransactionRow';
import { MonthPicker } from '../components/MonthPicker';

interface DashboardState {
  cards: Card[];
  categories: CardCategory[];
  recentTransactions: Transaction[];
  pendingTransactions: Transaction[];
  totals: {
    totalCashback: number;
    totalSpends: number;
    totalActualAmount: number;
  };
  cardTotals: Record<string, { cashback: number; spends: number }>;
}

const initialState: DashboardState = {
  cards: [],
  categories: [],
  recentTransactions: [],
  pendingTransactions: [],
  totals: {
    totalCashback: 0,
    totalSpends: 0,
    totalActualAmount: 0,
  },
  cardTotals: {},
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { appTheme } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [state, setState] = useState<DashboardState>(initialState);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCardTab, setActiveCardTab] = useState<'active' | 'closed'>('active');
  const [smsSyncing, setSmsSyncing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarText, setSnackbarText] = useState('');
  const [addMenuVisible, setAddMenuVisible] = useState(false);

  const hydrate = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setError('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`Session check failed: ${sessionError.message}`);
      setSessionUserId(null);
      setLoading(false);
      return;
    }

    const userId = sessionData.session?.user.id || null;
    setSessionUserId(userId);

    if (!userId) {
      setState(initialState);
      setLoading(false);
      return;
    }

    try {
      const data = await loadDashboardReadModel(userId, selectedMonth, 10, 25);
      setState({
        cards: data.cards,
        categories: data.categories,
        recentTransactions: data.recentTransactions,
        pendingTransactions: data.pendingTransactions,
        totals: data.totals,
        cardTotals: data.cardTotals || {},
      });
    } catch (loadError) {
      const message = loadError instanceof Error
        ? loadError.message
        : (typeof loadError === 'object' && loadError && 'message' in loadError)
          ? String((loadError as { message?: unknown }).message || 'Failed to hydrate dashboard')
          : 'Failed to hydrate dashboard';
      setError(message);
      setState(initialState);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrate();
    setRefreshing(false);
  }, [hydrate]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const parent = (navigation as any).getParent?.();
    if (!parent?.addListener) return;

    const unsubscribe = parent.addListener('transactionChanged', () => {
      hydrate();
    });

    return unsubscribe;
  }, [navigation, hydrate]);

  useFocusEffect(
    useCallback(() => {
      hydrate();
    }, [hydrate])
  );

  useEffect(() => {
    if (!sessionUserId) return;

    const channel = supabase
      .channel(`transactions-${sessionUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${sessionUserId}`,
        },
        () => {
          hydrate();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sessionUserId, hydrate]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: appTheme.colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="bodyMedium" style={{ color: appTheme.colors.error, textAlign: 'center' }}>
          {error}
        </Text>
      </ScrollView>
    );
  }

  if (!sessionUserId) {
    return (
      <ScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: appTheme.colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="bodyMedium" style={{ textAlign: 'center', color: appTheme.colors.onSurface }}>
          Not signed in. Please sign in to view your dashboard.
        </Text>
      </ScrollView>
    );
  }

  // Helper functions
  const activeCards = state.cards.filter((c) => !c.is_closed);
  const inactiveCards = state.cards.filter((c) => c.is_closed);

  const cashbackStats = activeCards.reduce(
    (accumulator, card) => {
      if (card.reward_type !== 'miles') {
        accumulator.cashback += state.cardTotals[card.id]?.cashback || 0;
        accumulator.spends += state.cardTotals[card.id]?.spends || 0;
      }
      return accumulator;
    },
    { cashback: 0, spends: 0 },
  );

  const milesStats = activeCards.reduce(
    (accumulator, card) => {
      if (card.reward_type === 'miles') {
        accumulator.miles += state.cardTotals[card.id]?.cashback || 0;
        accumulator.spends += state.cardTotals[card.id]?.spends || 0;
      }
      return accumulator;
    },
    { miles: 0, spends: 0 },
  );

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorised';
    const category = state.categories.find((c) => c.id === categoryId);
    return category?.name || 'Uncategorised';
  };

  const getCardName = (cardId: string) => {
    const card = state.cards.find((c) => c.id === cardId);
    return card?.name || 'Unknown Card';
  };

  const displayedCards = activeCardTab === 'active' ? activeCards : inactiveCards;
  const hasCashbackCards = activeCards.some((c) => c.reward_type !== 'miles');
  const hasMilesCards = activeCards.some((c) => c.reward_type === 'miles');

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <ScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{ paddingBottom: 100, backgroundColor: appTheme.colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: appTheme.colors.background }}>
          <View>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 6 }}>
              Dashboard
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon={smsSyncing ? 'progress-clock' : 'message-reply-text'}
              onPress={async () => {
                if (!sessionUserId) {
                  setSnackbarText('Not signed in');
                  setSnackbarVisible(true);
                  return;
                }
                setSmsSyncing(true);
                try {
                  const { ingestSmsTransactions } = await import('../lib/smsIngestion');
                  const userCards = state.cards.map((c) => ({ id: c.id, name: c.name, aliases: (c as any).aliases, last_4_digits: (c as any).last_4_digits }));
                  const results = await ingestSmsTransactions(sessionUserId, userCards);
                  const createdCount = results.filter((r) => r.createdTransaction && !(r.createdTransaction as any).error).length;
                  if (createdCount > 0) {
                    setSnackbarText(`Added ${createdCount} transactions via SMS`);
                  } else {
                    setSnackbarText('No new SMS transactions found');
                  }
                  setSnackbarVisible(true);
                  // Refresh dashboard immediately
                  hydrate();
                } catch (err) {
                  setSnackbarText(String(err instanceof Error ? err.message : err));
                  setSnackbarVisible(true);
                } finally {
                  setSmsSyncing(false);
                }
              }}
              size={20}
              style={{ marginLeft: 4 }}
            />
            <MonthPicker selectedDate={selectedMonth} onChange={setSelectedMonth} />
          </View>
        </View>

        {/* Stats Cards - Cashback */}
        {hasCashbackCards && cashbackStats.spends > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            <Text variant="labelLarge" style={{ fontWeight: '600', color: appTheme.colors.onSurfaceVariant }}>
              CASHBACK SUMMARY
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatsCard
                  title="Expected Cashback"
                  value={cashbackStats.cashback}
                  rewardType="cashback"
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatsCard
                  title="Spends"
                  value={cashbackStats.spends}
                  rewardType="cashback"
                />
              </View>
            </View>
          </View>
        )}

        {/* Stats Cards - Miles */}
        {hasMilesCards && milesStats.spends > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            <Text variant="labelLarge" style={{ fontWeight: '600', color: appTheme.colors.onSurfaceVariant }}>
              MILES SUMMARY
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatsCard
                  title="Expected Miles"
                  value={milesStats.miles}
                  rewardType="miles"
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatsCard
                  title="Spends"
                  value={milesStats.spends}
                  rewardType="miles"
                />
              </View>
            </View>
          </View>
        )}

        {/* Card Tabs */}
        {(activeCards.length > 0 || inactiveCards.length > 0) && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: appTheme.colors.surfaceVariant,
              }}
            >
              <Pressable
                onPress={() => setActiveCardTab('active')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderBottomWidth: activeCardTab === 'active' ? 2 : 0,
                  borderBottomColor: appTheme.colors.primary,
                }}
              >
                <Text
                  variant="labelLarge"
                  style={{
                    textAlign: 'center',
                    fontWeight: activeCardTab === 'active' ? 'bold' : '500',
                    color: activeCardTab === 'active' ? appTheme.colors.onSurface : appTheme.colors.onSurfaceVariant,
                  }}
                >
                  Active ({activeCards.length})
                </Text>
              </Pressable>
              {inactiveCards.length > 0 && (
                <Pressable
                  onPress={() => setActiveCardTab('closed')}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderBottomWidth: activeCardTab === 'closed' ? 2 : 0,
                    borderBottomColor: appTheme.colors.primary,
                  }}
                >
                  <Text
                    variant="labelLarge"
                    style={{
                      textAlign: 'center',
                      fontWeight: activeCardTab === 'closed' ? 'bold' : '500',
                      color: activeCardTab === 'closed' ? appTheme.colors.onSurface : appTheme.colors.onSurfaceVariant,
                    }}
                  >
                    Closed ({inactiveCards.length})
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Cards Display - horizontal, sorted by cashback desc */}
            {displayedCards.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {displayedCards
                    .slice()
                    .sort((a, b) => (state.cardTotals[b.id]?.cashback || 0) - (state.cardTotals[a.id]?.cashback || 0))
                    .map((card) => (
                      <View key={card.id} style={{ width: 320, marginRight: 8 }}>
                        <CreditCardTile
                          cardName={card.name}
                          cardBrand={card.variant}
                          cashback={state.cardTotals[card.id]?.cashback || 0}
                          spends={state.cardTotals[card.id]?.spends || 0}
                          rewardType={card.reward_type}
                          isActive={!card.is_closed}
                          onPress={() => {
                            (navigation as any).navigate('CardDetail', { cardId: card.id });
                          }}
                        />
                      </View>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Pending SMS Transactions - Review Required */}
        {state.pendingTransactions.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24, marginBottom: 16 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '600', marginBottom: 12, color: appTheme.colors.error }}
            >
              📱 Pending SMS Review ({state.pendingTransactions.length})
            </Text>
            <View style={{ backgroundColor: appTheme.colors.errorContainer, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: appTheme.colors.error }}>
              {state.pendingTransactions.map((txn) => (
                <Pressable
                  key={txn.id}
                  onPress={() => {
                    (navigation as any).navigate('AddTransaction', { transactionId: txn.id });
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.colors.error }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" style={{ fontWeight: '500', marginBottom: 4 }}>
                        {getCardName(txn.card_id)}
                      </Text>
                      <Text variant="bodySmall" style={{ color: appTheme.colors.onErrorContainer }}>
                        ₹{txn.amount.toFixed(2)} • {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color={appTheme.colors.onErrorContainer} style={{ marginLeft: 8 }} />
                  </View>
                </Pressable>
              ))}
            </View>
            <Text variant="labelSmall" style={{ color: appTheme.colors.error, marginTop: 8 }}>
              Tap to review and approve SMS transactions
            </Text>
          </View>
        )}

        {/* Recent Transactions */}
        {state.recentTransactions.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24, marginBottom: 16 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '600', marginBottom: 12 }}
            >
              Recent Transactions
            </Text>
            <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 12, overflow: 'hidden' }}>
              {state.recentTransactions.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  transactionId={txn.id}
                  title={getCategoryName(txn.category_id)}
                  subtitle={getCardName(txn.card_id)}
                  amount={txn.amount}
                  cashback={txn.expected_total_valueback || 0}
                  date={new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  onPress={() => {
                    (navigation as any).navigate('AddTransaction', { transactionId: txn.id });
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {activeCards.length === 0 && inactiveCards.length === 0 && state.recentTransactions.length === 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24, alignItems: 'center' }}>
            <Text variant="bodyMedium" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 16 }}>
              No cards or transactions yet
            </Text>
          </View>
        )}
      </ScrollView>

      {addMenuVisible && (
        <Pressable
          onPress={() => setAddMenuVisible(false)}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.18)' }]}
        />
      )}
      <View style={{ position: 'absolute', right: 16, bottom: insets.bottom + 24, alignItems: 'flex-end' }}>
        {addMenuVisible && (
          <View style={{ marginBottom: 12, gap: 10, alignItems: 'flex-end' }}>
            <Pressable
              onPress={() => {
                setAddMenuVisible(false);
                (navigation as any).navigate('AddCard', { cardId: null });
              }}
            >
              <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, elevation: 4, backgroundColor: appTheme.colors.surface }}>
                <MaterialCommunityIcons name="credit-card-plus" size={20} color={appTheme.colors.primary} />
                <Text variant="labelLarge" style={{ color: appTheme.colors.onSurface, fontWeight: '600' }}>Add Card</Text>
              </Surface>
            </Pressable>

            <Pressable
              onPress={() => {
                setAddMenuVisible(false);
                (navigation as any).navigate('AddTransaction');
              }}
            >
              <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, elevation: 4, backgroundColor: appTheme.colors.surface }}>
                <MaterialCommunityIcons name="plus" size={20} color={appTheme.colors.primary} />
                <Text variant="labelLarge" style={{ color: appTheme.colors.onSurface, fontWeight: '600' }}>Add Transaction</Text>
              </Surface>
            </Pressable>
          </View>
        )}

        <FAB
          icon={addMenuVisible ? 'close' : 'plus'}
          onPress={() => setAddMenuVisible((value) => !value)}
        />
      </View>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Refresh',
          onPress: async () => {
            await hydrate();
            setSnackbarVisible(false);
          },
        }}
        style={{ marginBottom: insets.bottom + 80 }}
      >
        {snackbarText}
      </Snackbar>
    </View>
  );
}

