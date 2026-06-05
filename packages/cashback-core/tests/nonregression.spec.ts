import { describe, expect, it } from 'vitest';
import {
  applyMultipleCaps,
  calculateValuebackAmounts,
  getExistingCashbackByCapType,
  getStatementMonthDates,
} from '../src';
import type { Card, CardCategory, Transaction } from '../src';

const baseCard: Card = {
  id: 'card-1',
  user_id: 'user-1',
  name: 'Primary Card',
  total_limit: null,
  variant: 'Visa',
  currency: 'INR',
  reward_type: 'cashback',
  min_transaction_amount: 0,
  transaction_amount_rounding: 'none',
  cashback_amount_rounding: 'none',
  use_stepped_cashback: false,
  stepped_cashback_amount: null,
  cap_period_type: 'statement_month',
  statement_day: 15,
  is_closed: false,
  closed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const baseCategory: CardCategory = {
  id: 'cat-1',
  card_id: 'card-1',
  name: 'Dining',
  cap_amount: null,
  cap_type: 'none',
  base_cashback_caps: [{ cap_type: 'none', cap_amount: 0 }],
  base_cashback_pct: 0,
  base_cashback_timing: 'current_statement',
  base_cap_amount: null,
  base_cap_type: 'none',
  accelerated_cap_amount: null,
  accelerated_cap_type: 'none',
  accelerated_cashback_caps: [{ cap_type: 'none', cap_amount: 0 }],
  accelerated_cashback_pct: 0,
  accelerated_cashback_timing: 'next_statement',
  other_cap_amount: null,
  other_cap_type: 'none',
  other_cashback_caps: [{ cap_type: 'none', cap_amount: 0 }],
  other_cashback_pct: 0,
  other_cashback_timing: 'instant',
  caps_modified_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function buildTxn(id: string, date: string, baseCashback: number): Transaction {
  return {
    id,
    user_id: 'user-1',
    card_id: 'card-1',
    category_id: 'cat-1',
    amount: 100,
    actual_amount: 100,
    currency: 'INR',
    date,
    base_cashback_amount: baseCashback,
    base_cashback_timing: 'current_statement',
    accelerated_cashback_amount: 0,
    accelerated_cashback_timing: 'next_statement',
    other_cashback_amount: 0,
    other_cashback_timing: 'instant',
    expected_total_valueback: baseCashback,
    valueback_pct_override: null,
    override_base_cashback_pct: null,
    override_accelerated_cashback_pct: null,
    override_other_cashback_pct: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    source_type: 'system_sms',
    validation_status: 'validated',
  };
}

describe('cashback core non-regression invariants', () => {
  it('enforces multi-cap lowest-wins behavior', () => {
    const final = applyMultipleCaps(
      30,
      [
        { cap_type: 'monthly', cap_amount: 100 },
        { cap_type: 'daily', cap_amount: 50 },
      ],
      {
        monthly: 80,
        daily: 45,
      }
    );

    expect(final).toBe(5);
  });

  it('keeps per_transaction cap non-accumulating', () => {
    const existingByType = getExistingCashbackByCapType(
      [buildTxn('t1', '2026-04-10', 5), buildTxn('t2', '2026-04-10', 7)],
      'cat-1',
      new Date('2026-04-10T09:00:00Z'),
      baseCard,
      'base'
    );

    expect(existingByType.daily).toBe(12);
    expect(existingByType.per_transaction).toBe(0);
  });

  it('handles statement period boundaries correctly', () => {
    expect(getStatementMonthDates(new Date('2026-04-14T12:00:00Z'), 15)).toEqual({
      startDate: '2026-03-15',
      endDate: '2026-04-14',
    });

    expect(getStatementMonthDates(new Date('2026-04-15T12:00:00Z'), 15)).toEqual({
      startDate: '2026-04-15',
      endDate: '2026-05-14',
    });

    const monthly = getExistingCashbackByCapType(
      [
        buildTxn('in1', '2026-03-15', 3),
        buildTxn('in2', '2026-04-14', 7),
        buildTxn('out', '2026-04-15', 99),
      ],
      'cat-1',
      new Date('2026-04-14T12:00:00Z'),
      baseCard,
      'base'
    );

    expect(monthly.monthly).toBe(10);
  });

  it('preserves transaction rounding + stepped amount + cashback rounding behavior', () => {
    const card: Card = {
      ...baseCard,
      transaction_amount_rounding: 'floor',
      cashback_amount_rounding: 'ceil',
      use_stepped_cashback: true,
      stepped_cashback_amount: 50,
    };

    const category: CardCategory = {
      ...baseCategory,
      base_cashback_pct: 1.6,
    };

    const result = calculateValuebackAmounts(103.2, category, undefined, card);

    expect(result.base).toBe(2);
    expect(result.total).toBe(2);
    expect(result.currstmt).toBe(2);
  });
});
