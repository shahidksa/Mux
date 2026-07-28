import { db } from '../../db';
import { toast } from 'sonner';
import { toLocalDateString } from '../../utils/dates';

export const fastForwardSystemClock = async (days: number) => {
  const allExpenses = await db.expenses.toArray();
  const updates = allExpenses.map(exp => {
    const parts = exp.date.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    return { ...exp, date: toLocalDateString(d) };
  });
  await db.transaction('rw', db.expenses, async () => {
    for (const u of updates) await db.expenses.put(u);
  });
  const label = days === 1 ? 'day' : 'days';
  toast.success(`System clock advanced +${days} ${label} (${updates.length} expenses updated)`);
};
