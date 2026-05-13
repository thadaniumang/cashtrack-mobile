import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, TextInput, Button, Card, Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function AddCardModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('');
  const [variant, setVariant] = useState('');
  const [rewardType, setRewardType] = useState('cashback');
  const [loading, setLoading] = useState(false);

  const handleAddCard = async () => {
    if (!cardName.trim() || !bankName.trim()) {
      alert('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      // TODO: Add card to database
      alert('Card added successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding card:', error);
      alert('Failed to add card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
          Add New Card
        </Text>
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Card Name
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., My Visa Card"
            value={cardName}
            onChangeText={setCardName}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Bank Name
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., HDFC Bank"
            value={bankName}
            onChangeText={setBankName}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
            Card Type
          </Text>
          <TextInput
            mode="outlined"
            placeholder="e.g., Visa, Mastercard"
            value={variant}
            onChangeText={setVariant}
          />
        </View>

        <View>
          <Text variant="labelMedium" style={{ marginBottom: 12, fontWeight: '600' }}>
            Reward Type
          </Text>
          <Card
            style={{ marginBottom: 8, backgroundColor: rewardType === 'cashback' ? '#efe' : '#fff' }}
            onPress={() => setRewardType('cashback')}
          >
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMedium">Cashback</Text>
              <Checkbox
                status={rewardType === 'cashback' ? 'checked' : 'unchecked'}
                onPress={() => setRewardType('cashback')}
              />
            </Card.Content>
          </Card>
          <Card
            style={{ backgroundColor: rewardType === 'miles' ? '#f3e5f5' : '#fff' }}
            onPress={() => setRewardType('miles')}
          >
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMedium">Miles/Points</Text>
              <Checkbox
                status={rewardType === 'miles' ? 'checked' : 'unchecked'}
                onPress={() => setRewardType('miles')}
              />
            </Card.Content>
          </Card>
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
            onPress={handleAddCard}
            loading={loading}
            disabled={loading}
          >
            Add Card
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
