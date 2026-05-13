import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertSpy = vi.fn();
const maybeSingleSpy = vi.fn();
const containsSpy = vi.fn();
const eqSpy = vi.fn();
const selectSpy = vi.fn();
const fromSpy = vi.fn();

const queryBuilder = {
  select: selectSpy,
  insert: insertSpy,
  update: vi.fn(),
  eq: eqSpy,
  contains: containsSpy,
  maybeSingle: maybeSingleSpy,
};

vi.mock('./supabase', () => ({
  hasSupabaseEnv: true,
  supabase: {
    from: fromSpy,
  },
}));

vi.mock('./cashbackCore', () => ({
  calculateValuebackWithCaps: () => ({
    base: 0,
    accelerated: 0,
    other: 0,
    baseTiming: 'immediate',
    acceleratedTiming: 'immediate',
    otherTiming: 'immediate',
    total: 0,
  }),
}));

describe('transactionWriteService dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromSpy.mockReturnValue(queryBuilder as any);

    selectSpy.mockReturnValue(queryBuilder);
    insertSpy.mockReturnValue(queryBuilder);
    eqSpy.mockReturnValue(queryBuilder);
    containsSpy.mockReturnValue(queryBuilder);
    maybeSingleSpy.mockResolvedValue(null);
  });

  it('returns an existing transaction when smsHash already exists', async () => {
    maybeSingleSpy
      .mockResolvedValueOnce({
        data: {
          id: 'card-1',
          user_id: 'user-1',
        },
        error: null,
      })
      .mockResolvedValueOnce({
      data: {
        id: 'existing-tx',
        user_id: 'user-1',
        ingestion_metadata: { smsHash: 'abc123' },
      },
      error: null,
    });

    const { addTransaction } = await import('./transactionWriteService');

    const result = await addTransaction({
      user_id: 'user-1',
      card_id: 'card-1',
      category_id: null,
      amount: 100,
      actual_amount: 100,
      currency: 'INR',
      date: '2026-04-30T00:00:00.000Z',
      valueback_pct_override: null,
      override_base_cashback_pct: null,
      override_accelerated_cashback_pct: null,
      override_other_cashback_pct: null,
      notes: null,
      source_type: 'system_sms',
      validation_status: 'pending',
      ingestion_metadata: { smsHash: 'abc123' },
    } as any);

    expect(containsSpy).toHaveBeenCalledWith('ingestion_metadata', { smsHash: 'abc123' });
    expect(insertSpy).not.toHaveBeenCalled();
    expect(result.id).toBe('existing-tx');
  });
});
