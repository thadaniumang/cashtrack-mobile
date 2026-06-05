import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface StatsCardProps {
  title: string;
  value: number;
  rewardType?: 'cashback' | 'miles';
  subtitle?: string;
  style?: ViewStyle;
}

export function StatsCard({ title, value, rewardType = 'cashback', subtitle, style }: StatsCardProps) {
  const theme = useTheme() as any;
  const textColor = rewardType === 'miles' ? theme.colors.rewardMilesText : theme.colors.rewardCashbackText;
  const accentColor = rewardType === 'miles' ? theme.colors.rewardMilesAccent : theme.colors.rewardCashbackAccent;

  const gradientBase = rewardType === 'miles' ? theme.colors.rewardMilesBg : theme.colors.rewardCashbackBg;
  const iconName = rewardType === 'miles' ? 'airplane-takeoff' : 'cash-multiple';

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const subtleStart = hexToRgba(gradientBase, 0.2);
  const subtleEnd = hexToRgba(gradientBase, 0.34);
  const valueLabel = rewardType === 'miles' && title.includes('Expected')
    ? value.toLocaleString()
    : `₹ ${value.toLocaleString()}`;

  return (
    <Card
      style={[
        {
          overflow: 'hidden',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: hexToRgba(accentColor, 0.3),
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[subtleStart, subtleEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 0 }}
      >
        <Card.Content style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text variant="titleSmall" style={{ color: textColor, fontWeight: '700', flex: 1 }} numberOfLines={2}>
              {title}
            </Text>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hexToRgba(accentColor, 0.16),
              }}
            >
              <MaterialCommunityIcons name={iconName} size={18} color={accentColor} />
            </View>
          </View>
          <Text
            variant="headlineSmall"
            style={{ color: accentColor, fontWeight: '800', marginBottom: subtitle ? 8 : 0 }}
          >
            {valueLabel}
          </Text>
          {subtitle && (
            <Text variant="bodySmall" style={{ color: textColor }}>
              {subtitle}
            </Text>
          )}
        </Card.Content>
      </LinearGradient>
    </Card>
  );
}
