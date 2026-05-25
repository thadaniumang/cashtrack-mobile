import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, IconButton, Surface } from 'react-native-paper';
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

  const totalSpends = useMemo(() => {
    return capFilteredTransactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
  }, [capFilteredTransactions]);

  const totalCashback = useMemo(() => {
    return capFilteredTransactions.reduce((sum, transaction) => sum + (transaction.expected_total_valueback || 0), 0);
  }, [capFilteredTransactions]);

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: appTheme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24, backgroundColor: appTheme.colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant, backgroundColor: appTheme.colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon={() => <MaterialCommunityIcons name="arrow-left" size={20} color={appTheme.colors.onBackground} />}
              onPress={() => (navigation as any).goBack()}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MonthPicker selectedDate={selectedMonth} onChange={setSelectedMonth} />
            <IconButton
              icon={() => <MaterialCommunityIcons name="pencil" size={18} color={appTheme.colors.onPrimaryContainer} />}
              style={{ backgroundColor: appTheme.colors.primaryContainer }}
              onPress={() => (navigation as any).navigate('AddCard', { cardId })}
            />
          </View>
        </View>
      </View>

      {/* Error State */}
      {error && (
        <View style={{ margin: 16, padding: 16, backgroundColor: appTheme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: appTheme.colors.surfaceVariant }}>
          <Text variant="bodyMedium" style={{ color: appTheme.colors.error }}>
            {error}
          </Text>
        </View>
      )}

      {/* Period View Toggle */}
      {cardDetails?.statement_day && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, flex: 1 }}>
              {periodLabel}
            </Text>
            <Chip
              mode="outlined"
              icon={viewMode === 'calendar' ? 'calendar-month-outline' : 'file-document-outline'}
              onPress={toggleViewMode}
              compact
              style={{ borderColor: appTheme.colors.outline }}
            >
              {viewMode === 'calendar' ? 'Calendar Month' : 'Statement Period'}
            </Chip>
          </View>
        </View>
      )}

      {/* Card Preview */}
      {cardDetails && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          <CreditCardTile
            cardName={cardDetails.name}
            cardBrand={cardDetails.variant}
            cashback={totalCashback}
            spends={totalSpends}
            rewardType={cardDetails.reward_type}
            isActive
          />
        </View>
      )}

      {/* Categories */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Surface style={{ padding: 12, borderRadius: 12, backgroundColor: appTheme.colors.surface, borderColor: appTheme.colors.outline }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text variant="titleMedium" style={{ fontWeight: '600' }}>Categories</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>Transactions</Text>
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
      </View>
    </ScrollView>
  );
}
