import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromSpy = vi.fn();
const selectSpy = vi.fn();
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
const neqSpy = vi.fn();
const gteSpy = vi.fn();
const lteSpy = vi.fn();
const maybeSingleSpy = vi.fn();

const queryBuilder = {
  select: selectSpy,
  insert: insertSpy,
  update: updateSpy,
  eq: eqSpy,
  neq: neqSpy,
  gte: gteSpy,
  lte: lteSpy,
  maybeSingle: maybeSingleSpy,
};

vi.mock('./supabase', () => ({
  hasSupabaseEnv: true,
  supabase: {
    from: fromSpy,
  },
}));

vi.mock('./cashbackCore', () => ({
  calculateValuebackWithCaps: vi.fn(() => ({
    base: 12.5,
    accelerated: 0,
    other: 0,
    baseTiming: 'current_statement',
    acceleratedTiming: 'next_statement',
    otherTiming: 'instant',
    total: 12.5,
  })),
  getCapPeriodDates: vi.fn(() => ({
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  })),
}));

describe('transactionWriteService parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromSpy.mockReturnValue(queryBuilder as any);
    selectSpy.mockReturnValue(queryBuilder as any);
    insertSpy.mockReturnValue(queryBuilder as any);
    updateSpy.mockReturnValue(queryBuilder as any);
    eqSpy.mockReturnValue(queryBuilder as any);
    neqSpy.mockReturnValue(queryBuilder as any);
    gteSpy.mockReturnValue(queryBuilder as any);
    lteSpy.mockReturnValue(queryBuilder as any);
    maybeSingleSpy.mockResolvedValue(null);
  });

  it('persists cashback amounts from the shared calculation path on add', async () => {
    maybeSingleSpy
      .mockResolvedValueOnce({
        data: { id: 'card-1', user_id: 'user-1', min_transaction_amount: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'cat-1', card_id: 'card-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'txn-1',
          user_id: 'user-1',
          card_id: 'card-1',
          category_id: 'cat-1',
          amount: 500,
          expected_total_valueback: 12.5,
        },
        error: null,
      });

    const { addTransaction } = await import('./transactionWriteService');

    const result = await addTransaction({
      user_id: 'user-1',
      card_id: 'card-1',
      category_id: 'cat-1',
      amount: 500,
      actual_amount: 500,
      currency: 'INR',
      date: '2026-05-12',
      valueback_pct_override: null,
      override_base_cashback_pct: null,
      override_accelerated_cashback_pct: null,
      override_other_cashback_pct: null,
      notes: null,
      source_type: 'manual',
      validation_status: 'validated',
      ingestion_metadata: null,
    } as any);

    expect(result.expected_total_valueback).toBe(12.5);
    expect(insertSpy).toHaveBeenCalled();
  });

  it('recalculates cashback when a manual transaction amount changes', async () => {
    maybeSingleSpy
      .mockResolvedValueOnce({
        data: {
          id: 'txn-1',
          user_id: 'user-1',
          card_id: 'card-1',
          category_id: 'cat-1',
          amount: 400,
          date: '2026-05-12',
          override_base_cashback_pct: null,
          override_accelerated_cashback_pct: null,
          override_other_cashback_pct: null,
          valueback_pct_override: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'card-1', user_id: 'user-1', min_transaction_amount: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'cat-1', card_id: 'card-1' },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const { updateTransaction } = await import('./transactionWriteService');

    await updateTransaction('txn-1', {
      amount: 600,
      updated_at: '2026-05-12T00:00:00.000Z',
    } as any);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_total_valueback: 12.5,
        base_cashback_amount: 12.5,
      })
    );
  });
});
