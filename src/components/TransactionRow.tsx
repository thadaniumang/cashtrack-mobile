import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Text, useTheme, TouchableRipple, Surface } from 'react-native-paper';

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
  const theme = useTheme();

  const safeSubtitle = typeof subtitle === 'string' ? subtitle : (subtitle ? String(subtitle) : '');
  const categoryKey = safeSubtitle.length > 0 ? safeSubtitle.toLowerCase() : 'default';

  return (
    <TouchableRipple onPress={onPress}>
      <Surface style={[{ marginHorizontal: 8, marginVertical: 6, borderRadius: 12, padding: 12, backgroundColor: theme.colors.surface }, style] as ViewStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '500', color: theme.colors.onSurface }} numberOfLines={1}>
                  {title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text variant="bodyMedium" style={{ fontWeight: '600', marginBottom: 2, color: theme.colors.onSurface }}>
              ₹{amount.toLocaleString()}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.success, fontWeight: '500' }}>+₹{cashback.toLocaleString()}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>{date}</Text>
          </View>
        </View>
      </Surface>
    </TouchableRipple>
  );
}
