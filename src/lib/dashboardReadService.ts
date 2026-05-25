import type { Card, CardCategory, Transaction } from './cashbackCore';
import { supabase } from './supabase';

export interface DashboardMonthlyTotals {
  totalCashback: number;
  totalSpends: number;
  totalActualAmount: number;
}

export interface DashboardHydrationData {
  cards: Card[];
  categories: CardCategory[];
  totals: DashboardMonthlyTotals;
  cardTotals: Record<string, { cashback: number; spends: number }>;
  recentTransactions: Transaction[];
  pendingTransactions: Transaction[];
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === '42703') {
    return true;
  }

  const message = (maybeError.message || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

export function getCalendarMonthRange(date: Date): { startDate: string; endDate: string } {
  const month = date.getMonth();
  const year = date.getFullYear();

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate };
}

export async function loadDashboardReadModel(
  userId: string,
  selectedMonth: Date,
  recentLimit = 10,
  pendingLimit = 25,
): Promise<DashboardHydrationData> {
  const { startDate, endDate } = getCalendarMonthRange(selectedMonth);

  const cardsResult = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (cardsResult.error) {
    throw cardsResult.error;
  }

  const cardIds = (cardsResult.data || []).map((card) => card.id);

  const categoriesQuery = cardIds.length > 0
    ? supabase
        .from('card_categories')
        .select('*')
        .in('card_id', cardIds)
        .order('name', { ascending: true })
    : Promise.resolve({ data: [], error: null } as const);

  const totalsQuery = supabase
    .from('transactions')
    .select('expected_total_valueback, amount')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .not('validation_status', 'in', '(ignored,rejected)');

  const recentQuery = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .not('validation_status', 'in', '(ignored,rejected)')
    .order('date', { ascending: false })
    .order('amount', { ascending: false })
    .limit(recentLimit);

  const pendingQuery = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('source_type', 'system_sms')
    .eq('validation_status', 'pending')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(pendingLimit);

  const [categoriesResult, totalsResult, recentResult, pendingResult] = await Promise.all([
    categoriesQuery,
    totalsQuery,
    recentQuery,
    pendingQuery,
  ]);

  if (categoriesResult.error) {
    throw categoriesResult.error;
  }
  if (totalsResult.error) {
    throw totalsResult.error;
  }
  if (recentResult.error) {
    throw recentResult.error;
  }
  if (pendingResult.error && !isMissingColumnError(pendingResult.error)) {
    throw pendingResult.error;
  }

  const totals = (totalsResult.data || []).reduce(
    (acc, row) => {
      acc.totalCashback += row.expected_total_valueback || 0;
      acc.totalSpends += row.amount || 0;
      acc.totalActualAmount += row.amount || 0;
      return acc;
    },
    { totalCashback: 0, totalSpends: 0, totalActualAmount: 0 },
  );

  const cardTotalsQuery = supabase
    .from('transactions')
    .select('card_id, expected_total_valueback, amount')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .not('validation_status', 'in', '(ignored,rejected)');

  const { data: cardTotalsRows, error: cardTotalsError } = await cardTotalsQuery;
  if (cardTotalsError) {
    throw cardTotalsError;
  }

  const cardTotals = (cardTotalsRows || []).reduce((acc, row) => {
    const cardId = row.card_id as string;
    if (!acc[cardId]) {
      acc[cardId] = { cashback: 0, spends: 0 };
    }

    acc[cardId].cashback += Number(row.expected_total_valueback || 0);
    acc[cardId].spends += Number(row.amount || 0);
    return acc;
  }, {} as Record<string, { cashback: number; spends: number }>);

  return {
    cards: (cardsResult.data || []) as Card[],
    categories: (categoriesResult.data || []) as CardCategory[],
    totals,
    cardTotals,
    recentTransactions: (recentResult.data || []) as Transaction[],
    pendingTransactions: (pendingResult.data || []) as Transaction[],
  };
}
