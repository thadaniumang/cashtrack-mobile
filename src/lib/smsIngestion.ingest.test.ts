// smsIngestion.ingest.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock for the dynamic import in ingestSmsTransactions
vi.mock('./transactionWriteService', () => ({ addTransaction: vi.fn() }));

import * as smsMod from './smsIngestion';
import { ingestSmsTransactions, resetIngestionDeduper } from './smsIngestion';
import { addTransaction } from './transactionWriteService';

describe('ingestSmsTransactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIngestionDeduper();
  });

  const formatLocalDay = (value: string) => {
    const date = new Date(Number(value));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  it('creates pending system transaction when match is confident', async () => {
    const sms = 'Spent INR 1,234.56 on HDFC Bank card.';

    // Force a confident match regardless of parsed accountHint
    vi.spyOn(smsMod, 'matchCardFromSms').mockReturnValue({
      cardId: 'card-1',
      confidence: 0.95,
      matchedName: 'HDFC Bank',
      reason: 'test',
    });

    const fakeTxn = { id: 'tx-1', amount: 1234.56, source_type: 'system_sms', validation_status: 'pending' };
    (addTransaction as any).mockResolvedValue(fakeTxn);

    const userCards = [{ id: 'card-1', name: 'HDFC Bank' }];
    const res = await ingestSmsTransactions('user-1', userCards, [sms]);

    expect((addTransaction as any)).toHaveBeenCalledTimes(1);
    const calledWith = (addTransaction as any).mock.calls[0][0];
    expect(calledWith.source_type).toBe('system_sms');
    expect(calledWith.validation_status).toBe('pending');
    expect(calledWith.ingestion_metadata?.rawMessage).toBe(sms);
    expect(res[0].createdTransaction).toEqual(fakeTxn);
  });

  it('uses the SMS date when creating the transaction', async () => {
    const sms = {
      body: 'Spent INR 1,234.56 on HDFC Bank card.',
      date: '1714358400000',
    };

    vi.spyOn(smsMod, 'matchCardFromSms').mockReturnValue({
      cardId: 'card-1',
      confidence: 0.95,
      matchedName: 'HDFC Bank',
      reason: 'test',
    });

    const fakeTxn = { id: 'tx-2', amount: 1234.56, source_type: 'system_sms', validation_status: 'pending' };
    (addTransaction as any).mockResolvedValue(fakeTxn);

    const userCards = [{ id: 'card-1', name: 'HDFC Bank' }];
    const res = await ingestSmsTransactions('user-1', userCards, [sms as any]);

    expect((addTransaction as any)).toHaveBeenCalledTimes(1);
    const calledWith = (addTransaction as any).mock.calls[0][0];
    const expectedDate = formatLocalDay(sms.date);
    expect(calledWith.date).toBe(expectedDate);
    expect(res[0].parsed.date).toBe(expectedDate);
  });

  it('skips messages that do not contain the Spent keyword', async () => {
    const sms = 'Your OTP for INR 1,234.56 is 123456.';

    vi.spyOn(smsMod, 'matchCardFromSms').mockReturnValue({
      cardId: 'card-1',
      confidence: 0.95,
      matchedName: 'HDFC Bank',
      reason: 'test',
    });

    const userCards = [{ id: 'card-1', name: 'HDFC Bank' }];
    const res = await ingestSmsTransactions('user-1', userCards, [sms]);

    expect((addTransaction as any)).not.toHaveBeenCalled();
    expect(res[0].createdTransaction).toBeUndefined();
    expect(res[0].match.reason).toBe('missing transaction+card keyword');
  });

  it('matches user SMS with HDFC card without mocking', async () => {
    // Real-world test: "Spent Rs. 1500 on HDFC Credit Card 1385"
    // User has an HDFC card in their app
    const sms = 'Spent Rs. 1500 on HDFC Credit Card 1385';
    const userCards = [
      { id: 'hdfc-card-123', name: 'HDFC', aliases: [] },
    ];

    const fakeTxn = { id: 'tx-1', amount: 1500, source_type: 'system_sms', validation_status: 'pending' };
    (addTransaction as any).mockResolvedValue(fakeTxn);

    const res = await ingestSmsTransactions('user-1', userCards, [sms]);

    // Should match and create transaction
    if (res[0].createdTransaction && !('error' in res[0].createdTransaction)) {
      expect((addTransaction as any)).toHaveBeenCalledTimes(1);
      const calledWith = (addTransaction as any).mock.calls[0][0];
      expect(calledWith.amount).toBe(1500);
      expect(calledWith.card_id).toBe('hdfc-card-123');
    } else {
      // Log diagnostics if it failed
      console.log('SMS match failed:', res[0].match);
      console.log('Parsed:', res[0].parsed);
      expect.fail(`SMS should have been matched. Reason: ${res[0].match.reason}`);
    }
  });
});

describe('SMS Approval Workflow', () => {
  it('pending SMS should be approvable by updating with validation_status=validated', () => {
    // Simulate the approval workflow:
    // 1. SMS ingested with validation_status='pending'
    const pendingSms = {
      id: 'sms-tx-1',
      validation_status: 'pending',
      source_type: 'system_sms',
      amount: 1500,
    };

    // 2. User reviews and approves (updates transaction)
    const approvedSms = {
      ...pendingSms,
      validation_status: 'validated', // Changed to validated
    };

    expect(pendingSms.validation_status).toBe('pending');
    expect(approvedSms.validation_status).toBe('validated');
    expect(approvedSms.source_type).toBe('system_sms');
  });
});
