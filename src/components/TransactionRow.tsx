import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Text, useTheme, TouchableRipple, Surface } from 'react-native-paper';
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
            marginVertical: 5,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
          },
          style,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
                backgroundColor: theme.colors.primaryContainer,
              }}
            >
              <MaterialCommunityIcons name="script-text-outline" size={18} color={theme.colors.onPrimaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
                {title}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
            <Text variant="titleSmall" style={{ fontWeight: '800', marginBottom: 2, color: theme.colors.onSurface }}>
              ₹{amount.toLocaleString()}
            </Text>
            <View style={{ backgroundColor: theme.colors.successContainer, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSuccessContainer, fontWeight: '700' }}>
                +₹{cashback.toLocaleString()}
              </Text>
            </View>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>{date}</Text>
          </View>
        </View>
      </Surface>
    </TouchableRipple>
  );
}
