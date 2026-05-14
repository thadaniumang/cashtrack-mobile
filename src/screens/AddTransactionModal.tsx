import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Text, TextInput, Button, Menu, ActivityIndicator, Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { calculateValuebackAmounts } from '../lib/cashbackCore';
import { addTransaction, updateTransaction } from '../lib/transactionWriteService';

export default function AddTransactionModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { appTheme } = useTheme();
  const [amount, setAmount] = useState('');
  const [actualAmount, setActualAmount] = useState('');
  const [sameAsTransactionAmount, setSameAsTransactionAmount] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [useCustomCashback, setUseCustomCashback] = useState(false);
  const [customBasePct, setCustomBasePct] = useState('');
  const [customAcceleratedPct, setCustomAcceleratedPct] = useState('');
  const [customOtherPct, setCustomOtherPct] = useState('');
  const [cappedValueback, setCappedValueback] = useState<any | null>(null);
  const [isCapApplied, setIsCapApplied] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!hasSupabaseEnv) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      // Load cards from the owned cards table.
      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_closed', false);
      setCards(cardsData || []);

      // Load all categories for all cards (card_categories doesn't have user_id, only card_id)
      // We'll filter by card_id in the useMemo
      if (cardsData && cardsData.length > 0) {
        const cardIds = cardsData.map(c => c.id);
        const { data: categoriesData } = await supabase
          .from('card_categories')
          .select('*')
          .in('card_id', cardIds);
        setAllCategories(categoriesData || []);
      }

      // Check if we're in edit mode or have a preselected card
      const routeParams = route.params as any;
      if (routeParams?.transactionId) {
        setIsEditMode(true);
        setTransactionId(routeParams.transactionId);

        // Load the transaction
        const { data: txnData, error: txnError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', routeParams.transactionId)
          .single();

        if (txnError) {
          console.error('Error loading transaction:', txnError);
          alert('Failed to load transaction');
          return;
        }

        if (txnData) {
          // Pre-fill the form
          setAmount(String(txnData.amount || ''));
          setSelectedCard(txnData.card_id);
          setSelectedCategory(txnData.category_id);
          setNotes(txnData.notes || '');

          const actualAmountVal = txnData.actual_amount || txnData.amount;
          if (actualAmountVal === txnData.amount) {
            setSameAsTransactionAmount(true);
            setActualAmount('');
          } else {
            setSameAsTransactionAmount(false);
            setActualAmount(String(actualAmountVal || ''));
          }

          // Prefill override percents if present
          if (txnData.override_base_cashback_pct !== null || txnData.override_accelerated_cashback_pct !== null || txnData.override_other_cashback_pct !== null) {
            setUseCustomCashback(true);
            setCustomBasePct(txnData.override_base_cashback_pct !== null && txnData.override_base_cashback_pct !== undefined ? String(txnData.override_base_cashback_pct) : '');
            setCustomAcceleratedPct(txnData.override_accelerated_cashback_pct !== null && txnData.override_accelerated_cashback_pct !== undefined ? String(txnData.override_accelerated_cashback_pct) : '');
            setCustomOtherPct(txnData.override_other_cashback_pct !== null && txnData.override_other_cashback_pct !== undefined ? String(txnData.override_other_cashback_pct) : '');
          }
        }
      } else if (routeParams?.cardId) {
        // Pre-select card when navigating from CardDetailScreen
        setSelectedCard(routeParams.cardId);
      }

      setInitialLoadComplete(true);
    };

    loadData();
  }, []);

  // Get categories for selected card
  const categoriesForCard = useMemo(() => {
    if (!selectedCard) return [];
    return allCategories.filter(c => c.card_id === selectedCard);
  }, [selectedCard, allCategories]);

  const selectedCardObj = cards.find(c => c.id === selectedCard);
  const selectedCategoryObj = allCategories.find(c => c.id === selectedCategory);

  useEffect(() => {
    if (!selectedCategoryObj || isEditMode) return;

    const base = selectedCategoryObj.base_cashback_pct ?? 0;
    const accelerated = selectedCategoryObj.accelerated_cashback_pct ?? 0;
    const other = selectedCategoryObj.other_cashback_pct ?? 0;

    setCustomBasePct(String(base));
    setCustomAcceleratedPct(String(accelerated));
    setCustomOtherPct(String(other));
  }, [selectedCategoryObj, isEditMode]);

  // Calculate expected valueback (raw)
  const parsedAmount = parseFloat(amount) || 0;
  const rawValueback = useMemo(() => {
    if (!selectedCategoryObj || parsedAmount <= 0) {
      return { base: 0, accelerated: 0, other: 0, total: 0, instant: 0, currstmt: 0, nextstmt: 0 };
    }

    const transactionOverride = useCustomCashback
      ? {
          basePct: customBasePct ? parseFloat(customBasePct) : undefined,
          acceleratedPct: customAcceleratedPct ? parseFloat(customAcceleratedPct) : undefined,
          otherPct: customOtherPct ? parseFloat(customOtherPct) : undefined,
        }
      : undefined;

    const raw = calculateValuebackAmounts(parsedAmount, selectedCategoryObj, undefined, selectedCardObj ?? null, transactionOverride);
    return raw;
  }, [selectedCategoryObj, parsedAmount, useCustomCashback, customBasePct, customAcceleratedPct, customOtherPct, selectedCardObj]);

  const handleAddTransaction = async () => {
    const parsedActualAmount = parseFloat(actualAmount) || 0;
    if (!sameAsTransactionAmount && (!actualAmount || parsedActualAmount <= 0)) {
      alert('Please enter a valid actual amount');
      return;
    }

    if (!sameAsTransactionAmount && parsedActualAmount < parsedAmount) {
      alert('Actual amount must be greater than or equal to transaction amount');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Not authenticated');
      if (!selectedCard) throw new Error('Please select a card');
      if (!selectedCategory) throw new Error('Please select a category');

      const finalActualAmount = sameAsTransactionAmount ? parsedAmount : parsedActualAmount;

      const overrideBase = useCustomCashback && customBasePct ? parseFloat(customBasePct) : null;
      const overrideAccelerated = useCustomCashback && customAcceleratedPct ? parseFloat(customAcceleratedPct) : null;
      const overrideOther = useCustomCashback && customOtherPct ? parseFloat(customOtherPct) : null;

      if (isEditMode && transactionId) {
        // Approve pending SMS by marking as validated when updating
        const updates: any = {
          card_id: selectedCard,
          category_id: selectedCategory,
          amount: parsedAmount,
          actual_amount: finalActualAmount,
          override_base_cashback_pct: overrideBase,
          override_accelerated_cashback_pct: overrideAccelerated,
          override_other_cashback_pct: overrideOther,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        };
        
        // If this is a pending SMS, mark it as validated (approved)
        const { data: txnData } = await supabase
          .from('transactions')
          .select('validation_status, source_type')
          .eq('id', transactionId)
          .single();
        
        if (txnData?.validation_status === 'pending' && txnData?.source_type === 'system_sms') {
          updates.validation_status = 'validated';
        }
        
        await updateTransaction(transactionId, updates);
        alert('Transaction updated successfully');
      } else {
        await addTransaction({
          user_id: userId,
          card_id: selectedCard,
          category_id: selectedCategory,
          amount: parsedAmount,
          actual_amount: finalActualAmount,
          currency: selectedCardObj?.currency || 'INR',
          date: new Date().toISOString().split('T')[0],
          source_type: 'manual',
          validation_status: 'pending',
          valueback_pct_override: null,
          override_base_cashback_pct: overrideBase,
          override_accelerated_cashback_pct: overrideAccelerated,
          override_other_cashback_pct: overrideOther,
          notes: notes.trim() || null,
        } as any);
        alert('Transaction added successfully');
      }
      (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
      navigation.goBack();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!transactionId) return;

    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { data: txnData, error: fetchError } = await supabase
                .from('transactions')
                .select('source_type')
                .eq('id', transactionId)
                .single();

              if (fetchError) throw fetchError;
              if (!txnData) throw new Error('Transaction not found');

              if (txnData.source_type === 'system_sms') {
                const { error } = await supabase
                  .from('transactions')
                  .update({ validation_status: 'ignored', updated_at: new Date().toISOString() })
                  .eq('id', transactionId);

                if (error) throw error;
                alert('SMS transaction removed from view');
              } else {
                const { error } = await supabase
                  .from('transactions')
                  .delete()
                  .eq('id', transactionId);

                if (error) throw error;
                alert('Transaction deleted successfully');
              }
              (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting transaction:', error);
              alert('Failed to delete transaction');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: appTheme.colors.background }} style={{ backgroundColor: appTheme.colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant }}>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
          {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
        </Text>
      </View>

      {!initialLoadComplete ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          {/* Form */}
          <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
        {/* Card Selection Dropdown */}
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600', color: appTheme.colors.onSurface }}>
            Card *
          </Text>
          <Menu
            visible={cardMenuVisible}
            onDismiss={() => setCardMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setCardMenuVisible(true)}
                style={{ backgroundColor: appTheme.colors.surface }}
                disabled={loading}
              >
                {selectedCardObj?.name || 'Select card'}
              </Button>
            }
          >
            {cards.map((card) => (
              <Menu.Item
                key={card.id}
                onPress={() => {
                  setSelectedCard(card.id);
                  setSelectedCategory(null);
                  setCardMenuVisible(false);
                }}
                title={card.name}
              />
            ))}
          </Menu>
        </View>

        {/* Category Selection - Only show after card selected */}
        {selectedCard && (
          <View>
            <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600', color: appTheme.colors.onSurface }}>
              Category {categoriesForCard.length === 0 ? '' : '*'}
            </Text>
            {categoriesForCard.length > 0 ? (
              <Menu
                visible={categoryMenuVisible}
                onDismiss={() => setCategoryMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCategoryMenuVisible(true)}
                    style={{ backgroundColor: appTheme.colors.surface }}
                    disabled={loading}
                  >
                    {categoriesForCard.find(c => c.id === selectedCategory)?.name || 'Select category'}
                  </Button>
                }
              >
                {categoriesForCard.map((category) => (
                  <Menu.Item
                    key={category.id}
                    onPress={() => {
                      setSelectedCategory(category.id);
                      setCategoryMenuVisible(false);
                    }}
                    title={`${category.name} (${(category.base_cashback_pct || 0) + (category.accelerated_cashback_pct || 0) + (category.other_cashback_pct || 0)}%)`}
                  />
                ))}
              </Menu>
            ) : (
              <Text variant="bodySmall" style={{ color: appTheme.colors.error }}>
                No categories defined for this card. Add one on the card details page.
              </Text>
            )}
          </View>
        )}

        {/* Amount */}
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600', color: appTheme.colors.onSurface }}>
            Transaction Amount *
          </Text>
          <TextInput
            mode="outlined"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            disabled={loading}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
        </View>

        {/* Actual Amount Toggle */}
        <View style={{ padding: 12, backgroundColor: appTheme.colors.surface, borderRadius: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: sameAsTransactionAmount ? 0 : 12 }}>
            <Button
              mode={sameAsTransactionAmount ? 'contained' : 'outlined'}
              onPress={() => setSameAsTransactionAmount(!sameAsTransactionAmount)}
              disabled={loading}
              compact
            >
              {sameAsTransactionAmount ? '✓' : ''} Same as Transaction
            </Button>
          </View>
          {!sameAsTransactionAmount && (
            <View>
              <Text variant="labelSmall" style={{ marginBottom: 8, color: appTheme.colors.onSurfaceVariant }}>
                Actual Amount (Original price before discounts)
              </Text>
              <TextInput
                mode="outlined"
                placeholder="0.00"
                value={actualAmount}
                onChangeText={setActualAmount}
                keyboardType="decimal-pad"
                disabled={loading}
                style={{ backgroundColor: appTheme.colors.background }}
              />
            </View>
          )}
        </View>

        {/* Custom Cashback Override + Expected Valueback Preview */}
        <View style={{ padding: 12, backgroundColor: appTheme.colors.surface, borderRadius: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Checkbox
              status={useCustomCashback ? 'checked' : 'unchecked'}
              onPress={() => setUseCustomCashback(!useCustomCashback)}
            />
            <Text variant="bodyMedium">Use custom cashback percentages (override)</Text>
          </View>

          {useCustomCashback && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text variant="labelSmall">Base %</Text>
                <TextInput value={customBasePct} onChangeText={setCustomBasePct} placeholder="0.00" keyboardType="decimal-pad" mode="outlined" style={{ backgroundColor: appTheme.colors.surface }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="labelSmall">Accelerated %</Text>
                <TextInput value={customAcceleratedPct} onChangeText={setCustomAcceleratedPct} placeholder="0.00" keyboardType="decimal-pad" mode="outlined" style={{ backgroundColor: appTheme.colors.surface }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="labelSmall">Other %</Text>
                <TextInput value={customOtherPct} onChangeText={setCustomOtherPct} placeholder="0.00" keyboardType="decimal-pad" mode="outlined" style={{ backgroundColor: appTheme.colors.surface }} />
              </View>
            </View>
          )}

          {parsedAmount > 0 && selectedCategory && (
            <View>
              {isCapApplied && cappedValueback && (
                <View style={{ padding: 8, backgroundColor: '#FFF4E5', borderRadius: 6, marginBottom: 8 }}>
                  <Text style={{ color: '#7A4100' }}>{`Rewards reduced due to category cap. Showing capped total ₹${cappedValueback.total.toFixed(2)}`}</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-around', gap: 8 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Base
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: '600', color: '#4CAF50' }}>
                    ₹{(cappedValueback ? cappedValueback.base : rawValueback.base).toFixed(2)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Accelerated
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: '600', color: '#2196F3' }}>
                    ₹{(cappedValueback ? cappedValueback.accelerated : rawValueback.accelerated).toFixed(2)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                    Other
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: '600', color: '#FF9800' }}>
                    ₹{(cappedValueback ? cappedValueback.other : rawValueback.other).toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: appTheme.colors.surfaceVariant, alignItems: 'center' }}>
                <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>
                  Total Expected
                </Text>
                <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: appTheme.colors.primary }}>
                  ₹{(cappedValueback ? cappedValueback.total : rawValueback.total).toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Notes Field */}
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600', color: appTheme.colors.onSurface }}>
            Description (optional)
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., Hotel booking via SmartBuy"
            value={notes}
            onChangeText={setNotes}
            maxLength={200}
            multiline
            numberOfLines={2}
            disabled={loading}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
          <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
            {notes.length}/200
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: 'column', gap: 12, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              mode="outlined"
              style={{ flex: 1 }}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              style={{ flex: 1 }}
              onPress={handleAddTransaction}
              loading={loading}
              disabled={loading || !selectedCard || !selectedCategory}
            >
              {isEditMode ? 'Update' : 'Add'}
            </Button>
          </View>
          {isEditMode && (
            <Button
              mode="outlined"
              style={{ flex: 1 }}
              onPress={handleDeleteTransaction}
              disabled={loading}
              textColor={appTheme.colors.error}
            >
              Delete Transaction
            </Button>
          )}
        </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
