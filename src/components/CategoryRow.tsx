import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ProgressBar, TouchableRipple, useTheme, Chip, Surface } from 'react-native-paper';
import type { CardCategory, CapConfig, CapType, CapPeriodType } from '../lib/cashbackCore';

type Props = {
  category: CardCategory;
  baseCashbackUsed?: number | null;
  acceleratedCashbackUsed?: number | null;
  otherCashbackUsed?: number | null;
  currency?: string;
  onPress?: () => void;
  cardCapPeriodType?: CapPeriodType;
  cardStatementDay?: number | null;
};

function resolveCaps(category: CardCategory, tier: 'base' | 'accelerated' | 'other'): CapConfig[] {
  const arrayCaps = tier === 'base' ? category.base_cashback_caps : tier === 'accelerated' ? category.accelerated_cashback_caps : category.other_cashback_caps;
  if (Array.isArray(arrayCaps) && arrayCaps.length > 0) {
    return arrayCaps.filter((cap) => cap.cap_type !== 'none' && cap.cap_amount > 0);
  }

  const legacyType = tier === 'accelerated' ? category.accelerated_cap_type : tier === 'other' ? category.other_cap_type : category.cap_type;
  const legacyAmount = tier === 'accelerated' ? category.accelerated_cap_amount : tier === 'other' ? category.other_cap_amount : category.cap_amount;

  if (!legacyType || legacyType === 'none' || !legacyAmount || legacyAmount <= 0) {
    return [];
  }

  return [{ cap_type: legacyType, cap_amount: legacyAmount }];
}

function formatCapType(capType: CapType, cardCapPeriodType?: CapPeriodType, cardStatementDay?: number | null) {
  if (capType === 'monthly') {
    if (cardCapPeriodType === 'statement_month') {
      return `statement month${cardStatementDay ? ` (${cardStatementDay}th)` : ''} cap`;
    }
    return 'monthly cap';
  }
  if (capType === 'per_transaction') return 'per transaction';
  return `${capType} cap`;
}

function formatCapTypeSummary(capType: CapType, cardCapPeriodType?: CapPeriodType): string {
  if (capType === 'monthly') {
    return cardCapPeriodType === 'statement_month' ? 'statement month' : 'monthly';
  }
  if (capType === 'per_transaction') return 'per transaction';
  return capType;
}

function getProgressColor(progress: number, theme: any): string {
  if (progress > 1) return theme.colors.error; // Exceeded: red
  if (progress >= 0.8) return theme.colors.warning; // Near limit: orange
  return theme.colors.primary; // Normal: green
}

export default function CategoryRow({ 
  category, 
  baseCashbackUsed = 0, 
  acceleratedCashbackUsed = 0, 
  otherCashbackUsed = 0,
  currency = '₹', 
  onPress,
  cardCapPeriodType = 'calendar_month',
  cardStatementDay = null,
}: Props) {
  const theme = useTheme();
  const baseCashback = baseCashbackUsed ?? 0;
  const acceleratedCashback = acceleratedCashbackUsed ?? 0;
  const otherCashback = otherCashbackUsed ?? 0;

  const baseCaps = useMemo(() => resolveCaps(category, 'base'), [category]);
  const acceleratedCaps = useMemo(() => resolveCaps(category, 'accelerated'), [category]);
  const otherCaps = useMemo(() => resolveCaps(category, 'other'), [category]);

  const firstCap = baseCaps[0] || acceleratedCaps[0] || otherCaps[0];

  return (
    <TouchableRipple onPress={onPress}>
      <Surface style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.left}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>{category.name}</Text>
          {firstCap && (
            <View style={{ marginBottom: 4 }}>
              <Chip compact mode="outlined" style={{ height: 32, borderColor: theme.colors.outline, backgroundColor: theme.colors.surfaceVariant, alignSelf: 'flex-start' }}>
                {formatCapTypeSummary(firstCap.cap_type, cardCapPeriodType)}
              </Chip>
            </View>
          )}

          {baseCaps.map((cap, index) => {
            const progress = baseCashback / cap.cap_amount;
            const progressColor = getProgressColor(progress, theme);
            const remaining = Math.max(0, cap.cap_amount - baseCashback);

            // Do not show progress bars for daily or per_transaction caps
            if (cap.cap_type === 'daily' || cap.cap_type === 'per_transaction') {
              return (
                <View key={`base-${index}`} style={{ marginTop: 12 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Base: {currency}{cap.cap_amount.toLocaleString()} ({formatCapType(cap.cap_type, cardCapPeriodType, cardStatementDay)})
                  </Text>
                </View>
              );
            }

            return (
              <View style={[styles.progressWrap, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12 }]} key={`base-${index}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Base: {currency}{cap.cap_amount.toLocaleString()}
                  </Text>
                  <Text variant="labelSmall" style={{ fontWeight: '600', color: progress > 1 ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                    {currency}{baseCashback.toLocaleString()} / {currency}{cap.cap_amount.toLocaleString()}
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.colors.outlineVariant, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.outline }}>
                  <ProgressBar progress={Math.min(progress, 1)} color={progressColor} style={styles.progress} />
                </View>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10, textAlign: 'right' }}>
                  {currency}{remaining.toLocaleString()} left
                </Text>
              </View>
            );
          })}

          {acceleratedCaps.map((cap, index) => {
            const progress = acceleratedCashback / cap.cap_amount;
            const progressColor = getProgressColor(progress, theme);
            const remaining = Math.max(0, cap.cap_amount - acceleratedCashback);

            if (cap.cap_type === 'daily' || cap.cap_type === 'per_transaction') {
              return (
                <View key={`accelerated-${index}`} style={{ marginTop: 12 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Accelerated: {currency}{cap.cap_amount.toLocaleString()} ({formatCapType(cap.cap_type, cardCapPeriodType, cardStatementDay)})
                  </Text>
                </View>
              );
            }

            return (
              <View style={[styles.progressWrap, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12 }]} key={`accelerated-${index}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Accelerated: {currency}{cap.cap_amount.toLocaleString()}
                  </Text>
                  <Text variant="labelSmall" style={{ fontWeight: '600', color: progress > 1 ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                    {currency}{acceleratedCashback.toLocaleString()} / {currency}{cap.cap_amount.toLocaleString()}
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.colors.outlineVariant, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.outline }}>
                  <ProgressBar progress={Math.min(progress, 1)} color={progressColor} style={styles.progress} />
                </View>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10, textAlign: 'right' }}>
                  {currency}{remaining.toLocaleString()} left
                </Text>
              </View>
            );
          })}

          {otherCaps.map((cap, index) => {
            const progress = otherCashback / cap.cap_amount;
            const progressColor = getProgressColor(progress, theme);
            const remaining = Math.max(0, cap.cap_amount - otherCashback);

            if (cap.cap_type === 'daily' || cap.cap_type === 'per_transaction') {
              return (
                <View key={`other-${index}`} style={{ marginTop: 12 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Other: {currency}{cap.cap_amount.toLocaleString()} ({formatCapType(cap.cap_type, cardCapPeriodType, cardStatementDay)})
                  </Text>
                </View>
              );
            }

            return (
              <View style={[styles.progressWrap, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 10, padding: 12 }]} key={`other-${index}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Other: {currency}{cap.cap_amount.toLocaleString()}
                  </Text>
                  <Text variant="labelSmall" style={{ fontWeight: '600', color: progress > 1 ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                    {currency}{otherCashback.toLocaleString()} / {currency}{cap.cap_amount.toLocaleString()}
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.colors.outlineVariant, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.outline }}>
                  <ProgressBar progress={Math.min(progress, 1)} color={progressColor} style={styles.progress} />
                </View>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10, textAlign: 'right' }}>
                  {currency}{remaining.toLocaleString()} left
                </Text>
              </View>
            );
          })}
        </View>
      </Surface>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
  },
  muted: {
    marginTop: 4,
  },
  progressWrap: {
    marginTop: 16,
    width: '100%',
    justifyContent: 'center'
  },
  progress: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  }
});
