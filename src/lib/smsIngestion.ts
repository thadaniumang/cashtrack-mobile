// smsIngestion.ts
// Android-only SMS ingestion module for transaction parsing and matching

export interface ParsedSmsCandidate {
  amount: number | null;
  date: string | null;
  accountHint: string | null;
  rawMessage: string;
  parserDiagnostics?: Record<string, any>;
}

export interface CardMatchResult {
  cardId: string | null;
  confidence: number;
  matchedName: string | null;
  reason: string;
}

const KNOWN_ISSUERS = ['hdfc', 'hsbc', 'icici', 'axis', 'sbi', 'amex', 'kotak', 'indusind', 'yes', 'au'];

// In-memory dedupe tracker for SMS ingestion within the JS runtime.
// Keyed by a stable non-cryptographic hash of the raw message.
const _ingestionSeen = new Set<string>();
export function resetIngestionDeduper() {
  _ingestionSeen.clear();
}

function smsHash(s: string): string {
  // djb2-like rolling hash (fast, non-cryptographic)
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

/**
 * readSmsInbox
 * Android-only: read SMS messages from the device inbox.
 *
 * Notes:
 * - Expo-managed apps require a custom native module or EAS build with permission handling.
 * - This function is a safe scaffold: it returns `[]` in JS/test environments.
 * - Provide a `smsListOverride` to `ingestSmsTransactions()` for testing.
 */
export async function readSmsInbox(): Promise<string[]> {
  // Attempt to read via Android native module when available. Fall back to [].
  // dynamic import to avoid requiring react-native bindings in web/test envs
  const mod = await import('./androidSms');
  if (mod && typeof mod.readInbox === 'function') {
    return await mod.readInbox();
  }
  return [];
}

export function parseSmsForTransaction(sms: string): ParsedSmsCandidate {
  // Match patterns like "INR 1,234.56" or "Rs. 1234.56" or "₹ 1234.56"
  const amountMatch = sms.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  const rawAmount = amountMatch ? amountMatch[1] : null;
  const amount = rawAmount ? parseFloat(rawAmount.replace(/,/g, '')) : null;
  const hasTransactionKeyword = /(?:spent|used|paid|charged|debited|purchase|transaction)/i.test(sms);
  const hasCardKeywordMatch = /(?:card|credit|debit)/i.test(sms);

  return {
    amount,
    date: null,
    accountHint: null,
    rawMessage: sms,
    parserDiagnostics: { amountMatch, hasTransactionKeyword, hasCardKeywordMatch },
  };
}

export function matchCardFromSms(
  accountHint: string | null,
  userCards: { id: string; name: string; aliases?: string[] }[],
  rawMessage?: string
): CardMatchResult {
  if (!accountHint) {
    return { cardId: null, confidence: 0, matchedName: null, reason: 'No account hint' };
  }

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const tokens = (s: string) => (s.length === 0 ? [] : normalize(s).split(' '));

  const extractIssuer = (s: string): string | null => {
    const norm = normalize(s);
    for (const issuer of KNOWN_ISSUERS) {
      if (norm.includes(issuer)) return issuer;
    }
    return null;
  };

  const extractLast4 = (s: string): string | null => {
    const withCardContext = s.match(/(?:card|credit|debit|a\/c|account|ending)\D{0,16}(\d{4})/i);
    if (withCardContext?.[1]) return withCardContext[1];

    const masked = s.match(/(?:x{2,}|\*{2,}|xx+|\*\*+)\s*(\d{4})/i);
    if (masked?.[1]) return masked[1];

    return null;
  };

  // simple iterative levenshtein implementation (two-row)
  const levenshtein = (a: string, b: string) => {
    if (a === b) return 0;
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    let prev = new Array(bn + 1);
    let cur = new Array(bn + 1);
    for (let j = 0; j <= bn; j++) prev[j] = j;
    for (let i = 1; i <= an; i++) {
      cur[0] = i;
      for (let j = 1; j <= bn; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      const tmp = prev;
      prev = cur;
      cur = tmp;
    }
    return prev[bn];
  };

  const hintNorm = normalize(accountHint);
  const hintTokens = tokens(accountHint);
  if (hintNorm.length === 0) {
    return { cardId: null, confidence: 0, matchedName: null, reason: 'No account hint' };
  }

  let best: CardMatchResult = { cardId: null, confidence: 0, matchedName: null, reason: 'no match' };
  let secondBest = 0;
  const smsText = rawMessage || accountHint;
  const smsNorm = normalize(smsText);
  const smsIssuer = extractIssuer(smsText);
  const smsLast4 = extractLast4(smsText);

  for (const card of userCards) {
    const namesToTry = [card.name].concat(card.aliases || []);
    const cardIssuer = extractIssuer(namesToTry.join(' '));
    const cardLast4 = extractLast4(namesToTry.join(' '));
    let cardBestScore = 0;

    for (const name of namesToTry) {
      const nameNorm = normalize(name);

      // exact or contains
      if (nameNorm === hintNorm || hintNorm.includes(nameNorm) || nameNorm.includes(hintNorm)) {
        const score = 0.98;
        cardBestScore = Math.max(cardBestScore, score);
        continue;
      }

      // token overlap
      const nameTokens = tokens(name);
      const shared = nameTokens.filter((t) => hintTokens.includes(t)).length;
      const tokenCoverage = nameTokens.length === 0 ? 0 : shared / nameTokens.length;

      // levenshtein similarity on whole normalized strings
      const dist = levenshtein(hintNorm, nameNorm);
      const maxLen = Math.max(hintNorm.length, nameNorm.length) || 1;
      const levSim = 1 - dist / maxLen;

      let combined = Math.max(0, tokenCoverage * 0.7 + levSim * 0.3);
      if (smsNorm.includes(nameNorm) || nameNorm.includes(smsNorm)) {
        combined += 0.2;
      }
      cardBestScore = Math.max(cardBestScore, Math.min(1, combined));
    }

    if (smsIssuer && cardIssuer) {
      if (smsIssuer === cardIssuer) {
        cardBestScore += 0.35;
      } else {
        cardBestScore -= 0.25;
      }
    }

    if (smsLast4 && cardLast4) {
      if (smsLast4 === cardLast4) {
        cardBestScore += 0.4;
      } else {
        cardBestScore -= 0.35;
      }
    }

    const rounded = Math.round(Math.max(0, Math.min(1, cardBestScore)) * 100) / 100;
    if (rounded > best.confidence) {
      secondBest = best.confidence;
      best = {
        cardId: card.id,
        confidence: rounded,
        matchedName: card.name,
        reason: smsIssuer && cardIssuer && smsIssuer === cardIssuer ? 'issuer+fuzzy' : 'fuzzy',
      };
    } else if (rounded > secondBest) {
      secondBest = rounded;
    }
  }

  if (best.confidence < 0.55) {
    return { cardId: null, confidence: 0, matchedName: null, reason: 'no confident match' };
  }

  // For ambiguous matches, check if it's due to same issuer (e.g., multiple HDFC cards)
  // If so, allow it since all cards for that issuer are equally valid
  const ambiguousButSameIssuer = 
    best.confidence - secondBest < 0.12 && 
    smsIssuer && 
    best.reason === 'issuer+fuzzy';

  if (best.confidence - secondBest < 0.12 && !ambiguousButSameIssuer) {
    return { cardId: null, confidence: 0, matchedName: null, reason: 'ambiguous match' };
  }

  return best;
}

function serializeError(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const parts = [err.name, err.message].filter(Boolean).join(': ');
    const code = (err as any).code ? ` [${(err as any).code}]` : '';
    const details = (err as any).details || (err as any).response?.status || '';
    return `${parts}${code}${details ? ` - ${details}` : ''}`;
  }
  // Try to extract meaningful properties from plain objects
  if (typeof err === 'object') {
    const msg = err.message || err.msg || err.error || '';
    const code = err.code ? ` [${err.code}]` : '';
    const status = err.status || err.statusCode || err.statusMessage ? ` HTTP ${err.status || err.statusCode}` : '';
    if (msg || code || status) {
      return `${msg}${code}${status}`;
    }
  }
  // Last resort: JSON stringify with a depth limit
  try {
    return JSON.stringify(err).substring(0, 200);
  } catch {
    return Object.prototype.toString.call(err);
  }
}

function hasTransactionKeyword(message: string): boolean {
  // Check for transaction keywords: spent, used, paid, charged, debited, etc.
  // Case-insensitive, substring match (no word boundary requirement)
  const keywords = ['spent', 'used', 'paid', 'charged', 'debited', 'purchase', 'transaction'];
  const msgLower = message.toLowerCase();
  return keywords.some((kw) => msgLower.includes(kw));
}

function hasCardKeyword(message: string): boolean {
  // Check for card-related keywords: card, creditcard, debitcard, etc.
  // Case-insensitive, substring match (no word boundary requirement)
  const keywords = ['card', 'credit', 'debit'];
  const msgLower = message.toLowerCase();
  return keywords.some((kw) => msgLower.includes(kw));
}

export async function ingestSmsTransactions(
  userId: string,
  userCards: { id: string; name: string; aliases?: string[] }[],
  smsListOverride?: string[]
) {
  const smsList = smsListOverride ?? (await readSmsInbox());
  const results = [] as Array<{ parsed: ParsedSmsCandidate; match: CardMatchResult; createdTransaction?: any }>;

  // lazy import to avoid circular deps in tests
  const { addTransaction } = await import('./transactionWriteService');

  for (const sms of smsList) {
    const parsed = parseSmsForTransaction(sms);
    const hasTransaction = hasTransactionKeyword(parsed.rawMessage);
    const hasCard = hasCardKeyword(parsed.rawMessage);
    if (!hasTransaction || !hasCard) {
      const missingKeywords = [!hasTransaction ? 'transaction' : null, !hasCard ? 'card' : null]
        .filter(Boolean)
        .join('+');
      results.push({
        parsed,
        match: { cardId: null, confidence: 0, matchedName: null, reason: `missing ${missingKeywords} keyword` },
      });
      continue;
    }

    // compute stable hash for this raw message and skip duplicates seen in this runtime
    const hash = smsHash(parsed.rawMessage || sms);
    if (_ingestionSeen.has(hash)) {
      const entry: { parsed: ParsedSmsCandidate; match: CardMatchResult; createdTransaction?: any } = {
        parsed,
        match: { cardId: null, confidence: 0, matchedName: null, reason: 'duplicate' },
      };
      results.push(entry);
      continue;
    }
    _ingestionSeen.add(hash);
    // If parser didn't extract an account hint, try a lightweight heuristic:
    // check whether the SMS contains any card name or alias as a substring.
    let accountHint = parsed.accountHint;
    if (!accountHint) {
      const smsNorm = parsed.rawMessage.toLowerCase();
      for (const card of userCards) {
        const namesToTry = [card.name].concat(card.aliases || []);
        if (namesToTry.some((n) => n && smsNorm.includes(n.toLowerCase()))) {
          accountHint = card.name;
          break;
        }
      }
    }
    if (!accountHint) {
      accountHint = parsed.rawMessage;
    }

    const match = matchCardFromSms(accountHint, userCards, parsed.rawMessage);
    const entry: { parsed: ParsedSmsCandidate; match: CardMatchResult; createdTransaction?: any } = { parsed, match };

    // Determine final card ID: use matched card when confident.
    // For ambiguous matches (multiple cards with same issuer), use the best match
    // but user can override during review.
    // Fallback is intentionally restricted to single-card users to avoid cross-issuer misclassification.
    let finalCardId = match.cardId;
    if (!finalCardId || match.confidence < 0.55) {
      if (userCards.length === 1) {
        finalCardId = userCards[0].id;
        entry.match = { ...match, cardId: finalCardId, reason: 'fallback single card' };
      }
    }

    if (finalCardId && parsed.amount !== null) {
      // create pending system transaction
      const txnDate = new Date().toISOString().split('T')[0];
      try {
        const txn = await addTransaction({
          user_id: userId,
          card_id: finalCardId,
          category_id: null,
          amount: parsed.amount,
          actual_amount: parsed.amount,
          currency: 'INR',
          date: txnDate,
          valueback_pct_override: null,
          override_base_cashback_pct: null,
          override_accelerated_cashback_pct: null,
          override_other_cashback_pct: null,
          notes: null,
          source_type: 'system_sms',
          validation_status: 'pending',
          ingestion_metadata: {
            rawMessage: parsed.rawMessage,
            smsHash: hash,
            parserDiagnostics: parsed.parserDiagnostics,
            match,
          },
        } as any);
        entry.createdTransaction = txn;
      } catch (err) {
        // attach error for diagnostics but continue
        const errorMsg = serializeError(err);
        entry.createdTransaction = { error: errorMsg };
      }
    }

    results.push(entry);
  }

  return results;
}
