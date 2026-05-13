// smsIngestion.test.ts
// Basic test scaffold for SMS ingestion pipeline
import { describe, it, expect } from 'vitest';
import { parseSmsForTransaction, matchCardFromSms } from './smsIngestion';

describe('parseSmsForTransaction', () => {
  it('extracts amount from INR/Rs/₹ pattern', () => {
    const sms = 'Spent INR 1,234.56 on 2026-04-29.';
    const parsed = parseSmsForTransaction(sms);
    expect(parsed.amount).toBeCloseTo(1234.56);
  });

  it('extracts amount with space after Rs.', () => {
    const sms = 'Spent Rs. 1000 on HDFC Card';
    const parsed = parseSmsForTransaction(sms);
    expect(parsed.amount).toBe(1000);
  });

  it('extracts amount with no space after Rs.', () => {
    const sms = 'Spent Rs.1000 on HDFC Card';
    const parsed = parseSmsForTransaction(sms);
    expect(parsed.amount).toBe(1000);
  });

  it('returns null if no amount found', () => {
    const sms = 'No amount here.';
    const parsed = parseSmsForTransaction(sms);
    expect(parsed.amount).toBeNull();
  });
});

describe('matchCardFromSms', () => {
  it('returns no match if no account hint', () => {
    const result = matchCardFromSms(null, [{ id: '1', name: 'HDFC Bank' }]);
    expect(result.cardId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('matches exact card name', () => {
    const cards = [{ id: '1', name: 'HDFC Bank' }];
    const res = matchCardFromSms('HDFC Bank', cards);
    expect(res.cardId).toBe('1');
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('matches alias name', () => {
    const cards = [{ id: '2', name: 'State Bank of India', aliases: ['SBI'] }];
    const res = matchCardFromSms('SBI', cards);
    expect(res.cardId).toBe('2');
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('fuzzy matches small typo', () => {
    const cards = [{ id: '1', name: 'HDFC Bank' }];
    const res = matchCardFromSms('HDFC Bnk', cards);
    expect(res.cardId).toBe('1');
    expect(res.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('returns no match for unrelated hint', () => {
    const cards = [{ id: '1', name: 'HDFC Bank' }];
    const res = matchCardFromSms('Random Cooperative', cards);
    expect(res.cardId).toBeNull();
    expect(res.confidence).toBe(0);
  });

  it('should match HDFC card with issuer and last4 scoring', () => {
    // This test simulates the exact SMS from the user: "Spent Rs. 1500 on HDFC Credit Card 1385"
    const cards = [{ id: 'hdfc-cc-1385', name: 'HDFC Credit Card 1385', aliases: ['HDFC', 'HDFC CC'] }];
    
    // When parser extracts the full message as accountHint (because no exact card name found initially)
    const accountHint = 'Spent Rs. 1500 on HDFC Credit Card 1385';
    const smsText = 'Spent Rs. 1500 on HDFC Credit Card 1385';
    
    const res = matchCardFromSms(accountHint, cards, smsText);
    console.log('Match result:', JSON.stringify(res, null, 2));
    
    // Should match with high confidence due to issuer + last4 + name overlap
    expect(res.cardId).toBe('hdfc-cc-1385');
    expect(res.confidence).toBeGreaterThan(0.55);
  });

  it('returns no match if user has no cards', () => {
    const res = matchCardFromSms('HDFC Bank', []);
    expect(res.cardId).toBeNull();
    expect(res.confidence).toBe(0);
  });

  it('handles ambiguous HDFC match with multiple HDFC cards (user scenario)', () => {
    // User has 3 HDFC cards - this is the real-world problem
    const userCards = [
      { id: 'hdfc-swiggy', name: 'HDFC Swiggy', aliases: [] },
      { id: 'hdfc-diners', name: 'HDFC Diners Club Privilege', aliases: [] },
      { id: 'hdfc-neu', name: 'HDFC Tata Neu Infinity', aliases: [] },
    ];
    
    // SMS with just "HDFC" - should now match to the best HDFC card (Swiggy)
    const res1 = matchCardFromSms('HDFC', userCards);
    console.log('Ambiguous HDFC match:', JSON.stringify(res1, null, 2));
    
    // SMS with last4 - should match based on issuer + fuzzy
    const res2 = matchCardFromSms('HDFC Credit Card 1385', userCards);
    console.log('HDFC with last4 match:', JSON.stringify(res2, null, 2));
    
    // Now ambiguous HDFC matches should succeed and match to one of the HDFC cards
    expect(res1.cardId).not.toBeNull();
    expect(res1.confidence).toBeGreaterThan(0);
    expect(res1.reason).toContain('issuer'); // Should be issuer-based match
  });
});
