import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, View, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  ActivityIndicator,
  Checkbox,
  IconButton,
  Surface,
  Chip,
  Divider,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { CustomDropdown } from '../components/CustomDropdown';

const CAP_TYPES: { value: string; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
  { value: 'per_transaction', label: 'Per Transaction' },
];

const CASHBACK_TIMINGS: { value: string; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'current_statement', label: 'Current Statement' },
  { value: 'next_statement', label: 'Next Statement' },
];

const validateCapRows = (
  rows: { cap_type: string; cap_amount: string }[],
  tierLabel: string,
): string | null => {
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row.cap_amount.trim()) {
      return `${tierLabel} cap amount is required`;
    }

    const amount = parseFloat(row.cap_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return `${tierLabel} cap amount must be greater than 0`;
    }

    if (seen.has(row.cap_type)) {
      return `${tierLabel} caps cannot have duplicate cap types`;
    }

    seen.add(row.cap_type);
  }

  return null;
};

export default function AddCategoryModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { appTheme } = useTheme();

  const [categoryName, setCategoryName] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [splitCashback, setSplitCashback] = useState(false);
  const [cashback, setCashback] = useState('0');
  const [basePct, setBasePct] = useState('0');
  const [baseTiming, setBaseTiming] = useState('instant');
  const [baseCaps, setBaseCaps] = useState<{ cap_type: string; cap_amount: string }[]>([]);
  const [acceleratedPct, setAcceleratedPct] = useState('0');
  const [acceleratedTiming, setAcceleratedTiming] = useState('instant');
  const [acceleratedCaps, setAcceleratedCaps] = useState<{ cap_type: string; cap_amount: string }[]>([]);
  const [otherPct, setOtherPct] = useState('0');
  const [otherTiming, setOtherTiming] = useState('instant');
  const [otherCaps, setOtherCaps] = useState<{ cap_type: string; cap_amount: string }[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [originalCardId, setOriginalCardId] = useState('');
  const [routeCardId, setRouteCardId] = useState<string | null>(null);
  const [draftStorageKey, setDraftStorageKey] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const baseCapValidationError = useMemo(() => validateCapRows(baseCaps, 'Base tier'), [baseCaps]);
  const acceleratedCapValidationError = useMemo(
    () => (splitCashback ? validateCapRows(acceleratedCaps, 'Accelerated tier') : null),
    [acceleratedCaps, splitCashback],
  );
  const otherCapValidationError = useMemo(
    () => (splitCashback ? validateCapRows(otherCaps, 'Other tier') : null),
    [otherCaps, splitCashback],
  );

  const cardContextId = isEditMode ? selectedCardId : routeCardId;
  const cardContext = cards.find((card) => card.id === cardContextId);
  const cardContextLabel = cardContext?.name || 'Selected card';

  const resetCategoryForm = () => {
    setCategoryName('');
    setSelectedCardId('');
    setSplitCashback(false);
    setCashback('0');
    setBasePct('0');
    setBaseTiming('instant');
    setBaseCaps([]);
    setAcceleratedPct('0');
    setAcceleratedTiming('instant');
    setAcceleratedCaps([]);
    setOtherPct('0');
    setOtherTiming('instant');
    setOtherCaps([]);
    setIsEditMode(false);
    setCategoryId(null);
    setOriginalCardId('');
    setRouteCardId(null);
  };

  useEffect(() => {
    if (!initialLoadComplete || isEditMode || !draftStorageKey || !cardContextId) {
      return;
    }

    const draft = {
      categoryName,
      selectedCardId,
      splitCashback,
      cashback,
      basePct,
      baseTiming,
      baseCaps,
      acceleratedPct,
      acceleratedTiming,
      acceleratedCaps,
      otherPct,
      otherTiming,
      otherCaps,
    };

    AsyncStorage.setItem(draftStorageKey, JSON.stringify(draft)).catch((error) => {
      console.error('Failed to persist category draft:', error);
    });
  }, [
    initialLoadComplete,
    isEditMode,
    draftStorageKey,
    cardContextId,
    categoryName,
    selectedCardId,
    splitCashback,
    cashback,
    basePct,
    baseTiming,
    baseCaps,
    acceleratedPct,
    acceleratedTiming,
    acceleratedCaps,
    otherPct,
    otherTiming,
    otherCaps,
  ]);

  useEffect(() => {
    const loadData = async () => {
      if (!hasSupabaseEnv) return;

      setInitialLoadComplete(false);
      resetCategoryForm();

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const routeParams = route.params as any;
      const incomingCardId = routeParams?.cardId || null;
      setRouteCardId(incomingCardId);

      if (!routeParams?.categoryId && !incomingCardId) {
        Alert.alert('Missing Context', 'No card context provided');
        navigation.goBack();
        return;
      }

      const storageKey = incomingCardId ? `add-category-draft-${userId}-${incomingCardId}` : null;
      setDraftStorageKey(storageKey);

      const { data } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_closed', false)
        .order('name', { ascending: true });

      setCards(data || []);

      if (routeParams?.categoryId) {
        setIsEditMode(true);
        setCategoryId(routeParams.categoryId);

        const { data: categoryData, error: categoryError } = await supabase
          .from('card_categories')
          .select('*')
          .eq('id', routeParams.categoryId)
          .single();

        if (categoryError) {
          console.error('Error loading category:', categoryError);
          Alert.alert('Error', 'Failed to load category');
          return;
        }

        if (categoryData) {
          setCategoryName(categoryData.name);
          setSelectedCardId(categoryData.card_id);
          setOriginalCardId(categoryData.card_id);
          setSplitCashback(!!(categoryData.accelerated_cashback_pct || categoryData.other_cashback_pct));
          setCashback((categoryData.base_cashback_pct || 0).toString());
          setBasePct((categoryData.base_cashback_pct || 0).toString());
          setBaseTiming(categoryData.base_cashback_timing || 'instant');
          setAcceleratedPct((categoryData.accelerated_cashback_pct || 0).toString());
          setAcceleratedTiming(categoryData.accelerated_cashback_timing || 'instant');
          setOtherPct((categoryData.other_cashback_pct || 0).toString());
          setOtherTiming(categoryData.other_cashback_timing || 'instant');

          if (Array.isArray(categoryData.base_cashback_caps)) {
            setBaseCaps(categoryData.base_cashback_caps.map((c: any) => ({ cap_type: c.cap_type, cap_amount: String(c.cap_amount) })));
          } else if (categoryData.base_cap_amount) {
            setBaseCaps([{ cap_type: categoryData.base_cap_type || 'monthly', cap_amount: String(categoryData.base_cap_amount) }]);
          }

          if (Array.isArray(categoryData.accelerated_cashback_caps)) {
            setAcceleratedCaps(categoryData.accelerated_cashback_caps.map((c: any) => ({ cap_type: c.cap_type, cap_amount: String(c.cap_amount) })));
          } else if (categoryData.accelerated_cap_amount) {
            setAcceleratedCaps([{ cap_type: categoryData.accelerated_cap_type || 'monthly', cap_amount: String(categoryData.accelerated_cap_amount) }]);
          }

          if (Array.isArray(categoryData.other_cashback_caps)) {
            setOtherCaps(categoryData.other_cashback_caps.map((c: any) => ({ cap_type: c.cap_type, cap_amount: String(c.cap_amount) })));
          } else if (categoryData.other_cap_amount) {
            setOtherCaps([{ cap_type: categoryData.other_cap_type || 'monthly', cap_amount: String(categoryData.other_cap_amount) }]);
          }
        }
      } else {
        try {
          const persistedRaw = storageKey ? await AsyncStorage.getItem(storageKey) : null;
          if (persistedRaw) {
            const persistedData = JSON.parse(persistedRaw);
            setCategoryName(persistedData.categoryName || '');
            setSplitCashback(persistedData.splitCashback || false);
            setCashback(persistedData.cashback || '0');
            setBasePct(persistedData.basePct || '0');
            setBaseTiming(persistedData.baseTiming || 'instant');
            setBaseCaps(Array.isArray(persistedData.baseCaps) ? persistedData.baseCaps : []);
            setAcceleratedPct(persistedData.acceleratedPct || '0');
            setAcceleratedTiming(persistedData.acceleratedTiming || 'instant');
            setAcceleratedCaps(Array.isArray(persistedData.acceleratedCaps) ? persistedData.acceleratedCaps : []);
            setOtherPct(persistedData.otherPct || '0');
            setOtherTiming(persistedData.otherTiming || 'instant');
            setOtherCaps(Array.isArray(persistedData.otherCaps) ? persistedData.otherCaps : []);
          }
        } catch (error) {
          console.error('Failed to load category draft:', error);
        }

        if (incomingCardId) {
          setSelectedCardId(incomingCardId);
        }
      }

      setInitialLoadComplete(true);
    };

    loadData();
  }, [route.params]);

  const addCap = (tier: 'base' | 'accelerated' | 'other') => {
    const row = { cap_type: 'monthly', cap_amount: '' };
    if (tier === 'base') setBaseCaps((prev) => [...prev, row]);
    if (tier === 'accelerated') setAcceleratedCaps((prev) => [...prev, row]);
    if (tier === 'other') setOtherCaps((prev) => [...prev, row]);
  };

  const updateCap = (
    tier: 'base' | 'accelerated' | 'other',
    idx: number,
    field: 'cap_type' | 'cap_amount',
    value: string,
  ) => {
    const updater = (arr: any[], setFn: any) => {
      const copy = [...arr];
      copy[idx] = { ...copy[idx], [field]: value };
      setFn(copy);
    };
    if (tier === 'base') updater(baseCaps, setBaseCaps);
    if (tier === 'accelerated') updater(acceleratedCaps, setAcceleratedCaps);
    if (tier === 'other') updater(otherCaps, setOtherCaps);
  };

  const removeCap = (tier: 'base' | 'accelerated' | 'other', idx: number) => {
    const remover = (arr: any[], setFn: any) => {
      const copy = [...arr];
      copy.splice(idx, 1);
      setFn(copy);
    };
    if (tier === 'base') remover(baseCaps, setBaseCaps);
    if (tier === 'accelerated') remover(acceleratedCaps, setAcceleratedCaps);
    if (tier === 'other') remover(otherCaps, setOtherCaps);
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim() || !cardContextId) {
      Alert.alert('Validation', 'Please fill in all required fields');
      return;
    }

    const totalPct = splitCashback
      ? parseFloat(basePct || '0') + parseFloat(acceleratedPct || '0') + parseFloat(otherPct || '0')
      : parseFloat(cashback || '0');

    if (totalPct > 100) {
      Alert.alert('Validation', 'Total cashback percentage exceeds 100%');
      return;
    }

    if (baseCapValidationError || acceleratedCapValidationError || otherCapValidationError) {
      Alert.alert('Validation', baseCapValidationError || acceleratedCapValidationError || otherCapValidationError || 'Invalid caps');
      return;
    }

    if (!isEditMode) {
      const { count, error: categoryCountError } = await supabase
        .from('card_categories')
        .select('id', { count: 'exact', head: true })
        .eq('card_id', cardContextId);

      if (categoryCountError) {
        Alert.alert('Error', 'Failed to validate category count');
        return;
      }

      if ((count || 0) >= 25) {
        Alert.alert('Limit Reached', 'This card already has 25 categories. Remove one before adding another.');
        return;
      }
    } else if (selectedCardId !== originalCardId) {
      const { count, error: categoryCountError } = await supabase
        .from('card_categories')
        .select('id', { count: 'exact', head: true })
        .eq('card_id', selectedCardId);

      if (categoryCountError) {
        Alert.alert('Error', 'Failed to validate category count');
        return;
      }

      if ((count || 0) >= 25) {
        Alert.alert('Limit Reached', 'This card already has 25 categories. Remove one before moving this category.');
        return;
      }
    }

    setLoading(true);
    try {
      const updatePayload: any = {
        name: categoryName.trim(),
        base_cashback_pct: splitCashback ? parseFloat(basePct || '0') : parseFloat(cashback || '0'),
        base_cashback_timing: baseTiming,
        base_cashback_caps: baseCaps.map((b) => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
        accelerated_cashback_pct: splitCashback ? parseFloat(acceleratedPct || '0') : 0,
        accelerated_cashback_timing: acceleratedTiming,
        accelerated_cashback_caps: acceleratedCaps.map((b) => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
        other_cashback_pct: splitCashback ? parseFloat(otherPct || '0') : 0,
        other_cashback_timing: otherTiming,
        other_cashback_caps: otherCaps.map((b) => ({ cap_type: b.cap_type, cap_amount: parseFloat(b.cap_amount) })),
      };

      if (isEditMode && categoryId) {
        const { error } = await supabase
          .from('card_categories')
          .update(updatePayload)
          .eq('id', categoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('card_categories')
          .insert([{ card_id: cardContextId, ...updatePayload }]);
        if (error) throw error;
      }

      if (draftStorageKey) {
        await AsyncStorage.removeItem(draftStorageKey);
      }

      (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
      navigation.goBack();
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryId) return;

    Alert.alert('Delete Category', 'Are you sure you want to delete this category?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.from('card_categories').delete().eq('id', categoryId);
            if (error) throw error;
            (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
            navigation.goBack();
          } catch (error) {
            console.error('Error deleting category:', error);
            Alert.alert('Error', 'Failed to delete category');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const renderCapRows = (
    tier: 'base' | 'accelerated' | 'other',
    title: string,
    percent: string,
    setPercent: (v: string) => void,
    timing: string,
    setTiming: (v: string) => void,
    rows: { cap_type: string; cap_amount: string }[],
    errorMessage: string | null,
  ) => (
    <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 16, padding: 14, gap: 12 }}>
      <Text variant="labelLarge" style={{ fontWeight: '800', color: appTheme.colors.onSurface }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Text variant="labelSmall" style={{ marginBottom: 8, color: appTheme.colors.onSurface }}>{title} %</Text>
          <TextInput
            mode="outlined"
            keyboardType="numeric"
            value={percent}
            onChangeText={setPercent}
            style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }}
          />
        </View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text variant="labelSmall" style={{ marginBottom: 8, color: appTheme.colors.onSurface }}>{title} Timing</Text>
          <CustomDropdown value={timing} options={CASHBACK_TIMINGS} onSelect={(value) => setTiming(value as string)} />
        </View>
      </View>

      <Divider />

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="labelLarge" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>{title} Caps</Text>
          <Button mode="text" onPress={() => addCap(tier)}>Add Cap</Button>
        </View>

        {rows.length === 0 ? (
          <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant }}>No cap configured</Text>
        ) : (
          rows.map((c, i) => (
            <View key={`${tier}-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <CustomDropdown
                value={c.cap_type}
                options={CAP_TYPES}
                onSelect={(value) => updateCap(tier, i, 'cap_type', value as string)}
                style={{ flex: 1 }}
              />
              <TextInput
                mode="outlined"
                keyboardType="numeric"
                value={c.cap_amount}
                onChangeText={(v) => updateCap(tier, i, 'cap_amount', v)}
                style={{ width: 120, backgroundColor: appTheme.colors.background, borderRadius: 14 }}
              />
              <Button mode="text" onPress={() => removeCap(tier, i)}>Remove</Button>
            </View>
          ))
        )}

        {errorMessage && <Text variant="labelSmall" style={{ color: appTheme.colors.error }}>{errorMessage}</Text>}
      </View>
    </View>
  );

  const rewardModeLabel = splitCashback ? 'Split rewards' : 'Single reward';

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: appTheme.colors.background }}
      style={{ backgroundColor: appTheme.colors.background }}
    >
      <Surface style={{ margin: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: appTheme.colors.surface, elevation: 2 }}>
        <View style={{ padding: 20, backgroundColor: appTheme.colors.secondaryContainer }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Chip compact style={{ alignSelf: 'flex-start', marginBottom: 12, backgroundColor: appTheme.colors.surface }} textStyle={{ color: appTheme.colors.secondary, fontWeight: '700' }}>
                {isEditMode ? 'Editing category' : 'New category'}
              </Chip>
              <Text variant="headlineSmall" style={{ fontWeight: '800', color: appTheme.colors.onSecondaryContainer }}>
                {isEditMode ? 'Edit Category' : 'Add Category'}
              </Text>
              <Text variant="bodyMedium" style={{ color: appTheme.colors.onSecondaryContainer, opacity: 0.9, marginTop: 6, lineHeight: 20 }}>
                Define reward tiers, caps, and timing in a structured way.
              </Text>
            </View>
            <IconButton
              icon="close"
              size={22}
              onPress={() => navigation.goBack()}
              iconColor={appTheme.colors.onSecondaryContainer}
              style={{ marginTop: -8, backgroundColor: 'rgba(255,255,255,0.14)' }}
            />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Chip compact style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} textStyle={{ color: appTheme.colors.onSecondaryContainer }}>
              {rewardModeLabel}
            </Chip>
            <Chip compact style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} textStyle={{ color: appTheme.colors.onSecondaryContainer }}>
              {splitCashback ? '3-tier rewards' : '1-tier rewards'}
            </Chip>
          </View>
        </View>

        {!initialLoadComplete ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
            {isEditMode && (
              <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: appTheme.colors.error, backgroundColor: appTheme.colors.errorContainer }}>
                <Text variant="labelSmall" style={{ color: appTheme.colors.onErrorContainer, fontWeight: '700' }}>
                  Changes apply to new transactions only.
                </Text>
              </View>
            )}

            <Card style={{ backgroundColor: appTheme.colors.surfaceVariant, borderRadius: 20 }}>
              <Card.Content style={{ padding: 16, gap: 12 }}>
                <Text variant="titleMedium" style={{ fontWeight: '800', color: appTheme.colors.onSurface }}>Basics</Text>
                <TextInput
                  mode="outlined"
                  label="Category Name *"
                  placeholder="e.g., Dining, Travel, Utilities"
                  value={categoryName}
                  onChangeText={setCategoryName}
                  style={{ backgroundColor: appTheme.colors.surface, borderRadius: 14 }}
                />
                <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 16, padding: 14 }}>
                  <Text variant="labelMedium" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Card *</Text>
                  <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4, marginBottom: 10 }}>
                    This category is attached to the selected card.
                  </Text>
                  <Card style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }}>
                    <Card.Content style={{ paddingVertical: 12 }}>
                      <Text variant="titleSmall" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>{cardContextLabel}</Text>
                    </Card.Content>
                  </Card>
                </View>
              </Card.Content>
            </Card>

            <Card style={{ backgroundColor: appTheme.colors.surfaceVariant, borderRadius: 20 }}>
              <Card.Content style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '800', color: appTheme.colors.onSurface }}>Reward Structure</Text>
                    <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
                      Toggle between a single cashback rate or separate base, accelerated, and other tiers.
                    </Text>
                  </View>
                  <Checkbox status={splitCashback ? 'checked' : 'unchecked'} onPress={() => setSplitCashback((s) => !s)} color={appTheme.colors.primary} />
                </View>

                {!splitCashback ? (
                  <View style={{ backgroundColor: appTheme.colors.surface, borderRadius: 16, padding: 14, gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: 140 }}>
                        <Text variant="labelSmall" style={{ marginBottom: 8, color: appTheme.colors.onSurface }}>Reward Rate (%)</Text>
                        <TextInput mode="outlined" keyboardType="numeric" value={cashback} onChangeText={setCashback} style={{ backgroundColor: appTheme.colors.background, borderRadius: 14 }} />
                      </View>
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <Text variant="labelSmall" style={{ marginBottom: 8, color: appTheme.colors.onSurface }}>When credited</Text>
                        <CustomDropdown value={baseTiming} options={CASHBACK_TIMINGS} onSelect={(value) => setBaseTiming(value as string)} />
                      </View>
                    </View>

                    <Divider />

                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="labelLarge" style={{ fontWeight: '700', color: appTheme.colors.onSurface }}>Caps</Text>
                        <Button mode="text" onPress={() => addCap('base')}>Add Cap</Button>
                      </View>
                      {baseCaps.length === 0 ? (
                        <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant }}>No cap configured</Text>
                      ) : (
                        baseCaps.map((c, i) => (
                          <View key={`base-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <CustomDropdown value={c.cap_type} options={CAP_TYPES} onSelect={(value) => updateCap('base', i, 'cap_type', value as string)} style={{ flex: 1 }} />
                            <TextInput mode="outlined" keyboardType="numeric" value={c.cap_amount} onChangeText={(v) => updateCap('base', i, 'cap_amount', v)} style={{ width: 120, backgroundColor: appTheme.colors.background, borderRadius: 14 }} />
                            <Button mode="text" onPress={() => removeCap('base', i)}>Remove</Button>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                ) : (
                  <>
                    {renderCapRows('base', 'Base', basePct, setBasePct, baseTiming, setBaseTiming, baseCaps, baseCapValidationError)}
                    {renderCapRows('accelerated', 'Accelerated', acceleratedPct, setAcceleratedPct, acceleratedTiming, setAcceleratedTiming, acceleratedCaps, acceleratedCapValidationError)}
                    {renderCapRows('other', 'Other', otherPct, setOtherPct, otherTiming, setOtherTiming, otherCaps, otherCapValidationError)}
                  </>
                )}
              </Card.Content>
            </Card>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Button mode="outlined" style={{ flex: 1, borderRadius: 14 }} onPress={() => navigation.goBack()} disabled={loading}>
                Cancel
              </Button>
              <Button
                mode="contained"
                style={{ flex: 1, borderRadius: 14 }}
                contentStyle={{ height: 52 }}
                onPress={handleAddCategory}
                loading={loading}
                disabled={loading || Boolean(baseCapValidationError) || Boolean(acceleratedCapValidationError) || Boolean(otherCapValidationError)}
              >
                {isEditMode ? 'Update' : 'Add'} Category
              </Button>
            </View>

            {isEditMode && (
              <Button
                mode="outlined"
                style={{ borderRadius: 14, borderColor: appTheme.colors.error }}
                contentStyle={{ height: 50 }}
                onPress={handleDeleteCategory}
                disabled={loading}
                textColor={appTheme.colors.error}
              >
                Delete Category
              </Button>
            )}
          </View>
        )}
      </Surface>
    </ScrollView>
  );
}
