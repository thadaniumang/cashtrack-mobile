import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface TransactionRowProps {
  title: string;
  subtitle: string;
  amount: number;
  cashback: number;
  date: string;
  transactionId: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function TransactionRow({
  title,
  subtitle,
  amount,
  cashback,
  date,
  transactionId,
  onPress,
  style,
}: TransactionRowProps) {
  const categoryColors: { [key: string]: string } = {
    food: '#FF6B6B',
    travel: '#4ECDC4',
    shopping: '#FFE66D',
    utilities: '#95E1D3',
    entertainment: '#C7CEEA',
    default: '#B0BEC5',
  };

  const safeSubtitle = typeof subtitle === 'string' ? subtitle : (subtitle ? String(subtitle) : '');
  const categoryKey = safeSubtitle.length > 0 ? safeSubtitle.toLowerCase() : 'default';
  const categoryColor = categoryColors[categoryKey] || categoryColors.default;

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          {
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          style,
        ]}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '500' }} numberOfLines={1}>
                {title}
              </Text>
              <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {subtitle}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          <Text
            variant="bodyMedium"
            style={{ fontWeight: '600', marginBottom: 2 }}
          >
            ₹{amount.toLocaleString()}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: '#2e7d32', fontWeight: '500' }}
          >
            +₹{cashback.toLocaleString()}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: '#999', marginTop: 2 }}
          >
            {date}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
