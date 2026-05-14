import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, TextInput, Button, Card, Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function AddCardModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { appTheme } = useTheme();
  const [cardName, setCardName] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [variant, setVariant] = useState('');
  const [rewardType, setRewardType] = useState('cashback');
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);

  useEffect(() => {
    const routeParams = (route.params as any) || {};
    const incomingCardId = routeParams.cardId || null;

    setCardId(incomingCardId);

    if (!incomingCardId) {
      return;
    }

    const loadCard = async () => {
      if (!hasSupabaseEnv) {
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('id', incomingCardId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        alert(error?.message || 'Failed to load card');
        return;
      }

      setCardName(data.name || '');
      setLast4Digits(data.last_4_digits || '');
      setVariant(data.variant || '');
      setRewardType(data.reward_type || 'cashback');
      setIsClosed(Boolean(data.is_closed));
    };

    loadCard();
  }, [route.params]);

  const handleSaveCard = async () => {
    if (!cardName.trim()) {
      alert('Please enter a card name');
      return;
    }
    if (!variant.trim()) {
      alert('Please select or enter a card type');
      return;
    }

    setLoading(true);
    try {
      if (!hasSupabaseEnv) {
        alert('Supabase configuration missing');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user.id) {
        alert('Not authenticated');
        return;
      }

      const userId = sessionData.session.user.id;

      const cardPayload: any = {
        name: cardName.trim(),
        variant: variant.trim(),
        reward_type: rewardType,
        currency: 'INR',
        cap_period_type: 'calendar_month',
        is_closed: false,
      };

      if (last4Digits.trim()) {
        cardPayload.last_4_digits = last4Digits.trim();
      }

      if (cardId) {
        const { error } = await supabase
          .from('cards')
          .update({
            ...cardPayload,
            is_closed: isClosed,
          })
          .eq('id', cardId)
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating card:', error);
          alert(`Failed to update card: ${error.message}`);
          return;
        }

        alert('Card updated successfully');
      } else {
        const { error } = await supabase.from('cards').insert([
          {
            user_id: userId,
            ...cardPayload,
          },
        ]);

        if (error) {
          console.error('Error adding card:', error);
          alert(`Failed to add card: ${error.message}`);
          return;
        }

        alert('Card added successfully');
      }

      (navigation.getParent?.() as any)?.emit?.({ type: 'transactionChanged' });
      navigation.goBack();
    } catch (error) {
      console.error('Error adding card:', error);
      alert(cardId ? 'Failed to update card' : 'Failed to add card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: appTheme.colors.background }} style={{ backgroundColor: appTheme.colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: appTheme.colors.surfaceVariant }}>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
          {cardId ? 'Edit Card' : 'Add New Card'}
        </Text>
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Card Name *
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., HDFC Infinia"
            value={cardName}
            onChangeText={setCardName}
            editable={!loading}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Last 4 Digits (optional)
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., 5579"
            value={last4Digits}
            onChangeText={setLast4Digits}
            maxLength={4}
            keyboardType="numeric"
            editable={!loading}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Card Type (Visa, Mastercard, Amex, etc.) *
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., Visa"
            value={variant}
            onChangeText={setVariant}
            editable={!loading}
            style={{ backgroundColor: appTheme.colors.surface }}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 12, fontWeight: '600' }}>
            Reward Type *
          </Text>
          <Card
            style={{
              marginBottom: 8,
              backgroundColor: rewardType === 'cashback' ? '#4caf50' : appTheme.colors.surface,
              borderWidth: rewardType === 'cashback' ? 2 : 0,
              borderColor: rewardType === 'cashback' ? '#388e3c' : undefined,
            }}
            onPress={() => setRewardType('cashback')}
          >
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMedium" style={{ color: rewardType === 'cashback' ? '#fff' : appTheme.colors.onSurface, fontWeight: rewardType === 'cashback' ? '600' : '400' }}>
                Cashback
              </Text>
              <Checkbox
                status={rewardType === 'cashback' ? 'checked' : 'unchecked'}
                onPress={() => setRewardType('cashback')}
                color={rewardType === 'cashback' ? '#fff' : appTheme.colors.primary}
              />
            </Card.Content>
          </Card>
          <Card
            style={{
              backgroundColor: rewardType === 'miles' ? '#9c27b0' : appTheme.colors.surface,
              borderWidth: rewardType === 'miles' ? 2 : 0,
              borderColor: rewardType === 'miles' ? '#7b1fa2' : undefined,
            }}
            onPress={() => setRewardType('miles')}
          >
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMedium" style={{ color: rewardType === 'miles' ? '#fff' : appTheme.colors.onSurface, fontWeight: rewardType === 'miles' ? '600' : '400' }}>
                Miles/Points
              </Text>
              <Checkbox
                status={rewardType === 'miles' ? 'checked' : 'unchecked'}
                onPress={() => setRewardType('miles')}
                color={rewardType === 'miles' ? '#fff' : appTheme.colors.primary}
              />
            </Card.Content>
          </Card>
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

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
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
            onPress={handleSaveCard}
            loading={loading}
            disabled={loading}
          >
            {cardId ? 'Save Changes' : 'Add Card'}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
