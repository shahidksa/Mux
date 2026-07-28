import { useEffect } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#111827]/40 border border-slate-800/80 rounded-2xl shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-slate-700 bg-gradient-to-r from-[#0f172a] to-[#1e293b] rounded-t-2xl">
          <span className="text-base sm:text-lg font-bold tracking-wide text-cyan-400 uppercase">📘 ClearSum User & Screen Features Guide</span>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-base transition cursor-pointer">✕</button>
        </div>
        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-slate-300 leading-relaxed">Welcome to ClearSum — your private, offline wealth and budget tracker. This guide breaks down the core financial logic, calculation engines, and features of each dashboard screen to help you optimize your capital allocation.</p>
        </div>
        <div className="p-6 pt-2 space-y-7 text-base text-slate-200 leading-relaxed">

          <section>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide text-emerald-400 mb-4 flex items-center gap-2"><span>🏛️</span> The Top Global Guardrails Row</h3>
            <p className="text-sm text-slate-300 mb-4">Visible across all core screens, this operational summary row helps you keep track of your cash safety margins in real-time.</p>
            <div className="space-y-3">
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">🛡️ Safety Floor</span>
                <span className="text-sm text-slate-300">A user-defined, non-negotiable cash reserve kept in your primary checking or wallet account. This money is never touched by automation engines and serves as your baseline emergency fallback.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">🔒 Capital Shield</span>
                <span className="text-sm text-slate-300">A secondary buffer allocation used to isolate funds for mandatory upcoming short-term liabilities (e.g., subscription bills or rent protection).</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">🟩 Surplus</span>
                <span className="text-sm text-slate-300">The amount of unassigned, flexible cash left over after your safety buffers are fully subtracted from your total liquidity pool.</span>
                <p className="font-mono bg-[#0f172a] p-2.5 rounded mt-2 text-sm text-emerald-400">Surplus = Wallet Balance − Safety Floor − Capital Shield</p>
                <span className="text-xs text-slate-400 mt-1.5 block">Note: Income and expenses affect the wallet balance, which in turn affects surplus. The sweep engine allocates a percentage of surplus (default 5%) into your savings goals.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">📈 Wealth Efficiency</span>
                <span className="text-sm text-slate-300">A metric tracking how effectively your capital is being routed into active savings goals rather than sitting unallocated. A score of 100%+ (Optimal) means your surplus liquid cash is safely positioned to generate long-term momentum.</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide text-emerald-400 mb-4 flex items-center gap-2"><span>💱</span> Base Currency & Conversion</h3>
            <div className="space-y-3">
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">How Currency Storage Works</span>
                <span className="text-sm text-slate-300">All wallet balances, transactions, savings goals, and budgets are stored in your base currency as raw integer cents. When you switch currency, every stored value is multiplied by the exchange rate ratio so your numbers reflect the new currency accurately.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Compact Number Display</span>
                <span className="text-sm text-slate-300">To prevent layout overflow with high-value currencies (e.g., PKR, INR), the dashboard automatically abbreviates large numbers. Values above 9,999,999 display in compact notation (e.g., ₨12.50M), while smaller values show full comma-separated figures (e.g., ₨3,336,000).</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide text-emerald-400 mb-4 flex items-center gap-2"><span>📊</span> Screen 1: Main Dashboard</h3>
            <div className="space-y-3">
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">1. Live Cash Liquidity Card</span>
                <span className="text-sm text-slate-300 mb-2 block">Visualizes exactly how your current wealth is categorized, separating deployable assets from guarded funds.</span>
                <ul className="ml-4 space-y-1.5 text-sm text-slate-300">
                  <li><span className="text-white font-semibold">Total Net Worth:</span> Combined value of all wallets plus locked savings goal balances.</li>
                  <li><span className="text-white font-semibold">Total Wallet Balance:</span> The raw liquid cash sitting across all connected bank accounts, cards, and physical cash wallets.</li>
                </ul>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">2. Month Spending Pacing Card</span>
                <span className="text-sm text-slate-300 mb-2 block">An algorithmic pacing widget that measures your daily spending speed against your long-term budget parameters.</span>
                <ul className="ml-4 space-y-1.5 text-sm text-slate-300">
                  <li><span className="text-white font-semibold">Burn Velocity:</span> The average amount of money leaving your accounts per day during the current calendar month.</li>
                  <li><span className="text-white font-semibold">Target Base:</span> Your maximum allowed daily spending speed calculated to keep your long-term wealth trajectory safe.</li>
                </ul>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">3. Capital Allocation Simulator</span>
                <span className="text-sm text-slate-300">Interactive sliders to model what-if allocation scenarios (spending, savings, investments, debt, charity). Includes a projected annual return forecast based on your modeled savings rate.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">4. Cashflow Trend Chart</span>
                <span className="text-sm text-slate-300">Area chart showing income vs. expense trends over the last 7 days. Switch to Analytics for a 6-month monthly view.</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide text-emerald-400 mb-4 flex items-center gap-2"><span>📈</span> Screen 2: Advanced Analytics</h3>
            <div className="space-y-3">
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Expenses by Category & Wallet</span>
                <span className="text-sm text-slate-300">Interactive donut charts that break down your spending footprint with exact allocation percentages.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Projected Auto-Sweep Surplus</span>
                <span className="text-sm text-slate-300">Displays the exact amount the automation engine will move into your goals during its next sweep. The sweep calculates against your dynamic surplus, not your static income, so it automatically scales down if you spend mid-week.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Budget Performance Report</span>
                <span className="text-sm text-slate-300">Table showing spent vs. configured limit per category with utilization percentage and over-budget alerts.</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide text-emerald-400 mb-4 flex items-center gap-2"><span>🛠️</span> Screen 3: Settings & Guardrail Configuration</h3>
            <div className="space-y-3">
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Automated Liquidity Guardrails</span>
                <span className="text-sm text-slate-300 mb-2 block">Configure your Safety Floor, Capital Shield, Sweep Ratio %, and Sweep Frequency. Save activates the values into the automation engine.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">⏱️ Protected Auto-Sweep Cooldown Guards</span>
                <span className="text-sm text-slate-300 mb-2 block">To prevent automated transfers from looping or compounding unprompted, ClearSum operates a multi-frequency safety ledger:</span>
                <ul className="ml-4 space-y-1.5 text-sm text-slate-300">
                  <li><span className="text-white font-semibold">Daily Mode:</span> Runs once per day, then enforces a strict cooldown lock until midnight.</li>
                  <li><span className="text-white font-semibold">Weekly Mode:</span> Runs once, then enforces a strict 7-day cooldown lock.</li>
                  <li><span className="text-white font-semibold">Monthly Mode:</span> Runs once, then locks until the next calendar month.</li>
                </ul>
                <span className="text-xs text-slate-400 mt-2 block">UI Cycling Protection: Toggling between frequencies updates your visual selection but the engine refuses to issue duplicate transfers if a sweep already ran within its cooldown window.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Exchange Rate Settings</span>
                <span className="text-sm text-slate-300">Choose between automatic API rates or manual override. Supported currencies: USD, EUR, GBP, JPY, CNY, INR, PKR, and more.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Export Reports</span>
                <span className="text-sm text-slate-300">Generate PDF or Excel exports of your transaction ledger, budget performance, and system audit log.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Database Reset</span>
                <span className="text-sm text-slate-300">Wipes all locally stored data. Use this to start fresh after testing or currency experiments.</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide text-emerald-400 mb-4 flex items-center gap-2"><span>🔐</span> Privacy & Technical Framework</h3>
            <div className="space-y-3">
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">100% Local — No Cloud, No Tracking</span>
                <span className="text-sm text-slate-300">ClearSum never connects to any remote server. There are no analytics trackers, no telemetry, no cookies, and no third-party network calls. All your financial data lives exclusively in your browser's IndexedDB storage on your local device.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">⚠️ Important: Clearing Browser Data Will Erase Everything</span>
                <span className="text-sm text-slate-300">Because all data is stored locally in IndexedDB, clearing your browser cache, cookies, or site data <strong className="text-white">will permanently delete all your transactions, wallets, goals, and settings</strong>. There is no cloud backup or recovery option. Before clearing browser data, use the <strong className="text-cyan-300">Data Backup & Restore</strong> feature in Settings to export a JSON backup file that can be restored later.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Storage Architecture</span>
                <span className="text-sm text-slate-300">Powered by Dexie.js — a high-performance IndexedDB wrapper with transactional safety. Your data persists across browser sessions and reboots as long as you don't clear site data.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Integer Precision Math</span>
                <span className="text-sm text-slate-300">All values stored as integer cents to eliminate floating-point rounding errors. Currencies like JPY use 0 decimal places; PKR/USD use 2.</span>
              </div>
              <div className="bg-[#111827] border border-slate-700 rounded-xl p-5">
                <span className="font-bold text-cyan-400 block mb-1.5 text-sm">Audit Log</span>
                <span className="text-sm text-slate-300">Deleted transactions and savings goals are recorded in the audit log with the reason for deletion. System operations (auto-sweeps, manual sweeps) are excluded from this log.</span>
              </div>
            </div>
          </section>

          <div className="text-xs text-slate-400 text-center pt-3 pb-5 border-t border-slate-700">
            All calculations use live IndexedDB data and update in real time. Compact currency display kicks in above 9,999,999.
          </div>
        </div>
      </div>
    </div>
  );
}
