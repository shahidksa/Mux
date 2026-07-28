import { useMemo } from 'react';
import { APP_CONSTANTS } from '../config/constants';
import { computeGoalDynamicBalance } from '../utils/goalBalanceEngine';
import { aggregateDataByTimeframe } from '../utils/aggregateDataByTimeframe';

export function useFinancialMetrics(
  transactions: any[] = [],
  baseCurrency: string = 'USD',
  fxRate: number = 1,
  settings: any = {},
  categories: any[] = [],
  savingsGoals: any[] = [],
  walletBalances: number = 0,
) {
  return useMemo(() => {
    const incomeTx = transactions.filter(t => t.type?.toLowerCase() === 'income');
    const realExpenseTransactions = transactions.filter(t =>
      t.type === 'expense' &&
      t.category !== 'Savings Transfer' &&
      t.category !== 'Transfer'
    );

    const totalIncomeCents = incomeTx.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const totalOutflowCents = realExpenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const netCashflowCents = totalIncomeCents - totalOutflowCents;
    const totalLiquidReservesCents = walletBalances > 0 ? walletBalances : totalIncomeCents - totalOutflowCents;

    const lockedGoalBalancesCents = savingsGoals.reduce((sum, g) => sum + computeGoalDynamicBalance(g.name, transactions), 0);

    const targetBaseCents = totalIncomeCents > 0 ? Math.floor(totalIncomeCents / 30) : 0;
    const burnVelocityCents = totalOutflowCents > 0 ? Math.floor(totalOutflowCents / 14) : 0;
    const isOverBurning = burnVelocityCents > targetBaseCents;

    const availablePoolCents = Math.max(0, totalLiquidReservesCents - lockedGoalBalancesCents);
    const safetyFloorCents = settings?.safetyFloor ?? APP_CONSTANTS.DEFAULT_SAFETY_FLOOR;
    const capitalShieldCents = settings?.capitalShield ?? APP_CONSTANTS.DEFAULT_LOCKED_SAVINGS;

    const autoSweepSurplusCents = Math.max(0, totalLiquidReservesCents - safetyFloorCents - capitalShieldCents);

    const lockedSavingsCents = capitalShieldCents;
    const availableCashCents = Math.max(0, availablePoolCents - lockedSavingsCents);

    const lockedPercent = availablePoolCents > 0 ? Math.min(100, Math.round((lockedSavingsCents / availablePoolCents) * 100)) : 0;
    const availablePercent = availablePoolCents > 0 ? Math.max(0, 100 - lockedPercent) : 0;

    const trueAvailableCashCents = Math.max(0, availablePoolCents - capitalShieldCents);

    const rawRatio = trueAvailableCashCents > 0 ? Math.round((autoSweepSurplusCents / Math.max(1, trueAvailableCashCents)) * 100) : 0;
    const efficiencyScore = Math.floor(rawRatio);

    const overBurnSpeedCents = Math.max(0, burnVelocityCents - targetBaseCents);

    const totalWealthPoolCents = availablePoolCents;
    const transactionCount = transactions.length;

    const dailyDataCents = aggregateDataByTimeframe(transactions, 'day', 7);

    const categoryMap: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type === 'expense' && t.category !== 'Savings Transfer' && t.category !== 'Transfer') {
        const catName = t.category || 'General';
        categoryMap[catName] = (categoryMap[catName] || 0) + Math.abs(Number(t.amount) || 0);
      }
    });
    const categoryChartData = Object.keys(categoryMap).map(key => ({
      name: key,
      value: categoryMap[key]
    }));
    return {
      totalIncome: totalIncomeCents,
      totalOutflow: totalOutflowCents,
      netCashflow: netCashflowCents,
      totalLiquidReserves: totalLiquidReservesCents,
      availableCash: availableCashCents,
      lockedSavings: lockedSavingsCents,
      availablePercent,
      lockedPercent,
      targetBase: targetBaseCents,
      burnVelocityRate: burnVelocityCents,
      isOverBurning,
      safetyFloor: safetyFloorCents,
      capitalShield: capitalShieldCents,
      totalWealthPool: totalWealthPoolCents,
      transactionCount,
      dailyData: dailyDataCents,
      categoryChartData,
      autoSweepSurplus: autoSweepSurplusCents,
      overBurnSpeed: overBurnSpeedCents,
      efficiencyScore,
    };
  }, [transactions, baseCurrency, fxRate, settings, categories, savingsGoals, walletBalances]);
}
