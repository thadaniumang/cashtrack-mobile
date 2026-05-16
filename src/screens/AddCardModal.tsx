import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Checkbox, Menu, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { CustomDropdown } from '../components/CustomDropdown';
import type { CapPeriodType, CardVariant, RoundingMethod, RewardType } from '../lib/cashbackCore';

interface BankCardOption {
  id: string;
  name: string;
  bank: string;
}

interface SearchableDropdownOption {
  label: string;
  value: string;
  description?: string;
}

interface SearchableDropdownProps {
  label: string;
  value: string;
  options: SearchableDropdownOption[];
  placeholder: string;
  onSelect: (value: string) => void;
  onCustomSelect?: () => void;
  customLabel?: string;
  disabled?: boolean;
}

function SearchableDropdown({
  label,
  value,
  options,
  placeholder,
  onSelect,
  onCustomSelect,
  customLabel = 'Other (Custom)',
  disabled = false,
}: SearchableDropdownProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = useMemo(() => {
    const selected = options.find((option) => option.value === value);
    return selected?.label || value || placeholder;
  }, [options, placeholder, value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, search]);

  return (
    <View>
      <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
        {label}
      </Text>
      <Menu
        visible={visible}
        onDismiss={() => {
          setVisible(false);
          setSearch('');
        }}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setVisible(true)}
            disabled={disabled}
            style={{ justifyContent: 'center', borderRadius: 4 }}
            contentStyle={{ justifyContent: 'space-between', width: '100%' }}
          >
            {selectedLabel}
          </Button>
        }
      >
        <View style={{ width: 320, maxWidth: '100%', padding: 12 }}>
          <TextInput
            mode="outlined"
            placeholder="Search cards..."
            value={search}
            onChangeText={setSearch}
            dense
            style={{ marginBottom: 8 }}
          />
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <Menu.Item
                  key={option.value}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                    setSearch('');
                  }}
                  title={option.description ? `${option.label} • ${option.description}` : option.label}
                />
              ))
            ) : (
              <View style={{ paddingVertical: 12 }}>
                <Text variant="bodySmall" style={{ textAlign: 'center' }}>
                  No card found.
                </Text>
              </View>
            )}
            {onCustomSelect && (
              <Menu.Item
                onPress={() => {
                  onCustomSelect();
                  setVisible(false);
                  setSearch('');
                }}
                title={customLabel}
              />
            )}
          </ScrollView>
        </View>
      </Menu>
    </View>
  );
}

const CARD_VARIANTS: CardVariant[] = ['Visa', 'Mastercard', 'Diners', 'RuPay', 'Other'];
const REWARD_TYPES: { label: string; value: RewardType }[] = [
  { label: 'Cash Equivalent (Cashback)', value: 'cashback' },
  { label: 'Miles Equivalent (Miles/Points)', value: 'miles' },
];
const CURRENCY_OPTIONS = [
  { label: 'INR (₹)', value: 'INR' },
  { label: 'USD ($)', value: 'USD' },
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'GBP (£)', value: 'GBP' },
];
const ROUNDING_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Round (Nearest)', value: 'round' },
  { label: 'Ceil (Up)', value: 'ceil' },
  { label: 'Floor (Down)', value: 'floor' },
];
const CAP_PERIOD_OPTIONS = [
  { label: 'Calendar Month (1st - Last day)', value: 'calendar_month' },
  { label: 'Statement Month (Custom dates)', value: 'statement_month' },
];

export default function AddCardModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { appTheme } = useTheme();

  const [cardId, setCardId] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardNameMode, setCardNameMode] = useState<'list' | 'custom'>('list');
  const [bankCards, setBankCards] = useState<BankCardOption[]>([]);
  const [variant, setVariant] = useState<CardVariant>('Visa');
  const [rewardType, setRewardType] = useState<RewardType>('cashback');
  const [totalLimit, setTotalLimit] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [minTransactionAmount, setMinTransactionAmount] = useState('0');
  const [last4Digits, setLast4Digits] = useState('');
  const [transactionRounding, setTransactionRounding] = useState<RoundingMethod>('none');
  const [cashbackRounding, setCashbackRounding] = useState<RoundingMethod>('none');
  const [useSteppedCashback, setUseSteppedCashback] = useState(false);
  const [steppedAmount, setSteppedAmount] = useState('');
  const [capPeriodType, setCapPeriodType] = useState<CapPeriodType>('calendar_month');
  const [statementDay, setStatementDay] = useState('1');
  const [isClosed, setIsClosed] = useState(false);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardNameOptions = useMemo(
    () => bankCards.map((card) => ({ label: card.name, value: card.name, description: card.bank })),
    [bankCards],
  );

  const resetForm = () => {
    setCardName('');
    setCardNameMode('list');
    setVariant('Visa');
    setRewardType('cashback');
    setTotalLimit('');
    setCurrency('INR');
    setMinTransactionAmount('0');
    setLast4Digits('');
    setTransactionRounding('none');
    setCashbackRounding('none');
    setUseSteppedCashback(false);
    setSteppedAmount('');
    setCapPeriodType('calendar_month');
    setStatementDay('1');
    setIsClosed(false);
    setClosedAt(null);
  };

  useEffect(() => {
    const routeParams = (route.params as any) || {};
    const incomingCardId = routeParams.cardId || null;
    let isMounted = true;

    const hydrate = async () => {
      setFormLoading(true);
      setCardId(incomingCardId);
      resetForm();

      if (!hasSupabaseEnv) {
        setFormLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        const userId = sessionData.session?.user.id;
        if (!userId) {
          throw new Error('Not authenticated');
        }

        const bankCardsPromise = supabase
          .from('bank_cards')
          .select('id,name,bank')
          .order('name', { ascending: true });

        const cardPromise = incomingCardId
          ? supabase
              .from('cards')
              .select('*')
              .eq('id', incomingCardId)
              .eq('user_id', userId)
              .single()
          : Promise.resolve({ data: null, error: null } as const);

        const [bankCardsResult, cardResult] = await Promise.all([bankCardsPromise, cardPromise]);

        if (!isMounted) return;

        if (bankCardsResult.error) {
          throw bankCardsResult.error;
        }

        setBankCards((bankCardsResult.data || []) as BankCardOption[]);

        if (cardResult.error) {
          throw cardResult.error;
        }

        if (cardResult.data) {
          const cardData = cardResult.data as any;
          setCardName(cardData.name || '');
          setCardNameMode(
            (bankCardsResult.data || []).some((bankCard) => bankCard.name === cardData.name)
              ? 'list'
              : 'custom',
          );
          setVariant((cardData.variant || 'Visa') as CardVariant);
          setRewardType((cardData.reward_type || 'cashback') as RewardType);
          setTotalLimit(cardData.total_limit !== null && cardData.total_limit !== undefined ? String(cardData.total_limit) : '');
          setCurrency(cardData.currency || 'INR');
          setMinTransactionAmount(String(cardData.min_transaction_amount ?? 0));
          setLast4Digits(cardData.last_4_digits ? String(cardData.last_4_digits) : '');
          setTransactionRounding((cardData.transaction_amount_rounding || 'none') as RoundingMethod);
          setCashbackRounding((cardData.cashback_amount_rounding || 'none') as RoundingMethod);
          setUseSteppedCashback(Boolean(cardData.use_stepped_cashback));
          setSteppedAmount(
            cardData.stepped_cashback_amount !== null && cardData.stepped_cashback_amount !== undefined
              ? String(cardData.stepped_cashback_amount)
              : '',
          );
          setCapPeriodType((cardData.cap_period_type || 'calendar_month') as CapPeriodType);
          setStatementDay(String(cardData.statement_day ?? 1));
          setIsClosed(Boolean(cardData.is_closed));
          setClosedAt(cardData.closed_at || null);
        }
      } catch (error) {
        console.error('Error loading card form:', error);
        if (isMounted) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load card form');
        }
      } finally {
        if (isMounted) {
          setFormLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [route.params]);

  const handleSaveCard = async () => {
    if (!cardName.trim()) {
      Alert.alert('Validation', 'Please enter a card name');
      return;
    }

    if (!variant.trim()) {
      Alert.alert('Validation', 'Please select a card network');
      return;
    }

    if (last4Digits && !/^\d{4}$/.test(last4Digits)) {
      Alert.alert('Validation', 'Last 4 digits must be exactly 4 numbers');
      return;
    }

    if (!statementDay || Number.isNaN(Number(statementDay)) || parseInt(statementDay, 10) < 1 || parseInt(statementDay, 10) > 28) {
      Alert.alert('Validation', 'Statement day must be between 1 and 28');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!hasSupabaseEnv) {
        throw new Error('Supabase configuration missing');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user.id) {
        throw new Error('Not authenticated');
      }

      const userId = sessionData.session.user.id;
      const payload = {
        name: cardName.trim(),
        variant,
        reward_type: rewardType,
        currency,
        total_limit: totalLimit ? parseFloat(totalLimit) : null,
        min_transaction_amount: parseFloat(minTransactionAmount) || 0,
        last_4_digits: last4Digits.trim() || null,
        transaction_amount_rounding: transactionRounding,
        cashback_amount_rounding: cashbackRounding,
        use_stepped_cashback: useSteppedCashback,
        stepped_cashback_amount: useSteppedCashback && steppedAmount ? parseFloat(steppedAmount) : null,
        cap_period_type: capPeriodType,
        statement_day: parseInt(statementDay, 10),
        is_closed: isClosed,
        closed_at: isClosed ? (closedAt || new Date().toISOString()) : null,
      };

      if (cardId) {
        const { error } = await supabase
          .from('cards')
          .update(payload)
          .eq('id', cardId)
          .eq('user_id', userId);

        if (error) {
          throw error;
        }

        Alert.alert('Success', 'Card updated successfully');
      } else {
        const { error } = await supabase.from('cards').insert([
          {
            user_id: userId,
            ...payload,
          },
        ]);

        if (error) {
          throw error;
        }

        Alert.alert('Success', 'Card added successfully');
      }

      (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
      navigation.goBack();
    } catch (error) {
      console.error('Error saving card:', error);
      Alert.alert('Error', cardId ? 'Failed to update card' : 'Failed to add card');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (formLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: appTheme.colors.background }}
      style={{ backgroundColor: appTheme.colors.background }}
    >
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant }}>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
          {cardId ? 'Edit Card' : 'Add New Card'}
        </Text>
        <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
          Configure the card details used by the cashback engine.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>
        {cardNameMode === 'custom' ? (
          <View>
            <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
              Card Name *
            </Text>
            <TextInput
              mode="outlined"
              placeholder="e.g., My Custom Card"
              value={cardName}
              onChangeText={setCardName}
              editable={!isSubmitting}
              style={{ backgroundColor: appTheme.colors.surface }}
            />
            <Button
              mode="text"
              compact
              onPress={() => setCardNameMode('list')}
              disabled={isSubmitting}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              Choose from list instead
            </Button>
          </View>
        ) : (
          <SearchableDropdown
            label="Card Name *"
            value={cardName}
            options={cardNameOptions}
            placeholder="Select a card..."
            onSelect={(value) => {
              setCardName(value);
              setCardNameMode('list');
            }}
            onCustomSelect={() => {
              setCardName('');
              setCardNameMode('custom');
            }}
            customLabel="Other (Custom card name)"
            disabled={isSubmitting}
          />
        )}

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Card Network *
          </Text>
          <CustomDropdown
            value={variant}
            options={CARD_VARIANTS.map((item) => ({ label: item, value: item }))}
            onSelect={(value) => setVariant(value as CardVariant)}
            placeholder="Select network"
            style={{ width: '100%' }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Reward Type *
          </Text>
          <CustomDropdown
            value={rewardType}
            options={REWARD_TYPES.map((item) => ({ label: item.label, value: item.value }))}
            onSelect={(value) => setRewardType(value as RewardType)}
            placeholder="Select reward type"
            style={{ width: '100%' }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Credit Limit
          </Text>
          <TextInput
            mode="outlined"
            placeholder="500000"
            value={totalLimit}
            onChangeText={setTotalLimit}
            keyboardType="numeric"
            editable={!isSubmitting}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Currency
          </Text>
          <CustomDropdown
            value={currency}
            options={CURRENCY_OPTIONS}
            onSelect={(value) => setCurrency(String(value))}
            placeholder="Select currency"
            style={{ width: '100%' }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Minimum Transaction Amount
          </Text>
          <TextInput
            mode="outlined"
            placeholder="0"
            value={minTransactionAmount}
            onChangeText={setMinTransactionAmount}
            keyboardType="numeric"
            editable={!isSubmitting}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
          <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
            Transactions below this amount earn no reward.
          </Text>
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Last 4 Digits of Card
          </Text>
          <TextInput
            mode="outlined"
            placeholder="1234"
            value={last4Digits}
            onChangeText={(value) => setLast4Digits(value.replace(/\D/g, '').slice(0, 4))}
            keyboardType="numeric"
            editable={!isSubmitting}
            maxLength={4}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
          <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
            Optional. Used to improve SMS card matching.
          </Text>
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Transaction Amount Rounding
          </Text>
          <CustomDropdown
            value={transactionRounding}
            options={ROUNDING_OPTIONS}
            onSelect={(value) => setTransactionRounding(value as RoundingMethod)}
            placeholder="Select rounding"
            style={{ width: '100%' }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Cashback Amount Rounding
          </Text>
          <CustomDropdown
            value={cashbackRounding}
            options={ROUNDING_OPTIONS}
            onSelect={(value) => setCashbackRounding(value as RoundingMethod)}
            placeholder="Select rounding"
            style={{ width: '100%' }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text variant="labelMedium" style={{ fontWeight: '600' }}>
              Use Stepped Reward Calculation
            </Text>
            <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 2 }}>
              Round spends down to a multiple before reward calculation.
            </Text>
          </View>
          <Checkbox
            status={useSteppedCashback ? 'checked' : 'unchecked'}
            onPress={() => setUseSteppedCashback(!useSteppedCashback)}
            color={appTheme.colors.primary}
          />
        </View>

        {useSteppedCashback && (
          <View>
            <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
              Step Amount
            </Text>
            <TextInput
              mode="outlined"
              placeholder="100"
              value={steppedAmount}
              onChangeText={setSteppedAmount}
              keyboardType="numeric"
              editable={!isSubmitting}
              style={{ backgroundColor: appTheme.colors.surface }}
            />
            <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
              Example: 100 means 450 is treated as 400 before cashback is calculated.
            </Text>
          </View>
        )}

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Cap Tracking Period
          </Text>
          <CustomDropdown
            value={capPeriodType}
            options={CAP_PERIOD_OPTIONS}
            onSelect={(value) => setCapPeriodType(value as CapPeriodType)}
            placeholder="Select cap period"
            style={{ width: '100%' }}
          />
          <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
            {capPeriodType === 'calendar_month'
              ? 'Caps reset on the first day of each calendar month.'
              : 'Caps reset based on the card statement cycle.'}
          </Text>
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Statement Cycle Start Day
          </Text>
          <TextInput
            mode="outlined"
            placeholder="15"
            value={statementDay}
            onChangeText={setStatementDay}
            keyboardType="numeric"
            editable={!isSubmitting}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
          <Text variant="bodySmall" style={{ color: appTheme.colors.onSurfaceVariant, marginTop: 4 }}>
            Enter a day from 1 to 28. Example: 15 means the cycle runs from the 15th to the 14th.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="labelMedium" style={{ fontWeight: '600' }}>
            Card Closed
          </Text>
          <Checkbox
            status={isClosed ? 'checked' : 'unchecked'}
            onPress={() => setIsClosed(!isClosed)}
            color={appTheme.colors.primary}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Button
            mode="outlined"
            style={{ flex: 1 }}
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            style={{ flex: 1 }}
            onPress={handleSaveCard}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {cardId ? 'Save Changes' : 'Add Card'}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
