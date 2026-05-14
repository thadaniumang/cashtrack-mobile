// capPeriods.ts - Cap period calculation for statement vs calendar months
// Ported from cashback-companion

export interface Card {
  id: string;
  name: string;
  cap_period_type: 'calendar_month' | 'statement_month';
  statement_day?: number | null;
}

/**
 * Get the start and end dates for the cap tracking period based on card settings
 */
export function getCapPeriodDates(date: Date, card: Card): { startDate: string; endDate: string } {
  if (card.cap_period_type === 'calendar_month') {
    return getCalendarMonthDates(date);
  } else {
    return getStatementMonthDates(date, card.statement_day || 1);
  }
}

/**
 * Get calendar month dates (1st to last day of month)
 */
export function getCalendarMonthDates(date: Date): { startDate: string; endDate: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Format dates as YYYY-MM-DD without timezone conversion
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return { startDate, endDate };
}

/**
 * Get statement month dates based on statement day
 * For example: statement_day = 15 means 15th of one month to 14th of next month
 */
export function getStatementMonthDates(date: Date, statementDay: number): { startDate: string; endDate: string } {
  const currentDay = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();
  
  let startYear: number, startMonth: number;
  let endYear: number, endMonth: number;
  
  if (currentDay >= statementDay) {
    // We're in the current statement period: statementDay of current month to (statementDay-1) of next month
    startYear = year;
    startMonth = month;
    endYear = month === 11 ? year + 1 : year;
    endMonth = month === 11 ? 0 : month + 1;
  } else {
    // We're in the previous statement period: statementDay of previous month to (statementDay-1) of current month
    startYear = month === 0 ? year - 1 : year;
    startMonth = month === 0 ? 11 : month - 1;
    endYear = year;
    endMonth = month;
  }
  
  // Format dates as YYYY-MM-DD without timezone conversion
  const startDate = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(statementDay).padStart(2, '0')}`;
  
  // Handle edge case: if statementDay is 1, end date should be last day of previous month
  let endDay: number;
  if (statementDay === 1) {
    // Get last day of the month before endMonth
    const tempEndYear = endMonth === 0 ? endYear - 1 : endYear;
    const tempEndMonth = endMonth === 0 ? 11 : endMonth - 1;
    endDay = new Date(tempEndYear, tempEndMonth + 1, 0).getDate();
    endYear = tempEndYear;
    endMonth = tempEndMonth;
  } else {
    endDay = statementDay - 1;
  }
  
  const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  
  return { startDate, endDate };
}

/**
 * Format the cap period for display
 */
export function formatCapPeriod(card: Card, date: Date): string {
  const { startDate, endDate } = getCapPeriodDates(date, card);
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  
  if (card.cap_period_type === 'calendar_month') {
    return `${formatDate(start)} - ${formatDate(end)}`;
  } else {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
}
