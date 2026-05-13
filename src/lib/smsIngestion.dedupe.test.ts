import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dynamic import target
vi.mock('./transactionWriteService', () => ({ addTransaction: vi.fn() }));

import * as smsMod from './smsIngestion';
import { ingestSmsTransactions, resetIngestionDeduper } from './smsIngestion';
import { addTransaction } from './transactionWriteService';

describe('sms ingestion dedupe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIngestionDeduper();
  });

  it('skips duplicate SMS messages within the same ingestion run', async () => {
    const sms = 'Spent INR 1,234.56 on HDFC Bank card.';
    vi.spyOn(smsMod, 'matchCardFromSms').mockReturnValue({
      cardId: 'card-1',
      confidence: 0.95,
      matchedName: 'HDFC Bank',
      reason: 'test',
    });
    (addTransaction as any).mockResolvedValue({ id: 'tx-1' });

    const userCards = [{ id: 'card-1', name: 'HDFC Bank' }];
    const res = await ingestSmsTransactions('user-1', userCards, [sms, sms]);

    expect((addTransaction as any)).toHaveBeenCalledTimes(1);
    expect(res.length).toBe(2);
    expect(res[0].createdTransaction).toEqual({ id: 'tx-1' });
    expect(res[1].createdTransaction).toBeUndefined();
    expect(res[1].match.reason).toBe('duplicate');
  });
});
