import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

interface StatsCardProps {
  title: string;
  value: number;
  rewardType?: 'cashback' | 'miles';
  subtitle?: string;
  style?: ViewStyle;
}

export function StatsCard({ title, value, rewardType = 'cashback', subtitle, style }: StatsCardProps) {
  const theme = useTheme();
  const bgColor = rewardType === 'miles' ? theme.colors.rewardMilesBg : theme.colors.rewardCashbackBg;
  const textColor = rewardType === 'miles' ? theme.colors.rewardMilesText : theme.colors.rewardCashbackText;
  const accentColor = rewardType === 'miles' ? theme.colors.rewardMilesAccent : theme.colors.rewardCashbackAccent;

  return (
    <Card style={[{ backgroundColor: bgColor }, style]}>
      <Card.Content style={{ paddingVertical: 16 }}>
        <Text variant="bodyMedium" style={{ color: textColor, marginBottom: 8 }}>
          {title}
        </Text>
        <Text
          variant="bodyLarge"
          style={{ color: accentColor, fontWeight: 'bold', marginBottom: subtitle ? 8 : 0 }}
        >
          {rewardType === 'miles' && title.includes('Expected') ? `${value.toLocaleString()}` : `₹ ${value.toLocaleString()}`}
        </Text>
        {subtitle && (
          <Text variant="bodyMedium" style={{ color: textColor }}>
            {subtitle}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}
