import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

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
  
  // Gradient colors based on reward type (use subtle tints)
  const gradientBase = rewardType === 'miles' ? theme.colors.rewardMilesBg : theme.colors.rewardCashbackBg;
  const gradientAccent = rewardType === 'miles' ? theme.colors.secondary : theme.colors.primary;

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const subtleStart = hexToRgba(gradientBase, 0.1);
  const subtleEnd = hexToRgba(gradientBase, 0.18);

  return (
    <Card style={[{ overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={[subtleStart, subtleEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 0 }}
      >
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
      </LinearGradient>
    </Card>
  );
}
