// TransactionWriteService for cashtrack-native
// All domain logic is delegated to cashback-core
// No UI exposure until parity and regression tests pass

import type { Card, CardCategory, Transaction, TransactionSourceType, TransactionValidationStatus } from './cashbackCore';
import { calculateValuebackWithCaps, getCapPeriodDates } from './cashbackCore';
import { supabase, hasSupabaseEnv } from './supabase';

export type NewTransactionInput = Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'base_cashback_amount' | 'accelerated_cashback_amount' | 'other_cashback_amount' | 'base_cashback_timing' | 'accelerated_cashback_timing' | 'other_cashback_timing' | 'expected_total_valueback'> & {
  source_type?: TransactionSourceType;
  validation_status?: TransactionValidationStatus;
  ingestion_metadata?: Record<string, any> | null;
};

const ensureSupabase = () => {
  if (!hasSupabaseEnv) throw new Error('Missing SUPABASE env (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY)');
};

const getCardById = async (cardId: string): Promise<Card | null> => {
  ensureSupabase();
  const { data, error } = await supabase.from('cards').select('*').eq('id', cardId).maybeSingle();
  if (error) throw error;
  return (data as Card) || null;
};

const getCategoryById = async (categoryId: string): Promise<CardCategory | null> => {
  ensureSupabase();
  const { data, error } = await supabase.from('card_categories').select('*').eq('id', categoryId).maybeSingle();
  if (error) throw error;
  return (data as CardCategory) || null;
};

const getTransactionsInCapPeriod = async (userId: string, cardId: string, categoryId: string, startDate: string, endDate: string): Promise<Transaction[]> => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .eq('category_id', categoryId)
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return (data as Transaction[]) || [];
};

const getExistingCashbackTotals = (transactions: Transaction[]): { base: number; accelerated: number; other: number } => {
  return transactions.reduce(
    (accumulator, txn) => ({
      base: accumulator.base + (txn.base_cashback_amount || 0),
      accelerated: accumulator.accelerated + (txn.accelerated_cashback_amount || 0),
      other: accumulator.other + (txn.other_cashback_amount || 0),
    }),
    { base: 0, accelerated: 0, other: 0 },
  );
};

const insertTransaction = async (txn: Transaction): Promise<Transaction> => {
  ensureSupabase();
  const smsHash = (txn as any)?.ingestion_metadata?.smsHash;
  if (smsHash) {
    const { data: existingDuplicate, error: duplicateError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', txn.user_id)
      .contains('ingestion_metadata', { smsHash })
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (existingDuplicate) {
      return existingDuplicate as Transaction;
    }
  }

  const { data, error } = await supabase.from('transactions').insert(txn).select().maybeSingle();
  if (error) throw error;
  return data as Transaction;
};

const updateTransactionInDb = async (id: string, updates: Partial<Transaction>): Promise<void> => {
  ensureSupabase();
  const { error } = await supabase.from('transactions').update(updates).eq('id', id);
  if (error) throw error;
};

export async function addTransaction(transactionData: NewTransactionInput): Promise<Transaction> {
  const card = await getCardById(transactionData.card_id);
  if (!card) throw new Error('Card not found');
  const category = transactionData.category_id ? await getCategoryById(transactionData.category_id) : null;

  let existingTransactions: Transaction[] = [];
  let existingCashback = { base: 0, accelerated: 0, other: 0 };
  if (category && transactionData.category_id) {
    const txnDate = new Date(transactionData.date);
    const { startDate, endDate } = getCapPeriodDates(txnDate, card);
    existingTransactions = await getTransactionsInCapPeriod(transactionData.user_id, transactionData.card_id, transactionData.category_id, startDate, endDate);
    existingCashback = getExistingCashbackTotals(existingTransactions);
  }

  const transactionOverride = (transactionData.override_base_cashback_pct !== null || transactionData.override_accelerated_cashback_pct !== null || transactionData.override_other_cashback_pct !== null)
    ? {
        basePct: transactionData.override_base_cashback_pct,
        acceleratedPct: transactionData.override_accelerated_cashback_pct,
        otherPct: transactionData.override_other_cashback_pct,
      }
    : undefined;

  const valueback = calculateValuebackWithCaps(
    transactionData.amount,
    category,
    existingCashback,
    transactionData.valueback_pct_override,
    card,
    transactionOverride,
    existingTransactions,
    new Date(transactionData.date),
  );

  const txn: Omit<Transaction, 'id'> = {
    ...transactionData,
    source_type: transactionData.source_type ?? 'manual',
    validation_status: transactionData.validation_status ?? 'validated',
    ingestion_metadata: transactionData.ingestion_metadata ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    base_cashback_amount: valueback.base,
    accelerated_cashback_amount: valueback.accelerated,
    other_cashback_amount: valueback.other,
    base_cashback_timing: valueback.baseTiming,
    accelerated_cashback_timing: valueback.acceleratedTiming,
    other_cashback_timing: valueback.otherTiming,
    expected_total_valueback: valueback.total,
  };
  return await insertTransaction(txn as Transaction);
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  ensureSupabase();

  const { data: currentTxn, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!currentTxn) throw new Error('Transaction not found');

  const transaction = currentTxn as Transaction;
  const mergedUpdates = { ...transaction, ...updates } as Transaction;

  const needsRecalculation =
    updates.amount !== undefined ||
    updates.category_id !== undefined ||
    updates.card_id !== undefined ||
    updates.date !== undefined ||
    updates.override_base_cashback_pct !== undefined ||
    updates.override_accelerated_cashback_pct !== undefined ||
    updates.override_other_cashback_pct !== undefined ||
    updates.valueback_pct_override !== undefined;

  if (!needsRecalculation) {
    await updateTransactionInDb(id, updates);
    return;
  }

  const card = await getCardById(mergedUpdates.card_id);
  if (!card) throw new Error('Card not found');

  const category = mergedUpdates.category_id ? await getCategoryById(mergedUpdates.category_id) : null;

  let existingTransactions: Transaction[] = [];
  let existingCashback = { base: 0, accelerated: 0, other: 0 };

  if (category && mergedUpdates.category_id) {
    const txnDate = new Date(mergedUpdates.date);
    const { startDate, endDate } = getCapPeriodDates(txnDate, card);
    const { data: existingTxns, error: queryError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', mergedUpdates.user_id)
      .eq('card_id', mergedUpdates.card_id)
      .eq('category_id', mergedUpdates.category_id)
      .neq('id', id)
      .gte('date', startDate)
      .lte('date', endDate);

    if (queryError) throw queryError;
    existingTransactions = (existingTxns as Transaction[]) || [];
    existingCashback = getExistingCashbackTotals(existingTransactions);
  }

  const transactionOverride =
    mergedUpdates.override_base_cashback_pct !== null ||
    mergedUpdates.override_accelerated_cashback_pct !== null ||
    mergedUpdates.override_other_cashback_pct !== null
      ? {
          basePct: mergedUpdates.override_base_cashback_pct,
          acceleratedPct: mergedUpdates.override_accelerated_cashback_pct,
          otherPct: mergedUpdates.override_other_cashback_pct,
        }
      : undefined;

  const valueback = calculateValuebackWithCaps(
    mergedUpdates.amount,
    category,
    existingCashback,
    mergedUpdates.valueback_pct_override,
    card,
    transactionOverride,
    existingTransactions,
    new Date(mergedUpdates.date),
  );

  const finalUpdates: Partial<Transaction> = {
    ...updates,
    base_cashback_amount: valueback.base,
    base_cashback_timing: valueback.baseTiming,
    accelerated_cashback_amount: valueback.accelerated,
    accelerated_cashback_timing: valueback.acceleratedTiming,
    other_cashback_amount: valueback.other,
    other_cashback_timing: valueback.otherTiming,
    expected_total_valueback: valueback.total,
    updated_at: new Date().toISOString(),
  };

  await updateTransactionInDb(id, finalUpdates);
}

export async function listPendingSystemTransactions(userId: string, limit = 50): Promise<Transaction[]> {
  ensureSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('source_type', 'system_sms')
    .eq('validation_status', 'pending')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Transaction[]) || [];
}

export async function setTransactionValidationStatus(
  id: string,
  validation_status: TransactionValidationStatus,
): Promise<void> {
  ensureSupabase();
  const { error } = await supabase
    .from('transactions')
    .update({ validation_status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
