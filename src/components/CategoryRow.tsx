import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ProgressBar, TouchableRipple, useTheme } from 'react-native-paper';
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

  return (
    <TouchableRipple onPress={onPress}>
      <View style={styles.container}>
        <View style={styles.left}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
            <Text variant="titleMedium">{category.name}</Text>
          </View>

          {baseCaps.map((cap, index) => {
            const progress = baseCashback / cap.cap_amount;
            const progressColor = getProgressColor(progress, theme);
            const remaining = Math.max(0, cap.cap_amount - baseCashback);
            return (
              <View style={styles.progressWrap} key={`base-${index}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text variant="bodySmall" style={styles.muted}>
                    Base: {currency}{cap.cap_amount.toLocaleString()} ({formatCapTypeSummary(cap.cap_type, cardCapPeriodType)})
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {currency}{remaining.toLocaleString()} left
                  </Text>
                </View>
                <ProgressBar progress={Math.min(progress, 1)} color={progressColor} style={styles.progress} />
              </View>
            );
          })}

          {acceleratedCaps.map((cap, index) => {
            const progress = acceleratedCashback / cap.cap_amount;
            const progressColor = getProgressColor(progress, theme);
            const remaining = Math.max(0, cap.cap_amount - acceleratedCashback);
            return (
              <View style={styles.progressWrap} key={`accelerated-${index}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text variant="bodySmall" style={styles.muted}>
                    Accelerated: {currency}{cap.cap_amount.toLocaleString()} ({formatCapTypeSummary(cap.cap_type, cardCapPeriodType)})
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {currency}{remaining.toLocaleString()} left
                  </Text>
                </View>
                <ProgressBar progress={Math.min(progress, 1)} color={progressColor} style={styles.progress} />
              </View>
            );
          })}

          {otherCaps.map((cap, index) => {
            const progress = otherCashback / cap.cap_amount;
            const progressColor = getProgressColor(progress, theme);
            const remaining = Math.max(0, cap.cap_amount - otherCashback);
            return (
              <View style={styles.progressWrap} key={`other-${index}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text variant="bodySmall" style={styles.muted}>
                    Other: {currency}{cap.cap_amount.toLocaleString()} ({formatCapTypeSummary(cap.cap_type, cardCapPeriodType)})
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {currency}{remaining.toLocaleString()} left
                  </Text>
                </View>
                <ProgressBar progress={Math.min(progress, 1)} color={progressColor} style={styles.progress} />
              </View>
            );
          })}
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  left: {
    flex: 1,
  },
  muted: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)'
  },
  progressWrap: {
    marginTop: 12,
    width: '100%',
    justifyContent: 'center'
  },
  progress: {
    height: 8,
    borderRadius: 4,
  }
});
