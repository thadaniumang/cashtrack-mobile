import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Text, useTheme, TouchableRipple, Surface } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
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
  const theme = useTheme() as any;

  return (
    <TouchableRipple onPress={onPress} borderless={false} style={{ borderRadius: 16 }}>
      <Surface
        style={[
          {
            marginVertical: 6,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 14,
            backgroundColor: theme.colors.surface,
            borderWidth: 0,
            elevation: 2,
            shadowColor: theme.colors.shadow,
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          },
          style,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.onSurface }} numberOfLines={1}>
                {title}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
            <Text variant="titleMedium" style={{ fontWeight: '900', marginBottom: 6, color: theme.colors.onSurface }}>
              ₹{amount.toLocaleString()}
            </Text>
            <View style={{ backgroundColor: theme.colors.successContainer, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSuccessContainer, fontWeight: '800' }}>
                +₹{cashback.toLocaleString()}
              </Text>
            </View>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>{date}</Text>
          </View>
        </View>
      </Surface>
    </TouchableRipple>
  );
}
