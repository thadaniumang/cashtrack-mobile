import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

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
  const categoryColors: { [key: string]: string } = {
    food: theme.colors.categoryFood,
    travel: theme.colors.categoryTravel,
    shopping: theme.colors.categoryShopping,
    utilities: theme.colors.categoryUtilities,
    entertainment: theme.colors.categoryEntertainment,
    default: theme.colors.categoryDefault,
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
            borderBottomColor: theme.colors.outlineVariant,
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: categoryColor }} />
                <Text variant="bodyMedium" style={{ fontWeight: '500', color: theme.colors.onSurface }} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {subtitle}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          <Text
            variant="bodyMedium"
            style={{ fontWeight: '600', marginBottom: 2, color: theme.colors.onSurface }}
          >
            ₹{amount.toLocaleString()}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.success, fontWeight: '500' }}
          >
            +₹{cashback.toLocaleString()}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
          >
            {date}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
