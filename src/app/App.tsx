import { useEffect, useState, useMemo } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { ExpenseProvider } from './context/ExpenseContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { AllocationProvider } from './context/AllocationContext';
import { Toaster } from './components/ui/sonner';
import { seedCurrencies } from './seeds/currencies';
import { seedDefaultData } from '../seed';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { AddExpense } from './pages/AddExpense';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Transfer } from './pages/Transfer';
import { Reports } from './pages/Reports';

// FIX 1 + FIX 2: Merged AppRoutes and AppRoutesWrapper into one component so that:
//   - budgetSurplusRuleState lives in the same scope as ExpenseProvider (Fix 2)
//   - createBrowserRouter is wrapped in useMemo to prevent recreation on every render (Fix 1)
// Previously, AppRoutesWrapper always passed budgetSurplusRule="wallet" (hardcoded) to
// ExpenseProvider because budgetSurplusRuleState was only available inside AppRoutes (a child).
function AppWithRouter() {
  const {
    safetyFloor,
    capitalShield,
    setSafetyFloor,
    setCapitalShield,
    exchangeRates,
    baseCurrency,
    sweepPercentage,      // FIX: was incorrectly named sweepAllocationRatio (doesn't exist in SettingsContext)
    setSweepPercentage,   // FIX: was incorrectly named setSweepAllocationRatio
    sweepFrequency,
  } = useSettings();

  // FIX 2: State now lives here — both ExpenseProvider and the router elements can access it
  const [budgetSurplusRuleState, setBudgetSurplusRuleState] = useState<'wallet' | 'sweep'>('wallet');

  // FIX 1: useMemo prevents router recreation on every render.
  // Router is only recreated when the values passed to route elements actually change.
  const router = useMemo(() => createBrowserRouter([
    {
      path: '/',
      Component: Layout,
      children: [
        { index: true, element: <Dashboard safetyFloor={safetyFloor} lockedSavings={capitalShield} budgetSurplusRule={budgetSurplusRuleState} /> },
        { path: 'expenses', Component: Expenses },
        { path: 'add', Component: AddExpense },
        { path: 'edit/:id', Component: AddExpense },
        { path: 'transfer', Component: Transfer },
        { path: 'analytics', element: <Analytics safetyFloor={safetyFloor} lockedSavings={capitalShield} budgetSurplusRule={budgetSurplusRuleState} sweepRatio={sweepPercentage} /> },
        { path: 'reports', Component: Reports },
        { path: 'settings', element: <Settings safetyFloor={safetyFloor} setSafetyFloor={setSafetyFloor} lockedSavings={capitalShield} setLockedSavings={setCapitalShield} budgetSurplusRule={budgetSurplusRuleState} setBudgetSurplusRule={setBudgetSurplusRuleState} sweepAllocationRatio={sweepPercentage} setSweepAllocationRatio={setSweepPercentage} /> },
      ],
    },
  ]), [safetyFloor, capitalShield, budgetSurplusRuleState, sweepPercentage, setSafetyFloor, setCapitalShield, setSweepPercentage]);

  return (
    // FIX 2: budgetSurplusRuleState (not hardcoded "wallet") is now passed to ExpenseProvider
    <ExpenseProvider
      safetyFloor={safetyFloor}
      lockedSavings={capitalShield}
      budgetSurplusRule={budgetSurplusRuleState}
      exchangeRates={exchangeRates}
      baseCurrency={baseCurrency}
      sweepPercentage={sweepPercentage}
      sweepFrequency={sweepFrequency}
    >
      <AllocationProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AllocationProvider>
    </ExpenseProvider>
  );
}

export default function App() {
  useEffect(() => {
    seedCurrencies();
    seedDefaultData();
  }, []);

  return (
    <ThemeProvider>
      <SettingsProvider>
        <AppWithRouter />
      </SettingsProvider>
    </ThemeProvider>
  );
}
