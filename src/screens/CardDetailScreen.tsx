import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import CategoryRow from '../components/CategoryRow';
import { useTheme } from '../contexts/ThemeContext';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { Transaction, CardCategory } from '../lib/cashbackCore';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { TransactionRow } from '../components/TransactionRow';
import { MonthPicker } from '../components/MonthPicker';

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
        .neq('validation_status', 'ignored')
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

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    const selectedYear = selectedMonth.getFullYear();
    const selectedMonthNum = selectedMonth.getMonth();
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getFullYear() === selectedYear && txDate.getMonth() === selectedMonthNum;
    });
  }, [transactions, selectedMonth]);

  const categoryById = useMemo(() => {
    return new Map(cardCategories.map((category) => [category.id, category]));
  }, [cardCategories]);

  const transactionCategoryTotals = useMemo(() => {
    return filteredTransactions.reduce((accumulator, transaction) => {
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
  }, [filteredTransactions]);

  const totalSpends = useMemo(() => {
    return filteredTransactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
  }, [filteredTransactions]);

  const totalCashback = useMemo(() => {
    return filteredTransactions.reduce((sum, transaction) => sum + (transaction.expected_total_valueback || 0), 0);
  }, [filteredTransactions]);

  const savingsPercentage = totalSpends > 0 ? (totalCashback / totalSpends) * 100 : 0;

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Transaction';
    const category = categoryById.get(categoryId);
    return category?.name || 'Transaction';
  };

  const getCardLabel = () => cardDetails?.name || 'Card Details';

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
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
              {cardDetails?.name || 'Card Details'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
            <MonthPicker selectedDate={selectedMonth} onChange={setSelectedMonth} />
            <IconButton icon={() => <MaterialCommunityIcons name="plus" size={20} color={appTheme.colors.onPrimary} />} onPress={() => (navigation as any).navigate('AddTransaction', { cardId })} />
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

      {/* Card Stats */}
      {cardDetails && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          <Card style={{ backgroundColor: appTheme.colors.surface }}>
            <Card.Content style={{ paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Status
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                    {cardDetails.is_closed ? 'Closed' : 'Active'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Reward Type
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                    {cardDetails.reward_type === 'miles' ? 'Miles' : 'Cashback'}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          <Card style={{ backgroundColor: appTheme.colors.surface }}>
            <Card.Content style={{ paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <View>
                  <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Total Spends
                  </Text>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                    ₹{totalSpends.toLocaleString()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Expected {cardDetails.reward_type === 'miles' ? 'Miles' : 'Cashback'}
                  </Text>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                    {cardDetails.reward_type === 'miles' ? totalCashback.toLocaleString() : `₹${totalCashback.toLocaleString()}`}
                  </Text>
                </View>
              </View>
              <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant }}>
                {savingsPercentage.toFixed(2)}% {cardDetails.reward_type === 'miles' ? 'rate' : 'savings'}
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Categories */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>Categories</Text>
          <IconButton icon={() => <MaterialCommunityIcons name="plus" size={18} color={appTheme.colors.onPrimary} />} onPress={() => (navigation as any).navigate('AddCategory', { cardId })} />
        </View>
        {cardCategories.length > 0 ? (
          <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 12, overflow: 'hidden' }}>
            {cardCategories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                baseCashbackUsed={transactionCategoryTotals[category.id]?.base_cashback || 0}
                acceleratedCashbackUsed={transactionCategoryTotals[category.id]?.accelerated_cashback || 0}
                otherCashbackUsed={transactionCategoryTotals[category.id]?.other_cashback || 0}
                onPress={() => {
                  (navigation as any).navigate('AddCategory', { categoryId: category.id });
                }}
              />
            ))}
          </View>
        ) : (
          <Text variant="bodyMedium" style={{ color: appTheme.colors.onSurfaceVariant }}>No categories defined for this card.</Text>
        )}
      </View>

      {/* Transactions List */}
      <View style={{ paddingHorizontal: 16, paddingTop: 24, marginBottom: 16 }}>
        <Text
          variant="titleMedium"
          style={{ fontWeight: '600', marginBottom: 12 }}
        >
          Transactions ({filteredTransactions.length})
        </Text>

        {filteredTransactions.length > 0 ? (
          <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 12, overflow: 'hidden' }}>
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
          <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center', marginVertical: 24 }}>
            No transactions yet
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
