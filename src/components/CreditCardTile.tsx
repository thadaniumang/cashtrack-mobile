import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

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
      return { start: theme.colors.cardVisaBg, end: theme.colors.cardVisaAccent, accent: theme.colors.cardVisaAccent };
    case 'mastercard':
      return { start: theme.colors.cardMastercardBg, end: theme.colors.cardMastercardAccent, accent: theme.colors.cardMastercardAccent };
    case 'amex':
    case 'american express':
      return { start: theme.colors.cardAmexBg, end: theme.colors.cardAmexAccent, accent: theme.colors.cardAmexAccent };
    case 'rupay':
      return { start: theme.colors.cardRupayBg, end: theme.colors.cardRupayAccent, accent: theme.colors.cardRupayAccent };
    default:
      return { start: theme.colors.cardDefaultBg, end: theme.colors.cardDefaultAccent, accent: theme.colors.cardDefaultAccent };
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
  const accentColor = rewardType === 'miles' ? theme.colors.rewardMilesAccent : theme.colors.rewardCashbackAccent;

  return (
    <Pressable onPress={onPress}>
      <Card
        style={[
          {
            overflow: 'hidden',
            opacity: isActive ? 1 : 0.58,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: hexToRgba(gradient.accent, 0.28),
            elevation: 6,
            shadowColor: (theme as any).colors?.shadow || 'rgba(0,0,0,0.08)',
            shadowOpacity: 0.14,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
          },
          style,
        ]}
      >
        <LinearGradient
          colors={[gradient.start, gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 0 }}
        >
          <Card.Content style={{ paddingVertical: 18, paddingHorizontal: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.cardText, marginBottom: 4, letterSpacing: 0.8, fontWeight: '700' }}
                >
                  {normalizedBrand.toUpperCase()}
                </Text>
                <Text
                  variant="titleLarge"
                  style={{ color: theme.colors.cardText, fontWeight: '800' }}
                  numberOfLines={1}
                >
                  {cardName}
                </Text>
              </View>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hexToRgba(gradient.accent, 0.2),
                }}
              >
                <MaterialCommunityIcons name={rewardType === 'miles' ? 'airplane' : 'wallet'} size={19} color={accentColor} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
              <View style={{ flex: 1, borderRadius: 14, paddingVertical: 10 }}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.cardText, marginBottom: 4, fontWeight: '600' }}
                >
                  Expected
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.cardText, fontWeight: '800' }}
                >
                  {rewardValue}
                </Text>
              </View>

              <View style={{ flex: 1, borderRadius: 14, paddingVertical: 10 }}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.cardText, marginBottom: 4, fontWeight: '600' }}
                >
                  Spends
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.cardText, fontWeight: '800' }}
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
