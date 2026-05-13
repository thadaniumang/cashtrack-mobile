import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import { Card, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface CreditCardTileProps {
  cardName: string;
  cardBrand?: string;
  cashback: number;
  spends: number;
  rewardType?: 'cashback' | 'miles';
  isActive: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const getCardGradient = (variant?: string) => {
  switch (variant?.toLowerCase()) {
    case 'visa':
      return { bg: '#1a1f71', accent: '#1434CB' };
    case 'mastercard':
      return { bg: '#eb001b', accent: '#ff5f00' };
    case 'amex':
    case 'american express':
      return { bg: '#006fcf', accent: '#00a8e1' };
    case 'rupay':
      return { bg: '#ff6b6b', accent: '#ff8c8c' };
    default:
      return { bg: '#333333', accent: '#666666' };
  }
};

export function CreditCardTile({
  cardName,
  cardBrand,
  cashback,
  spends,
  rewardType = 'cashback',
  isActive,
  onPress,
  style,
}: CreditCardTileProps) {
  const normalizedBrand = cardBrand || 'Other';
  const gradient = getCardGradient(cardBrand);
  const rewardLabel = rewardType === 'miles' ? 'Miles' : 'Cashback';
  const rewardValue = rewardType === 'miles' ? cashback.toLocaleString() : `₹${cashback.toLocaleString()}`;

  return (
    <Pressable onPress={onPress}>
      <Card style={[{ backgroundColor: gradient.bg, opacity: isActive ? 1 : 0.5 }, style]}>
        <Card.Content style={{ paddingVertical: 16, paddingHorizontal: 24 }}>
          <View style={{ marginBottom: 32 }}>
            <Text
              variant="bodyMedium"
              style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}
            >
              {normalizedBrand.toUpperCase()}
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: 'white', fontWeight: 'bold' }}
            >
              {cardName}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <View>
              <Text
                variant="labelLarge"
                style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}
              >
                Expected {rewardLabel}
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: 'white', fontWeight: 'bold' }}
              >
                {rewardValue}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                variant="labelLarge"
                style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}
              >
                Spends
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: 'white', fontWeight: 'bold' }}
              >
                ₹{spends.toLocaleString()}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
}
