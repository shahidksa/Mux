import { format, startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

type Timeframe = 'day' | 'week' | 'month';

interface AggregatedPoint {
  date: string;
  income: number;
  expense: number;
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  
  const trimmed = dateStr.trim();
  
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(Number);
    if (parts.length >= 3 && !parts.some(isNaN)) {
      return new Date(parts[2], parts[0] - 1, parts[1]);
    }
  }
  
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-').map(Number);
    if (parts.length >= 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  
  return new Date(NaN);
}

function getBucketKey(date: Date, timeframe: Timeframe): string {
  switch (timeframe) {
    case 'day':
      return format(startOfDay(date), 'yyyy-MM-dd');
    case 'week':
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    case 'month':
      return format(startOfMonth(date), 'yyyy-MM');
    default:
      return format(startOfDay(date), 'yyyy-MM-dd');
  }
}

function getDisplayLabel(date: Date, timeframe: Timeframe): string {
  switch (timeframe) {
    case 'day':
      return format(date, 'MMM dd');
    case 'week':
      return format(date, 'MMM dd');
    case 'month':
      return format(date, 'MMM yyyy');
    default:
      return format(date, 'MMM dd');
  }
}

export function aggregateDataByTimeframe(
  transactions: any[],
  timeframe: Timeframe = 'day',
  bucketCount: number = 7,
): AggregatedPoint[] {
  const buckets = new Map<string, { income: number; expense: number; refDate: Date }>();

  const now = new Date();
  for (let i = bucketCount - 1; i >= 0; i--) {
    let refDate: Date;
    switch (timeframe) {
      case 'week':
        refDate = subWeeks(now, i);
        break;
      case 'month':
        refDate = subMonths(now, i);
        break;
      default:
        refDate = subDays(now, i);
    }
    const key = getBucketKey(refDate, timeframe);
    buckets.set(key, { income: 0, expense: 0, refDate });
  }

  for (const t of transactions) {
    const txDate = t.date ? parseLocalDate(t.date) : null;
    if (!txDate || isNaN(txDate.getTime())) continue;

    const key = getBucketKey(txDate, timeframe);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    if (t.type?.toLowerCase() === 'income') {
      bucket.income += Math.abs(t.amount || 0);
    } else if (t.type === 'expense' && t.category !== 'Savings Transfer' && t.category !== 'Transfer') {
      bucket.expense += Math.abs(t.amount || 0);
    }
  }

  return Array.from(buckets.values()).map(b => ({
    date: getDisplayLabel(b.refDate, timeframe),
    income: b.income,
    expense: b.expense,
  }));
}
