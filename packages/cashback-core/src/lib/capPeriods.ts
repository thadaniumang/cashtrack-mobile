import { Card } from '../types';

/**
 * Get the start and end dates for the cap tracking period based on card settings
 * @param date - The date to get the period for
 * @param card - The card with cap period settings
 * @returns Object with startDate and endDate as ISO strings
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

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate };
}

/**
 * Get statement month dates based on statement day
 * For example: statement_day = 15 means 15th of one month to 14th of next month
 * @param date - The date to get the period for
 * @param statementDay - Day of month when statement cycle starts (1-28)
 */
export function getStatementMonthDates(date: Date, statementDay: number): { startDate: string; endDate: string } {
  const currentDay = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

  let startYear: number;
  let startMonth: number;
  let endYear: number;
  let endMonth: number;

  if (currentDay >= statementDay) {
    startYear = year;
    startMonth = month;
    endYear = month === 11 ? year + 1 : year;
    endMonth = month === 11 ? 0 : month + 1;
  } else {
    startYear = month === 0 ? year - 1 : year;
    startMonth = month === 0 ? 11 : month - 1;
    endYear = year;
    endMonth = month;
  }

  const startDate = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(statementDay).padStart(2, '0')}`;

  let endDay: number;
  if (statementDay === 1) {
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
 * Get statement month dates for a month-based selector.
 */
export function getStatementMonthDatesForSelectedMonth(date: Date, statementDay: number): { startDate: string; endDate: string } {
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), 28);
  return getStatementMonthDates(normalizedDate, statementDay);
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
    return `${formatDate(start)} - ${formatDate(end)} (Calendar Month)`;
  } else {
    return `${formatDate(start)} - ${formatDate(end)} (Statement Month)`;
  }
}

/**
 * Format period for display based on view mode
 */
export function formatPeriodWithMode(card: Card, date: Date, viewMode: 'calendar' | 'statement'): string {
  let startDate: string;
  let endDate: string;

  if (viewMode === 'calendar') {
    const calendarDates = getCalendarMonthDates(date);
    startDate = calendarDates.startDate;
    endDate = calendarDates.endDate;
  } else {
    const statementDates = getStatementMonthDatesForSelectedMonth(date, card.statement_day || 1);
    startDate = statementDates.startDate;
    endDate = statementDates.endDate;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (viewMode === 'calendar') {
    return `${formatDate(start)} - ${formatDate(end)}`;
  } else {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
}

/**
 * Get start and end dates for the quarter of the given date
 * @param date - The date to get the quarter for
 * @returns Object with start and end Date objects
 */
export function getQuarterDates(date: Date): { start: Date; end: Date } {
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1);
  const end = new Date(date.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
  return { start, end };
}
