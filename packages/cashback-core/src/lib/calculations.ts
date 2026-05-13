import {
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
} from 'date-fns';
import {
  CapConfig,
  Card,
  CardCategory,
  CashbackTiming,
  RewardType,
  RoundingMethod,
  Transaction,
} from '../types';
import { getCalendarMonthDates, getQuarterDates, getStatementMonthDates } from './capPeriods';

function applyRounding(value: number, method: RoundingMethod): number {
  switch (method) {
    case 'round':
      return Math.round(value);
    case 'ceil':
      return Math.ceil(value);
    case 'floor':
      return Math.floor(value);
    case 'none':
    default:
      return value;
  }
}

export function calculateValuebackAmounts(
  amount: number,
  category: CardCategory | null,
  override?: { instant?: number; currstmt?: number; nextstmt?: number } | number | null,
  card?: Card | null,
  transactionOverride?: {
    basePct?: number | null;
    acceleratedPct?: number | null;
    otherPct?: number | null;
  }
): {
  instant: number;
  currstmt: number;
  nextstmt: number;
  base: number;
  accelerated: number;
  other: number;
  total: number;
  baseTiming: CashbackTiming;
  acceleratedTiming: CashbackTiming;
  otherTiming: CashbackTiming;
} {
  if (card && card.min_transaction_amount > 0 && amount < card.min_transaction_amount) {
    return {
      instant: 0,
      currstmt: 0,
      nextstmt: 0,
      base: 0,
      accelerated: 0,
      other: 0,
      total: 0,
      baseTiming: 'current_statement',
      acceleratedTiming: 'next_statement',
      otherTiming: 'instant',
    };
  }

  let effectiveAmount = amount;
  if (card && card.transaction_amount_rounding !== 'none') {
    effectiveAmount = applyRounding(amount, card.transaction_amount_rounding);
  }

  if (card && card.use_stepped_cashback && card.stepped_cashback_amount && card.stepped_cashback_amount > 0) {
    effectiveAmount =
      Math.floor(effectiveAmount / card.stepped_cashback_amount) * card.stepped_cashback_amount;
  }

  let basePct = 0;
  let acceleratedPct = 0;
  let otherPct = 0;
  let baseTiming: CashbackTiming = 'current_statement';
  let acceleratedTiming: CashbackTiming = 'next_statement';
  let otherTiming: CashbackTiming = 'instant';

  if (transactionOverride) {
    if (transactionOverride.basePct !== undefined && transactionOverride.basePct !== null) {
      basePct = transactionOverride.basePct;
    }
    if (transactionOverride.acceleratedPct !== undefined && transactionOverride.acceleratedPct !== null) {
      acceleratedPct = transactionOverride.acceleratedPct;
    }
    if (transactionOverride.otherPct !== undefined && transactionOverride.otherPct !== null) {
      otherPct = transactionOverride.otherPct;
    }
    if (category) {
      baseTiming = category.base_cashback_timing;
      acceleratedTiming = category.accelerated_cashback_timing;
      otherTiming = category.other_cashback_timing;
    }
  } else if (typeof override === 'number') {
    basePct = override;
  } else if (override && typeof override === 'object') {
    basePct = override.currstmt ?? 0;
    acceleratedPct = override.nextstmt ?? 0;
    otherPct = override.instant ?? 0;
  } else if (category) {
    basePct = category.base_cashback_pct;
    acceleratedPct = category.accelerated_cashback_pct;
    otherPct = category.other_cashback_pct;
    baseTiming = category.base_cashback_timing;
    acceleratedTiming = category.accelerated_cashback_timing;
    otherTiming = category.other_cashback_timing;
  }

  let base = (effectiveAmount * basePct) / 100;
  let accelerated = (effectiveAmount * acceleratedPct) / 100;
  let other = (effectiveAmount * otherPct) / 100;

  if (card && card.cashback_amount_rounding !== 'none') {
    base = applyRounding(base, card.cashback_amount_rounding);
    accelerated = applyRounding(accelerated, card.cashback_amount_rounding);
    other = applyRounding(other, card.cashback_amount_rounding);
  } else {
    base = roundTo2(base);
    accelerated = roundTo2(accelerated);
    other = roundTo2(other);
  }

  let instant = 0;
  let currstmt = 0;
  let nextstmt = 0;

  if (baseTiming === 'instant') instant += base;
  else if (baseTiming === 'current_statement') currstmt += base;
  else nextstmt += base;

  if (acceleratedTiming === 'instant') instant += accelerated;
  else if (acceleratedTiming === 'current_statement') currstmt += accelerated;
  else nextstmt += accelerated;

  if (otherTiming === 'instant') instant += other;
  else if (otherTiming === 'current_statement') currstmt += other;
  else nextstmt += other;

  const total = roundTo2(base + accelerated + other);

  return {
    instant: roundTo2(instant),
    currstmt: roundTo2(currstmt),
    nextstmt: roundTo2(nextstmt),
    base,
    accelerated,
    other,
    total,
    baseTiming,
    acceleratedTiming,
    otherTiming,
  };
}

export function roundTo2(num: number): number {
  return Math.round(num * 100) / 100;
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${roundTo2(value)}%`;
}

export function getMonthRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM');
}

export function calculateCapUsage(
  transactions: Transaction[],
  categoryId: string,
  capAmount: number
): { used: number; remaining: number; percentage: number; isExceeded: boolean } {
  const used = transactions
    .filter((t) => t.category_id === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);

  const remaining = Math.max(0, capAmount - used);
  const percentage = capAmount > 0 ? Math.min(100, (used / capAmount) * 100) : 0;
  const isExceeded = used > capAmount;

  return { used, remaining, percentage, isExceeded };
}

export function getCardGradientClass(variant: string): string {
  switch (variant.toLowerCase()) {
    case 'visa':
      return 'card-visa';
    case 'mastercard':
      return 'card-mastercard';
    case 'diners':
      return 'card-diners';
    case 'rupay':
      return 'card-rupay';
    default:
      return 'card-other';
  }
}

export function getTotalValuebackPercentage(category: CardCategory): number {
  return category.base_cashback_pct + category.accelerated_cashback_pct + category.other_cashback_pct;
}

export function applyMultipleCaps(
  rawCashback: number,
  caps: CapConfig[],
  existingByCapType: { [capType: string]: number }
): number {
  if (!caps || caps.length === 0) {
    return rawCashback;
  }

  let finalAmount = rawCashback;

  for (const cap of caps) {
    if (cap.cap_type === 'none') continue;

    const existingForThisCap = existingByCapType[cap.cap_type] || 0;
    const remainingCapSpace = Math.max(0, cap.cap_amount - existingForThisCap);

    finalAmount = Math.min(finalAmount, remainingCapSpace);

    console.log(
      `[applyMultipleCaps] cap_type=${cap.cap_type}, cap_amount=${cap.cap_amount}, ` +
        `existing=${existingForThisCap}, remaining=${remainingCapSpace}, ` +
        `finalAmount=${finalAmount}`
    );
  }

  return Math.max(0, finalAmount);
}

export function getExistingCashbackByCapType(
  transactions: Transaction[],
  categoryId: string,
  currentDate: Date,
  card: Card,
  tier: 'base' | 'accelerated' | 'other'
): { [capType: string]: number } {
  const tierKey = `${tier}_cashback_amount` as keyof Transaction;

  const categoryTransactions = transactions.filter((t) => t.category_id === categoryId && t[tierKey]);

  const result = {
    daily: 0,
    monthly: 0,
    quarterly: 0,
    per_transaction: 0,
  };

  const dailyTxns = categoryTransactions.filter((t) => {
    const txnDate = parseISO(t.date);
    return isSameDay(txnDate, currentDate);
  });
  result.daily = roundTo2(
    dailyTxns.reduce((sum, t) => sum + (((t[tierKey] as number) || 0) as number), 0)
  );

  const monthlyDates =
    card.cap_period_type === 'statement_month'
      ? getStatementMonthDates(currentDate, card.statement_day || 1)
      : getCalendarMonthDates(currentDate);

  const monthlyStartDate = parseISO(monthlyDates.startDate);
  const monthlyEndDate = parseISO(monthlyDates.endDate);

  const monthlyTxns = categoryTransactions.filter((t) => {
    const txnDate = parseISO(t.date);
    return (
      (isAfter(txnDate, monthlyStartDate) || isSameDay(txnDate, monthlyStartDate)) &&
      (isBefore(txnDate, monthlyEndDate) || isSameDay(txnDate, monthlyEndDate))
    );
  });
  result.monthly = roundTo2(
    monthlyTxns.reduce((sum, t) => sum + (((t[tierKey] as number) || 0) as number), 0)
  );

  const quarterlyDates = getQuarterDates(currentDate);
  const quarterlyTxns = categoryTransactions.filter((t) => {
    const txnDate = parseISO(t.date);
    return (
      (isAfter(txnDate, quarterlyDates.start) || isSameDay(txnDate, quarterlyDates.start)) &&
      (isBefore(txnDate, quarterlyDates.end) || isSameDay(txnDate, quarterlyDates.end))
    );
  });
  result.quarterly = roundTo2(
    quarterlyTxns.reduce((sum, t) => sum + (((t[tierKey] as number) || 0) as number), 0)
  );

  result.per_transaction = 0;

  return result;
}

export function calculateValuebackWithCaps(
  amount: number,
  category: CardCategory | null,
  existingCashback: { base: number; accelerated: number; other: number },
  override?: { instant?: number; currstmt?: number; nextstmt?: number } | number | null,
  card?: Card | null,
  transactionOverride?: {
    basePct?: number | null;
    acceleratedPct?: number | null;
    otherPct?: number | null;
  },
  existingTransactions?: Transaction[],
  txnDate?: Date
): {
  instant: number;
  currstmt: number;
  nextstmt: number;
  base: number;
  accelerated: number;
  other: number;
  total: number;
  baseTiming: CashbackTiming;
  acceleratedTiming: CashbackTiming;
  otherTiming: CashbackTiming;
} {
  const rawCashback = calculateValuebackAmounts(amount, category, override, card, transactionOverride);

  if (!category) {
    return rawCashback;
  }

  let cappedBase = rawCashback.base;
  let cappedAccelerated = rawCashback.accelerated;
  let cappedOther = rawCashback.other;

  if (existingTransactions && txnDate && card) {
    const existingBaseByCapType = getExistingCashbackByCapType(
      existingTransactions,
      category.id,
      txnDate,
      card,
      'base'
    );

    cappedBase = applyMultipleCaps(rawCashback.base, category.base_cashback_caps, existingBaseByCapType);

    const existingAcceleratedByCapType = getExistingCashbackByCapType(
      existingTransactions,
      category.id,
      txnDate,
      card,
      'accelerated'
    );

    cappedAccelerated = applyMultipleCaps(
      rawCashback.accelerated,
      category.accelerated_cashback_caps,
      existingAcceleratedByCapType
    );

    const existingOtherByCapType = getExistingCashbackByCapType(
      existingTransactions,
      category.id,
      txnDate,
      card,
      'other'
    );

    cappedOther = applyMultipleCaps(rawCashback.other, category.other_cashback_caps, existingOtherByCapType);

    console.log(
      `[calculateValuebackWithCaps] Multi-cap logic applied: base=${cappedBase}, accelerated=${cappedAccelerated}, other=${cappedOther}`
    );
  } else {
    if (category.base_cap_amount && category.base_cap_amount > 0 && category.base_cap_type !== 'per_transaction') {
      const remainingBaseCap = Math.max(0, category.base_cap_amount - existingCashback.base);
      cappedBase = Math.min(rawCashback.base, remainingBaseCap);
      console.log(
        `[calculateValuebackWithCaps] Base cashback (legacy): raw=${rawCashback.base}, existing=${existingCashback.base}, cap=${category.base_cap_amount}, remaining=${remainingBaseCap}, capped=${cappedBase}`
      );
    }

    if (
      category.accelerated_cap_amount &&
      category.accelerated_cap_amount > 0 &&
      category.accelerated_cap_type !== 'per_transaction'
    ) {
      const remainingAcceleratedCap = Math.max(
        0,
        category.accelerated_cap_amount - existingCashback.accelerated
      );
      cappedAccelerated = Math.min(rawCashback.accelerated, remainingAcceleratedCap);
      console.log(
        `[calculateValuebackWithCaps] Accelerated cashback (legacy): raw=${rawCashback.accelerated}, existing=${existingCashback.accelerated}, cap=${category.accelerated_cap_amount}, remaining=${remainingAcceleratedCap}, capped=${cappedAccelerated}`
      );
    }

    if (category.other_cap_amount && category.other_cap_amount > 0 && category.other_cap_type !== 'per_transaction') {
      const remainingOtherCap = Math.max(0, category.other_cap_amount - existingCashback.other);
      cappedOther = Math.min(rawCashback.other, remainingOtherCap);
      console.log(
        `[calculateValuebackWithCaps] Other cashback (legacy): raw=${rawCashback.other}, existing=${existingCashback.other}, cap=${category.other_cap_amount}, remaining=${remainingOtherCap}, capped=${cappedOther}`
      );
    }
  }

  let instant = 0;
  let currstmt = 0;
  let nextstmt = 0;

  if (rawCashback.baseTiming === 'instant') instant += cappedBase;
  else if (rawCashback.baseTiming === 'current_statement') currstmt += cappedBase;
  else nextstmt += cappedBase;

  if (rawCashback.acceleratedTiming === 'instant') instant += cappedAccelerated;
  else if (rawCashback.acceleratedTiming === 'current_statement') currstmt += cappedAccelerated;
  else nextstmt += cappedAccelerated;

  if (rawCashback.otherTiming === 'instant') instant += cappedOther;
  else if (rawCashback.otherTiming === 'current_statement') currstmt += cappedOther;
  else nextstmt += cappedOther;

  const total = roundTo2(cappedBase + cappedAccelerated + cappedOther);

  return {
    instant: roundTo2(instant),
    currstmt: roundTo2(currstmt),
    nextstmt: roundTo2(nextstmt),
    base: cappedBase,
    accelerated: cappedAccelerated,
    other: cappedOther,
    total,
    baseTiming: rawCashback.baseTiming,
    acceleratedTiming: rawCashback.acceleratedTiming,
    otherTiming: rawCashback.otherTiming,
  };
}

export function getRewardLabel(rewardType: RewardType = 'cashback'): {
  singular: string;
  plural: string;
  verb: string;
} {
  if (rewardType === 'miles') {
    return {
      singular: 'Mile',
      plural: 'Miles',
      verb: 'earned',
    };
  }
  return {
    singular: 'Cashback',
    plural: 'Cashback',
    verb: 'earned',
  };
}

export function formatRewardAmount(
  amount: number,
  rewardType: RewardType = 'cashback',
  currency = 'INR'
): string {
  if (rewardType === 'miles') {
    return `${roundTo2(amount)} miles`;
  }
  return formatCurrency(amount, currency);
}
