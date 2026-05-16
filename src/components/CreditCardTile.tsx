import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

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

const getCardGradient = (variant?: string, theme?: any) => {
  switch (variant?.toLowerCase()) {
    case 'visa':
      return { bg: theme.colors.cardVisaBg, accent: theme.colors.cardVisaAccent };
    case 'mastercard':
      return { bg: theme.colors.cardMastercardBg, accent: theme.colors.cardMastercardAccent };
    case 'amex':
    case 'american express':
      return { bg: theme.colors.cardAmexBg, accent: theme.colors.cardAmexAccent };
    case 'rupay':
      return { bg: theme.colors.cardRupayBg, accent: theme.colors.cardRupayAccent };
    default:
      return { bg: theme.colors.cardDefaultBg, accent: theme.colors.cardDefaultAccent };
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
  const theme = useTheme();
  const normalizedBrand = cardBrand || 'Other';
  const gradient = getCardGradient(cardBrand, theme);
  const rewardLabel = rewardType === 'miles' ? 'Miles' : 'Cashback';
  const rewardValue = rewardType === 'miles' ? cashback.toLocaleString() : `₹${cashback.toLocaleString()}`;

  return (
    <Pressable onPress={onPress}>
      <Card style={[{ backgroundColor: gradient.bg, opacity: isActive ? 1 : 0.5 }, style]}>
        <Card.Content style={{ paddingVertical: 16, paddingHorizontal: 24 }}>
          <View style={{ marginBottom: 32 }}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 2 }}
            >
              {normalizedBrand.toUpperCase()}
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
            >
              {cardName}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <View>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
              >
                Expected {rewardLabel}
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
              >
                {rewardValue}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
              >
                Spends
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
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
