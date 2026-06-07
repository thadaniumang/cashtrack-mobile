import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, Chip, IconButton, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import CategoryRow from '../components/CategoryRow';
import { useTheme } from '../contexts/ThemeContext';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { Transaction, CardCategory } from '../lib/cashbackCore';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { TransactionRow } from '../components/TransactionRow';
import { MonthPicker } from '../components/MonthPicker';
import { CreditCardTile } from '../components/CreditCardTile';
import { formatPeriodWithMode, getCalendarMonthDates, getStatementMonthDatesForSelectedMonth, getCapPeriodDates } from '../lib/capPeriods';

export default function CardDetailScreen() {
  const route = useRoute();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CardCategory[]>([]);

  const cardId = (route.params as any)?.cardId;
  const { appTheme } = useTheme();
  const navigation = useNavigation();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'statement'>('calendar');

  const hydrate = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setError('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
      setLoading(false);
      return;
    }

    if (!cardId) {
      setError('No card ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Session check failed: ${sessionError.message}`);
      }

      const userId = sessionData.session?.user.id;
      if (!userId) {
        throw new Error('No active session');
      }

      // Load specific card details from the owned cards table.
      const { data: cardData, error: cardError } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .eq('user_id', userId)
        .single();

      if (cardError) {
        console.error('Card query error:', cardError);
        throw new Error(cardError.message || 'Failed to load card');
      }

      if (!cardData) {
        throw new Error('Card not found');
      }

      setCardDetails(cardData);

      // Load categories for this user.
      const { data: categoryData, error: categoryError } = await supabase
        .from('card_categories')
        .select('*')
        .eq('card_id', cardId)
        .order('name', { ascending: true });

      if (!categoryError && categoryData) {
        setCategories(categoryData);
      }

      // Load transactions for this card
      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .select('*')
        .eq('card_id', cardId)
        .not('validation_status', 'in', '(ignored,rejected)')
        .order('date', { ascending: false })
        .limit(50);

      if (txnError) {
        console.error('Transaction query error:', txnError);
        throw new Error(txnError.message || 'Failed to load transactions');
      }

      setTransactions(txnData || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load card details';
      console.error('CardDetailScreen error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

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
    if (!cardId) return;

    const channel = supabase
      .channel(`card-transactions-${cardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          hydrate();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [cardId, hydrate]);

  const cardCategories = categories;

  const selectedPeriod = useMemo(() => {
    if (!cardDetails) return null;

    if (viewMode === 'calendar') {
      return getCalendarMonthDates(selectedMonth);
    }

    return getStatementMonthDatesForSelectedMonth(selectedMonth, cardDetails.statement_day || 1);
  }, [selectedMonth, cardDetails, viewMode]);

  // Cap period should always follow the card's configured cap period type
  const capPeriod = useMemo(() => {
    if (!cardDetails) return null;
    return getCapPeriodDates(selectedMonth, cardDetails);
  }, [selectedMonth, cardDetails]);

  // Filter transactions by selected period (calendar or statement)
  const filteredTransactions = useMemo(() => {
    if (!selectedPeriod) return [];

    const { startDate, endDate } = selectedPeriod;
    return transactions.filter((transaction) => {
      const transactionDate = (transaction.date || '').slice(0, 10);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions, selectedPeriod]);

  // Transactions filtered for cap calculations follow the card's cap period type
  const capFilteredTransactions = useMemo(() => {
    if (!capPeriod) return [];
    const { startDate, endDate } = capPeriod;
    return transactions.filter((transaction) => {
      const transactionDate = (transaction.date || '').slice(0, 10);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions, capPeriod]);

  const filteredTransactionTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (accumulator, transaction) => {
        accumulator.spent += transaction.amount || 0;
        accumulator.cashback += transaction.expected_total_valueback || 0;
        return accumulator;
      },
      { spent: 0, cashback: 0 }
    );
  }, [filteredTransactions]);

  const categoryById = useMemo(() => {
    return new Map(cardCategories.map((category) => [category.id, category]));
  }, [cardCategories]);

  const transactionCategoryTotals = useMemo(() => {
    return capFilteredTransactions.reduce((accumulator, transaction) => {
      if (!transaction.category_id) return accumulator;
      const existing = accumulator[transaction.category_id] || { 
        base_cashback: 0, 
        accelerated_cashback: 0, 
        other_cashback: 0,
        total_earned_reward: 0,
        spent: 0 
      };
      accumulator[transaction.category_id] = {
        base_cashback: existing.base_cashback + (transaction.base_cashback_amount || 0),
        accelerated_cashback: existing.accelerated_cashback + (transaction.accelerated_cashback_amount || 0),
        other_cashback: existing.other_cashback + (transaction.other_cashback_amount || 0),
        total_earned_reward: existing.total_earned_reward + (transaction.expected_total_valueback || 0),
        spent: existing.spent + (transaction.amount || 0),
      };
      return accumulator;
    }, {} as Record<string, { base_cashback: number; accelerated_cashback: number; other_cashback: number; total_earned_reward: number; spent: number }>);
  }, [capFilteredTransactions]);

  const totalSpends = filteredTransactionTotals.spent;

  const totalCashback = filteredTransactionTotals.cashback;

  const savingsPercentage = totalSpends > 0 ? (totalCashback / totalSpends) * 100 : 0;

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Transaction';
    const category = categoryById.get(categoryId);
    return category?.name || 'Transaction';
  };

  const getCardLabel = () => cardDetails?.name || 'Card Details';

  const periodLabel = useMemo(() => {
    if (!cardDetails) return '';
    return formatPeriodWithMode(cardDetails, selectedMonth, viewMode);
  }, [cardDetails, selectedMonth, viewMode]);

  const toggleViewMode = useCallback(() => {
    setViewMode((previousMode) => (previousMode === 'calendar' ? 'statement' : 'calendar'));
  }, []);

  const heroSpend = totalSpends;
  const heroCashback = totalCashback;
  const heroReturn = savingsPercentage.toFixed(2);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -100,
          right: -110,
          width: 250,
          height: 250,
          borderRadius: 125,
          backgroundColor: appTheme.colors.tertiaryContainer,
          opacity: appTheme.dark ? 0.26 : 0.36,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 170,
          left: -120,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: appTheme.colors.primaryContainer,
          opacity: appTheme.dark ? 0.18 : 0.34,
        }}
      />
      <ScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingBottom: 34, backgroundColor: 'transparent' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      {/* Header */}
      <Surface style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: appTheme.colors.outlineVariant }}>
        <LinearGradient
          colors={[
            appTheme.dark ? '#25113d' : '#f0e8ff',
            appTheme.colors.primaryContainer,
            appTheme.colors.surface,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
              <IconButton
                icon={() => <MaterialCommunityIcons name="arrow-left" size={20} color={appTheme.colors.onBackground} />}
                containerColor={appTheme.colors.surface}
                onPress={() => (navigation as any).goBack()}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconButton
                icon={() => <MaterialCommunityIcons name="pencil" size={18} color={appTheme.colors.onPrimaryContainer} />}
                style={{ backgroundColor: appTheme.colors.primaryContainer }}
                onPress={() => (navigation as any).navigate('AddCard', { cardId })}
              />
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text variant="labelMedium" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Card overview
            </Text>
            <Text variant="headlineSmall" style={{ fontWeight: '900', color: appTheme.colors.onSurface }} numberOfLines={1}>
              {cardDetails?.name || 'Card Details'}
            </Text>
            <Text variant="bodyMedium" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 6 }} numberOfLines={1}>
              {cardDetails?.variant || 'Card'} • {periodLabel}
            </Text>
          </View>

          {cardDetails && (
            <View style={{ marginBottom: 14 }}>
              <CreditCardTile
                cardName={cardDetails.name}
                cardBrand={cardDetails.variant}
                cashback={heroCashback}
                spends={heroSpend}
                rewardType={cardDetails.reward_type}
                isActive
              />
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: appTheme.dark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.76)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: appTheme.colors.outlineVariant }}>
              <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 6 }}>Spend this period</Text>
              <Text variant="titleMedium" style={{ color: appTheme.colors.onSurface, fontWeight: '900' }}>₹{heroSpend.toLocaleString()}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: appTheme.dark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.76)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: appTheme.colors.outlineVariant }}>
              <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 6 }}>Expected cashback</Text>
              <Text variant="titleMedium" style={{ color: appTheme.colors.onSurface, fontWeight: '900' }}>₹{heroCashback.toLocaleString()}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: appTheme.dark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.76)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: appTheme.colors.outlineVariant }}>
              <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 6 }}>Return rate</Text>
              <Text variant="titleMedium" style={{ color: appTheme.colors.onSurface, fontWeight: '900' }}>{heroReturn}%</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Chip compact style={{ backgroundColor: appTheme.colors.secondaryContainer }} textStyle={{ color: appTheme.colors.onSurface, fontWeight: '800' }}>
              {periodLabel}
            </Chip>
            <Chip compact style={{ backgroundColor: appTheme.colors.primaryContainer }} textStyle={{ color: appTheme.colors.onPrimaryContainer, fontWeight: '800' }}>
              {viewMode === 'calendar' ? 'Calendar month' : 'Statement period'}
            </Chip>
          </View>
        </LinearGradient>
      </Surface>

      {/* Error State */}
      {error && (
        <View style={{ margin: 16, padding: 16, backgroundColor: appTheme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: appTheme.colors.outlineVariant }}>
          <Text variant="bodyMedium" style={{ color: appTheme.colors.error }}>
            {error}
          </Text>
        </View>
      )}

      {/* Period View Toggle */}
      {cardDetails?.statement_day && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: appTheme.colors.outlineVariant, paddingHorizontal: 12, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, flex: 1 }}>
                {periodLabel}
              </Text>
              <Chip compact style={{ backgroundColor: appTheme.colors.secondaryContainer }} textStyle={{ color: appTheme.colors.onSurface, fontWeight: '700' }}>
                {savingsPercentage.toFixed(2)}% return
              </Chip>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 8, justifyContent: 'space-between' }}>
              <Chip
                mode="outlined"
                icon={viewMode === 'calendar' ? 'calendar-month-outline' : 'file-document-outline'}
                onPress={toggleViewMode}
                compact
                style={{ borderColor: appTheme.colors.outline, justifyContent: 'center' }}
              >
                {viewMode === 'calendar' ? 'Calendar Month' : 'Statement Period'}
              </Chip>
              <MonthPicker selectedDate={selectedMonth} onChange={setSelectedMonth} />
            </View>
          </View>
        </View>
      )}

      {/* Card Preview */}
      {/* Card preview intentionally lives in the hero for a denser, more premium layout */}

      {/* Categories */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Surface style={{ padding: 14, borderRadius: 18, backgroundColor: appTheme.colors.surface, borderColor: appTheme.colors.outlineVariant, borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text variant="titleMedium" style={{ fontWeight: '800' }}>Categories</Text>
              <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant }}>{cardCategories.length} categories</Text>
            </View>
            <IconButton
              icon={() => <MaterialCommunityIcons name="plus" size={18} color={appTheme.colors.onPrimaryContainer} />}
              style={{ backgroundColor: appTheme.colors.primaryContainer }}
              onPress={() => (navigation as any).navigate('AddCategory', { cardId })}
            />
          </View>

          {cardCategories.length > 0 ? (
            <View>
              {cardCategories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  baseCashbackUsed={transactionCategoryTotals[category.id]?.base_cashback || 0}
                  acceleratedCashbackUsed={transactionCategoryTotals[category.id]?.accelerated_cashback || 0}
                  otherCashbackUsed={transactionCategoryTotals[category.id]?.other_cashback || 0}
                  cardCapPeriodType={cardDetails?.cap_period_type}
                  cardStatementDay={cardDetails?.statement_day}
                  onPress={() => {
                    (navigation as any).navigate('AddCategory', { categoryId: category.id });
                  }}
                />
              ))}
            </View>
          ) : (
            <Text variant="bodyMedium" style={{ color: appTheme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 12 }}>No categories defined for this card.</Text>
          )}
        </Surface>
      </View>

      {/* Transactions List */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, marginBottom: 24 }}>
        <Surface style={{ borderRadius: 18, backgroundColor: appTheme.colors.surface, borderWidth: 1, borderColor: appTheme.colors.outlineVariant, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="titleMedium" style={{ fontWeight: '800' }}>Transactions</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginRight: 8 }}>{filteredTransactions.length}</Text>
              <IconButton
                icon={() => <MaterialCommunityIcons name="plus" size={20} color={appTheme.colors.onPrimaryContainer} />}
                style={{ backgroundColor: appTheme.colors.primaryContainer }}
                onPress={() => (navigation as any).navigate('AddTransaction', { cardId })}
              />
            </View>
          </View>

          {filteredTransactions.length > 0 ? (
            <View>
              {filteredTransactions.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  transactionId={txn.id}
                  title={getCategoryName(txn.category_id)}
                  subtitle={getCardLabel()}
                  amount={txn.amount}
                  cashback={txn.expected_total_valueback || 0}
                  date={new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  onPress={() => {
                    (navigation as any).navigate('AddTransaction', { transactionId: txn.id });
                  }}
                />
              ))}
            </View>
          ) : (
            <Text variant="bodyMedium" style={{ color: appTheme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 18 }}>
              No transactions yet
            </Text>
          )}
        </Surface>
      </View>
      </ScrollView>
    </View>
  );
}
