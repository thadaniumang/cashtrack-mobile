import React, { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, View, Alert } from 'react-native';
import { Text, TextInput, Button, Menu, ActivityIndicator, Checkbox, Card, IconButton, Surface, Chip, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import DatePicker from 'react-native-date-picker';
import { useTheme } from '../contexts/ThemeContext';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { calculateValuebackAmounts, calculateValuebackWithCaps, getCapPeriodDates } from '../lib/cashbackCore';
import { addTransaction, updateTransaction } from '../lib/transactionWriteService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const formatCapPeriodText = (card: any): string => {
  if (!card) return 'this period';
  if (card.cap_period_type === 'statement_month' && card.statement_day) {
    return `this statement period (${card.statement_day}th of each month)`;
  }
  return 'this month';
};

const formatDateForStorage = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStoredDate = (value?: string | null): Date => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

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
  const [existingCashback, setExistingCashback] = useState({ base: 0, accelerated: 0, other: 0 });
  const [currentTransactionCashback, setCurrentTransactionCashback] = useState({ base: 0, accelerated: 0, other: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftStorageKey, setDraftStorageKey] = useState<string | null>(null);
  const routeParams = route.params as any;
  const routeCardId = routeParams?.cardId || null;
  const routeCategoryId = routeParams?.categoryId || null;
  const cardContextLocked = !isEditMode && Boolean(routeCardId);
  const categoryContextLocked = !isEditMode && Boolean(routeCategoryId);

  const resetTransactionForm = () => {
    setAmount('');
    setActualAmount('');
    setSameAsTransactionAmount(true);
    setSelectedCard(null);
    setSelectedCategory(null);
    setCardMenuVisible(false);
    setCategoryMenuVisible(false);
    setIsEditMode(false);
    setTransactionId(null);
    setInitialLoadComplete(false);
    setUseCustomCashback(false);
    setCustomBasePct('');
    setCustomAcceleratedPct('');
    setCustomOtherPct('');
    setCappedValueback(null);
    setIsCapApplied(false);
    setExistingCashback({ base: 0, accelerated: 0, other: 0 });
    setCurrentTransactionCashback({ base: 0, accelerated: 0, other: 0 });
    setPeriodTransactions([]);
    setNotes('');
    setTransactionDate(new Date());
    setDatePickerOpen(false);
    setDraftStorageKey(null);
  };

  useEffect(() => {
    if (isEditMode || !draftStorageKey) {
      return;
    }

    const draft = {
      cardId: selectedCard,
      categoryId: selectedCategory,
      amount,
      sameAsTransactionAmount,
      actualAmount,
      notes,
      transactionDate: formatDateForStorage(transactionDate),
      useCustomCashback,
      customBasePct,
      customAcceleratedPct,
      customOtherPct,
    };

    AsyncStorage.setItem(draftStorageKey, JSON.stringify(draft)).catch((error) => {
      console.error('Failed to persist transaction draft:', error);
    });
  }, [
    isEditMode,
    draftStorageKey,
    selectedCard,
    selectedCategory,
    amount,
    sameAsTransactionAmount,
    actualAmount,
    notes,
    transactionDate,
    useCustomCashback,
    customBasePct,
    customAcceleratedPct,
    customOtherPct,
  ]);

  useEffect(() => {
    const loadData = async () => {
      if (!hasSupabaseEnv) return;

      resetTransactionForm();

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const incomingCardId = routeCardId;
      const incomingCategoryId = routeCategoryId;
      const storageKey = `add-transaction-form-${userId}-${incomingCardId || 'all'}`;

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

        if (incomingCategoryId) {
          const preselectedCategory = categoriesData?.find((category) => category.id === incomingCategoryId);
          if (preselectedCategory) {
            setSelectedCard(preselectedCategory.card_id);
            setSelectedCategory(preselectedCategory.id);
          }
        }
      }

      // Check if we're in edit mode or have a preselected card
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
          setTransactionDate(parseStoredDate(txnData.date));

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
      } else {
        setDraftStorageKey(storageKey);

        try {
          const persistedRaw = await AsyncStorage.getItem(storageKey);
          if (persistedRaw) {
            const persistedData = JSON.parse(persistedRaw);

            setSelectedCard(persistedData.cardId || incomingCardId || '');
            setSelectedCategory(persistedData.categoryId || incomingCategoryId || '');
            setAmount(persistedData.amount || '');
            setSameAsTransactionAmount(
              persistedData.sameAsTransactionAmount !== undefined ? persistedData.sameAsTransactionAmount : true
            );
            setActualAmount(persistedData.actualAmount || '');
            setNotes(persistedData.notes || '');
            setTransactionDate(parseStoredDate(persistedData.transactionDate));
            setUseCustomCashback(persistedData.useCustomCashback || false);
            setCustomBasePct(persistedData.customBasePct || '');
            setCustomAcceleratedPct(persistedData.customAcceleratedPct || '');
            setCustomOtherPct(persistedData.customOtherPct || '');
            if (incomingCardId) {
              setSelectedCard(incomingCardId);
            }
            if (incomingCategoryId) {
              setSelectedCategory(incomingCategoryId);
            }
          } else {
            if (incomingCardId) {
              setSelectedCard(incomingCardId);
            }
            if (incomingCategoryId) {
              setSelectedCategory(incomingCategoryId);
            }
          }
        } catch (error) {
          console.error('Failed to load transaction draft:', error);
          if (incomingCardId) {
            setSelectedCard(incomingCardId);
          }
          if (incomingCategoryId) {
            setSelectedCategory(incomingCategoryId);
          }
        }
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
  const selectedCapLabel = selectedCardObj
    ? (selectedCardObj.cap_period_type === 'statement_month' ? 'Statement month' : 'Calendar month')
    : 'Cap period';

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

  useEffect(() => {
    const fetchCapPreview = async () => {
      if (!hasSupabaseEnv || !selectedCard || !selectedCategoryObj || !selectedCardObj) {
        setExistingCashback({ base: 0, accelerated: 0, other: 0 });
        setCurrentTransactionCashback({ base: 0, accelerated: 0, other: 0 });
        setPeriodTransactions([]);
        setCappedValueback(null);
        setIsCapApplied(false);
        return;
      }

      const previewDate = transactionDate;
      const { startDate, endDate } = getCapPeriodDates(previewDate, selectedCardObj);

      try {
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('card_id', selectedCard)
          .eq('category_id', selectedCategoryObj.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .not('validation_status', 'in', '(ignored,rejected)');

        if (error) throw error;

        const txns = Array.isArray(transactions) ? transactions : [];
        setPeriodTransactions(txns);

        const totals = txns.reduce(
          (accumulator: { base: number; accelerated: number; other: number }, txn: any) => ({
            base: accumulator.base + (txn.base_cashback_amount || 0),
            accelerated: accumulator.accelerated + (txn.accelerated_cashback_amount || 0),
            other: accumulator.other + (txn.other_cashback_amount || 0),
          }),
          { base: 0, accelerated: 0, other: 0 }
        );

        setExistingCashback(totals);

        if (isEditMode && transactionId) {
          const currentTxn = txns.find((txn: any) => txn.id === transactionId);
          if (currentTxn) {
            setCurrentTransactionCashback({
              base: currentTxn.base_cashback_amount || 0,
              accelerated: currentTxn.accelerated_cashback_amount || 0,
              other: currentTxn.other_cashback_amount || 0,
            });
          } else {
            setCurrentTransactionCashback({ base: 0, accelerated: 0, other: 0 });
          }
        } else {
          setCurrentTransactionCashback({ base: 0, accelerated: 0, other: 0 });
        }
      } catch (error) {
        console.error('Error fetching cap preview:', error);
        setExistingCashback({ base: 0, accelerated: 0, other: 0 });
        setCurrentTransactionCashback({ base: 0, accelerated: 0, other: 0 });
        setPeriodTransactions([]);
      }
    };

    fetchCapPreview();
  }, [selectedCard, selectedCategoryObj, selectedCardObj, amount, useCustomCashback, customBasePct, customAcceleratedPct, customOtherPct, isEditMode, transactionId, transactionDate]);

  const cappedPreview = useMemo(() => {
    if (!selectedCategoryObj || !selectedCardObj || parsedAmount <= 0) {
      return null;
    }

    const transactionOverride = useCustomCashback
      ? {
          basePct: customBasePct ? parseFloat(customBasePct) : undefined,
          acceleratedPct: customAcceleratedPct ? parseFloat(customAcceleratedPct) : undefined,
          otherPct: customOtherPct ? parseFloat(customOtherPct) : undefined,
        }
      : undefined;

    const previewDate = transactionDate;
    const txnsForCalculation = isEditMode && transactionId
      ? periodTransactions.filter((txn: any) => txn.id !== transactionId)
      : periodTransactions;

    return calculateValuebackWithCaps(
      parsedAmount,
      selectedCategoryObj,
      existingCashback,
      undefined,
      selectedCardObj,
      transactionOverride,
      txnsForCalculation,
      previewDate,
    );
  }, [selectedCategoryObj, selectedCardObj, parsedAmount, useCustomCashback, customBasePct, customAcceleratedPct, customOtherPct, periodTransactions, existingCashback, isEditMode, transactionId, transactionDate]);

  useEffect(() => {
    if (!cappedPreview) {
      setCappedValueback(null);
      setIsCapApplied(false);
      return;
    }

    setIsCapApplied(cappedPreview.total < rawValueback.total);
    setCappedValueback(cappedPreview.total < rawValueback.total ? cappedPreview : null);
  }, [cappedPreview, rawValueback.total]);

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
          date: formatDateForStorage(transactionDate),
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
          date: formatDateForStorage(transactionDate),
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
      if (draftStorageKey) {
        await AsyncStorage.removeItem(draftStorageKey);
      }
      resetTransactionForm();
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
              if (draftStorageKey) {
                await AsyncStorage.removeItem(draftStorageKey);
              }
              (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
              resetTransactionForm();
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
      <Surface style={{ margin: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: appTheme.colors.surface, elevation: 2 }}>
        <View style={{ padding: 20, backgroundColor: appTheme.colors.tertiaryContainer }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Chip compact icon="swap-horizontal" style={{ alignSelf: 'flex-start', marginBottom: 12, backgroundColor: appTheme.colors.surface }} textStyle={{ color: appTheme.colors.tertiary, fontWeight: '700' }}>
                {isEditMode ? 'Editing transaction' : 'New transaction'}
              </Chip>
              <Text variant="headlineSmall" style={{ fontWeight: '800', color: appTheme.colors.onTertiaryContainer }}>
                {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
              </Text>
              <Text variant="bodyMedium" style={{ color: appTheme.colors.onTertiaryContainer, opacity: 0.9, marginTop: 6, lineHeight: 20 }}>
                Capture spend, card, category, and reward logic in one guided flow.
              </Text>
            </View>
            <IconButton icon="close" size={22} onPress={() => navigation.goBack()} iconColor={appTheme.colors.onTertiaryContainer} style={{ marginTop: -8, backgroundColor: 'rgba(255,255,255,0.14)' }} />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Chip compact icon="credit-card-outline" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} textStyle={{ color: appTheme.colors.onTertiaryContainer }}>{selectedCardObj?.name || 'Select card'}</Chip>
            <Chip compact icon="shape-outline" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} textStyle={{ color: appTheme.colors.onTertiaryContainer }}>{selectedCategoryObj?.name || 'Select category'}</Chip>
            <Chip compact icon="calendar-month" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} textStyle={{ color: appTheme.colors.onTertiaryContainer }}>{selectedCapLabel}</Chip>
          </View>
        </View>

      {!initialLoadComplete ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
            <Card style={{ backgroundColor: appTheme.colors.surfaceVariant, borderRadius: 20 }}>
              <Card.Content style={{ padding: 16, gap: 14 }}>
                <Text variant="titleMedium" style={{ fontWeight: '800', color: appTheme.colors.onSurface }}>Transaction Details</Text>

                <View style={{ gap: 12 }}>
                  <Text variant="labelMedium" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Card *</Text>
                  {cardContextLocked ? (
                    <Card style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }}>
                      <Card.Content style={{ paddingVertical: 12 }}>
                        <Text variant="titleSmall" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>{selectedCardObj?.name || 'Selected card'}</Text>
                        <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>This transaction will be saved to the selected card.</Text>
                      </Card.Content>
                    </Card>
                  ) : (
                    <Menu visible={cardMenuVisible} onDismiss={() => setCardMenuVisible(false)} anchor={<Button mode="outlined" onPress={() => setCardMenuVisible(true)} style={{ backgroundColor: appTheme.colors.surface, borderRadius: 14 }} contentStyle={{ height: 54 }} disabled={loading}>{selectedCardObj?.name || 'Select card'}</Button>}>
                      {cards.map((card) => (
                        <Menu.Item key={card.id} onPress={() => { setSelectedCard(card.id); setSelectedCategory(null); setCardMenuVisible(false); }} title={card.name} />
                      ))}
                    </Menu>
                  )}
                </View>

                {selectedCard && (
                  <View style={{ gap: 12 }}>
                    <Text variant="labelMedium" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Category {categoriesForCard.length === 0 ? '' : '*'}</Text>
                    {categoryContextLocked && selectedCategoryObj ? (
                      <Card style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }}>
                        <Card.Content style={{ paddingVertical: 12 }}>
                          <Text variant="titleSmall" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>{selectedCategoryObj.name}</Text>
                          <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>Category is preselected from the current context.</Text>
                        </Card.Content>
                      </Card>
                    ) : categoriesForCard.length > 0 ? (
                      <Menu visible={categoryMenuVisible} onDismiss={() => setCategoryMenuVisible(false)} anchor={<Button mode="outlined" onPress={() => setCategoryMenuVisible(true)} style={{ backgroundColor: appTheme.colors.surface, borderRadius: 14 }} contentStyle={{ height: 54 }} disabled={loading}>{categoriesForCard.find((c) => c.id === selectedCategory)?.name || 'Select category'}</Button>}>
                        {categoriesForCard.map((category) => (
                          <Menu.Item key={category.id} onPress={() => { setSelectedCategory(category.id); setCategoryMenuVisible(false); }} title={`${category.name} (${(category.base_cashback_pct || 0) + (category.accelerated_cashback_pct || 0) + (category.other_cashback_pct || 0)}%)`} />
                        ))}
                      </Menu>
                    ) : (
                      <Text variant="bodySmall" style={{ color: appTheme.colors.error }}>No categories defined for this card. Add one on the card details page.</Text>
                    )}
                  </View>
                )}

                <Divider />

                <View style={{ gap: 12 }}>
                  <Text variant="labelMedium" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Transaction Amount *</Text>
                  <TextInput mode="outlined" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" disabled={loading} style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }} />
                </View>

                <View style={{ gap: 12 }}>
                  <Text variant="labelMedium" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Transaction Date *</Text>
                  <Button
                    mode="outlined"
                    icon="calendar-month"
                    onPress={() => setDatePickerOpen(true)}
                    style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }}
                    contentStyle={{ height: 54, justifyContent: 'flex-start' }}
                    disabled={loading}
                  >
                    {transactionDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Button>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <Button mode="text" compact onPress={() => setTransactionDate(new Date())} disabled={loading}>
                      Today
                    </Button>
                  </View>
                  <DatePicker
                    modal
                    open={datePickerOpen}
                    date={transactionDate}
                    mode="date"
                    onConfirm={(date) => {
                      setDatePickerOpen(false);
                      setTransactionDate(date);
                    }}
                    onCancel={() => setDatePickerOpen(false)}
                  />
                </View>

                <View style={{ backgroundColor: appTheme.colors.background, borderRadius: 16, padding: 14, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text variant="labelLarge" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Same as Transaction Amount</Text>
                      <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>Toggle off when the actual paid amount differs from the transaction amount.</Text>
                    </View>
                    <Checkbox status={sameAsTransactionAmount ? 'checked' : 'unchecked'} onPress={() => setSameAsTransactionAmount(!sameAsTransactionAmount)} />
                  </View>
                  {!sameAsTransactionAmount && (
                    <TextInput mode="outlined" label="Actual Amount" placeholder="0.00" value={actualAmount} onChangeText={setActualAmount} keyboardType="decimal-pad" disabled={loading} style={{ backgroundColor: appTheme.colors.surface, borderRadius: 14 }} />
                  )}
                </View>
              </Card.Content>
            </Card>

            <Card style={{ backgroundColor: appTheme.colors.surfaceVariant, borderRadius: 20 }}>
              <Card.Content style={{ padding: 16, gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '800', color: appTheme.colors.onSurface }}>Reward Preview</Text>
                    <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>See how reward tiers and caps affect this transaction before saving.</Text>
                  </View>
                  <Checkbox status={useCustomCashback ? 'checked' : 'unchecked'} onPress={() => setUseCustomCashback(!useCustomCashback)} color={appTheme.colors.primary} />
                </View>

                {useCustomCashback && (
                  <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 16, padding: 14, gap: 12 }}>
                    <Text variant="labelLarge" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Custom Cashback Overrides</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                      <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                        <TextInput
                          mode="outlined"
                          label="Base %"
                          value={customBasePct}
                          onChangeText={setCustomBasePct}
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          style={{ width: '100%', backgroundColor: appTheme.colors.background, borderRadius: 14 }}
                        />
                      </View>
                      <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                        <TextInput
                          mode="outlined"
                          label="Accelerated %"
                          value={customAcceleratedPct}
                          onChangeText={setCustomAcceleratedPct}
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          style={{ width: '100%', backgroundColor: appTheme.colors.background, borderRadius: 14 }}
                        />
                      </View>
                      <View style={{ width: '100%', paddingHorizontal: 6 }}>
                        <TextInput
                          mode="outlined"
                          label="Other %"
                          value={customOtherPct}
                          onChangeText={setCustomOtherPct}
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          style={{ width: '100%', backgroundColor: appTheme.colors.background, borderRadius: 14 }}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {parsedAmount > 0 && selectedCategory && (
                  <View style={{ gap: 12 }}>
                    {isCapApplied && cappedValueback && (
                      <View style={{ padding: 12, backgroundColor: appTheme.colors.warningContainer, borderRadius: 16, gap: 6 }}>
                        <Text style={{ color: appTheme.colors.onWarningContainer, fontWeight: '700' }}>Category cap applied</Text>
                        <Text style={{ color: appTheme.colors.onWarningContainer }}>{`Showing capped total ₹${cappedValueback.total.toFixed(2)} ${formatCapPeriodText(selectedCard ? cards.find((c) => c.id === selectedCard) : null)}`}</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                      {[
                        { label: 'Base', value: (cappedValueback ? cappedValueback.base : rawValueback.base).toFixed(2), color: appTheme.colors.success, icon: 'alpha-b-box' },
                        { label: 'Accelerated', value: (cappedValueback ? cappedValueback.accelerated : rawValueback.accelerated).toFixed(2), color: appTheme.colors.info, icon: 'speedometer' },
                        { label: 'Other', value: (cappedValueback ? cappedValueback.other : rawValueback.other).toFixed(2), color: appTheme.colors.warning, icon: 'dots-horizontal' },
                      ].map((item, index) => (
                        <View key={item.label} style={{ width: index < 2 ? '50%' : '100%', paddingHorizontal: 6, marginBottom: index < 2 ? 12 : 0 }}>
                          <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 18, padding: 14, alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
                            <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant }}>{item.label}</Text>
                            <Text variant="titleMedium" style={{ fontWeight: '800', color: item.color }}>₹{item.value}</Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: appTheme.colors.surfaceVariant, alignItems: 'center' }}>
                      <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant, marginBottom: 4 }}>Total Expected</Text>
                      <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: appTheme.colors.primary }}>₹{(cappedValueback ? cappedValueback.total : rawValueback.total).toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>

            <Card style={{ backgroundColor: appTheme.colors.surfaceVariant, borderRadius: 20 }}>
              <Card.Content style={{ padding: 16, gap: 12 }}>
                <Text variant="titleMedium" style={{ fontWeight: '800', color: appTheme.colors.onSurface }}>Notes</Text>
                <TextInput mode="outlined" label="Description (optional)" placeholder="e.g., Hotel booking via SmartBuy" value={notes} onChangeText={setNotes} maxLength={200} multiline numberOfLines={3} disabled={loading} style={{ backgroundColor: appTheme.colors.surface, borderRadius: 14 }} />
                <Text variant="labelSmall" style={{ color: appTheme.colors.onSurfaceVariant }}>{notes.length}/200</Text>
              </Card.Content>
            </Card>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Button mode="outlined" style={{ flex: 1, borderRadius: 14 }} onPress={() => { resetTransactionForm(); navigation.goBack(); }} disabled={loading}>Cancel</Button>
              <Button mode="contained" style={{ flex: 1, borderRadius: 14 }} contentStyle={{ height: 52 }} onPress={handleAddTransaction} loading={loading} disabled={loading || !selectedCard || !selectedCategory}>{isEditMode ? 'Update' : 'Add'}</Button>
            </View>
            {isEditMode && (
              <Button mode="outlined" style={{ borderRadius: 14, borderColor: appTheme.colors.error }} contentStyle={{ height: 50 }} onPress={handleDeleteTransaction} disabled={loading} textColor={appTheme.colors.error}>Delete Transaction</Button>
            )}
          </View>
        </>
      )}
      </Surface>
    </ScrollView>
  );
}
