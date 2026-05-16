import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

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
      return { start: theme.colors.cardVisaBg, end: theme.colors.primary, accent: theme.colors.cardVisaAccent };
    case 'mastercard':
      return { start: theme.colors.cardMastercardBg, end: theme.colors.secondary, accent: theme.colors.cardMastercardAccent };
    case 'amex':
    case 'american express':
      return { start: theme.colors.cardAmexBg, end: theme.colors.tertiary, accent: theme.colors.cardAmexAccent };
    case 'rupay':
      return { start: theme.colors.cardRupayBg, end: theme.colors.primary, accent: theme.colors.cardRupayAccent };
    default:
      return { start: theme.colors.cardDefaultBg, end: theme.colors.surface, accent: theme.colors.cardDefaultAccent };
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
  const theme = useTheme() as any;
  const normalizedBrand = cardBrand || 'Other';
  const gradient = getCardGradient(cardBrand, theme);
  const rewardLabel = rewardType === 'miles' ? 'Miles' : 'Cashback';
  const rewardValue = rewardType === 'miles' ? cashback.toLocaleString() : `₹${cashback.toLocaleString()}`;

  return (
    <Pressable onPress={onPress}>
      <Card style={[{ overflow: 'hidden', opacity: isActive ? 1 : 0.5 }, style]}>
        <LinearGradient
          colors={[hexToRgba(gradient.start, 0.10), hexToRgba(gradient.end, 0.18)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 0 }}
        >
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
        </LinearGradient>
      </Card>
    </Pressable>
  );
}
