export type CardVariant = 'Visa' | 'Mastercard' | 'Diners' | 'RuPay' | 'Other';
export type CapType = 'monthly' | 'daily' | 'quarterly' | 'per_transaction' | 'none';
export type CapPeriodType = 'calendar_month' | 'statement_month';
export type CashbackTiming = 'instant' | 'current_statement' | 'next_statement';
export type RoundingMethod = 'none' | 'round' | 'ceil' | 'floor';
export type RewardType = 'cashback' | 'miles';

/**
 * Represents a single cap configuration for a cashback tier.
 * Allows specifying multiple simultaneous caps (e.g., per-transaction AND daily AND monthly).
 */
export interface CapConfig {
  cap_type: CapType;
  cap_amount: number;
}

export interface Card {
  id: string;
  user_id: string;
  name: string;
  total_limit: number | null;
  variant: CardVariant;
  currency: string;
  reward_type: RewardType;
  min_transaction_amount: number;
  transaction_amount_rounding: RoundingMethod;
  cashback_amount_rounding: RoundingMethod;
  use_stepped_cashback: boolean;
  stepped_cashback_amount: number | null;
  cap_period_type: CapPeriodType;
  statement_day: number | null;
  is_closed: boolean;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardCategory {
  id: string;
  card_id: string;
  name: string;

  // DEPRECATED: Use base_cashback_caps array instead
  cap_amount: number | null;
  cap_type: CapType;

  // New multi-cap arrays (Phase 1)
  base_cashback_caps: CapConfig[];
  base_cashback_pct: number;
  base_cashback_timing: CashbackTiming;

  // DEPRECATED: Use base_cashback_caps array instead
  base_cap_amount: number | null;
  base_cap_type: CapType;

  // DEPRECATED: Use accelerated_cashback_caps array instead
  accelerated_cap_amount: number | null;
  accelerated_cap_type: CapType;

  accelerated_cashback_caps: CapConfig[];
  accelerated_cashback_pct: number;
  accelerated_cashback_timing: CashbackTiming;

  // DEPRECATED: Use other_cashback_caps array instead
  other_cap_amount: number | null;
  other_cap_type: CapType;

  other_cashback_caps: CapConfig[];
  other_cashback_pct: number;
  other_cashback_timing: CashbackTiming;

  caps_modified_at: string;
  created_at: string;
  updated_at: string;
}

export type TransactionSourceType = 'manual' | 'system_sms' | 'system_import';
export type TransactionValidationStatus = 'pending' | 'validated' | 'rejected';

export interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  category_id: string | null;
  amount: number;
  actual_amount: number;
  currency: string;
  date: string;
  base_cashback_amount: number;
  base_cashback_timing: CashbackTiming;
  accelerated_cashback_amount: number;
  accelerated_cashback_timing: CashbackTiming;
  other_cashback_amount: number;
  other_cashback_timing: CashbackTiming;
  expected_total_valueback: number;
  valueback_pct_override: number | null;
  override_base_cashback_pct: number | null;
  override_accelerated_cashback_pct: number | null;
  override_other_cashback_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  source_type: TransactionSourceType;
  validation_status: TransactionValidationStatus;
  ingestion_metadata?: Record<string, any> | null;
}

export interface CardWithCategories extends Card {
  categories: CardCategory[];
}

export interface TransactionWithDetails extends Transaction {
  card?: Card;
  category?: CardCategory;
}

export interface MonthlyStats {
  totalCashback: number;
  cardStats: {
    cardId: string;
    cardName: string;
    totalCashback: number;
    transactionCount: number;
  }[];
}

export interface CategoryCapStatus {
  categoryId: string;
  categoryName: string;
  capAmount: number;
  usedAmount: number;
  remainingAmount: number;
  percentage: number;
  isExceeded: boolean;
}
