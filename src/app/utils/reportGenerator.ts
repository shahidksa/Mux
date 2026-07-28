export function filterRecentTransactions<T extends { date: string }>(allTransactions: T[]): T[] {
  const today = new Date();
  const past7DaysDate = new Date();
  past7DaysDate.setDate(today.getDate() - 7);

  return allTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= past7DaysDate && txDate <= today;
  });
}
