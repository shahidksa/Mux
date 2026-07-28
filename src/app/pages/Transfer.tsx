import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useExpenses } from '../context/ExpenseContext';
import { useSettings } from '../context/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { convertCurrency, DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import { formatMoney, parseDollarsToCents } from '../utils/monetary';
import { db } from '../../db';

export function Transfer() {
  const navigate = useNavigate();
  const { wallets, transferFunds, addTransfer, refreshWallets } = useExpenses();
  const { baseCurrency, exchangeRates } = useSettings();
  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;
  const fxRate = baseCurrency === 'USD' ? 1 : convertCurrency(1, 'USD', baseCurrency, rates);

  const [fromWallet, setFromWallet] = useState('');
  const [toWallet, setToWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  

  const selectedFromWallet = wallets.find(w => w.id === Number(fromWallet));
  const selectedToWallet = wallets.find(w => w.id === Number(toWallet));

  const convertedAmount = (() => {
    if (!selectedFromWallet || !selectedToWallet || !amount) return null;
    const fromCurrency = selectedFromWallet.currency || baseCurrency;
    const toCurrency = selectedToWallet.currency || baseCurrency;
    if (fromCurrency === toCurrency) return null;
    const numAmount = parseFloat(amount) || 0;
    return convertCurrency(numAmount, fromCurrency, toCurrency, rates);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!fromWallet || !toWallet || !amount) {
      toast.error('Please fill in all fields');
      setIsSubmitting(false);
      return;
    }

    if (fromWallet === toWallet) {
      toast.error('Cannot transfer to the same wallet');
      setIsSubmitting(false);
      return;
    }

    const transferAmountCents = parseDollarsToCents(amount);
    if (transferAmountCents <= 0) {
      toast.error('Amount must be greater than 0');
      setIsSubmitting(false);
      return;
    }

    if (selectedFromWallet && selectedFromWallet.balance < transferAmountCents) {
      toast.error('Insufficient balance');
      setIsSubmitting(false);
      return;
    }

    try {
      const fromId = Number(fromWallet);
      const toId = Number(toWallet);
      await transferFunds(fromId, toId, transferAmountCents);

      const { id, ...cleanTransfer } = {
        source_wallet_id: fromId,
        destination_wallet_id: toId,
        amount: transferAmountCents,
        created_at: new Date().toISOString()
      };

      const transferId = await db.transfers.add(cleanTransfer);
      console.log('Transfer logged with ID:', transferId);

      await refreshWallets();

      toast.success('Transfer successful');
      navigate('/expenses');
    } catch {
      toast.error('Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (wallets.length < 2) {
    return (
<div className="space-y-6 ml-0 md:ml-6 lg:ml-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-text-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <Card className="bg-bg-card border border-border-main rounded-xl shadow-sm">
          <CardContent className="pt-6 text-center">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 text-text-muted" />
            <h2 className="text-xl font-semibold mb-2 text-text-primary">Need More Wallets</h2>
            <p className="text-text-muted mb-4">You need at least 2 wallets to transfer funds.</p>
            <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-text-secondary">
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>

      <div className="w-full h-auto flex flex-col justify-start items-start mt-3 ml-0 md:ml-4 lg:ml-6">
          <div>
            <h1 className="text-3xl font-bold">Transfer Funds</h1>
            <p className="text-text-secondary mt-1">Move money between your wallets</p>
          </div>

      <div className="max-w-xl w-full bg-white dark:bg-card border border-slate-100 dark:border-slate-700/50 p-6 rounded-xl shadow-md mt-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Transfer Details
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-4">
          Move money between your wallets safely
        </p>

        <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              From Wallet *
            </label>
            <Select
              value={fromWallet}
              onValueChange={(value) => setFromWallet(value)}
            >
              <SelectTrigger className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                <SelectValue placeholder="Select source wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(wallet => (
                  <SelectItem key={wallet.id} value={String(wallet.id)}>
                    {wallet.name} - {formatMoney(wallet.balance, baseCurrency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFromWallet && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Available: {formatMoney(selectedFromWallet.balance, baseCurrency)}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              To Wallet *
            </label>
            <Select
              value={toWallet}
              onValueChange={(value) => setToWallet(value)}
            >
              <SelectTrigger className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                <SelectValue placeholder="Select destination wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets
                  .filter(w => String(w.id) !== fromWallet)
                  .map(wallet => (
                    <SelectItem key={wallet.id} value={String(wallet.id)}>
                      {wallet.name} - {formatMoney(wallet.balance, baseCurrency)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 dark:bg-card text-slate-900 dark:text-slate-100 font-medium text-sm p-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
            />
            
            {selectedFromWallet && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const percentage = 25;
                    const balanceInDollars = selectedFromWallet.balance / 100;
                    const calculatedAmount = (balanceInDollars * percentage) / 100;
                    setAmount(calculatedAmount.toFixed(2));
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const percentage = 50;
                    const balanceInDollars = selectedFromWallet.balance / 100;
                    const calculatedAmount = (balanceInDollars * percentage) / 100;
                    setAmount(calculatedAmount.toFixed(2));
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const percentage = 75;
                    const balanceInDollars = selectedFromWallet.balance / 100;
                    const calculatedAmount = (balanceInDollars * percentage) / 100;
                    setAmount(calculatedAmount.toFixed(2));
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const percentage = 100;
                    const balanceInDollars = selectedFromWallet.balance / 100;
                    const calculatedAmount = (balanceInDollars * percentage) / 100;
                    setAmount(calculatedAmount.toFixed(2));
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  100%
                </button>
              </div>
            )}
            
            {convertedAmount !== null && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                Recipient will receive: {formatMoney(convertedAmount, baseCurrency)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm p-3 rounded-xl transition-all duration-200 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing Transfer...' : 'Transfer'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="bg-transparent border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium text-sm px-5 py-3 rounded-xl transition-all duration-200"
          >
            Cancel
          </button>
        </div>
        </form>
      </div>
      </div>
    </div>
  );
}
