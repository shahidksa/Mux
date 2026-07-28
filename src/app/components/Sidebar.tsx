import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Receipt, PlusCircle, PieChart, Settings, ArrowRightLeft, Moon, Sun, FileText } from 'lucide-react';
import { cn } from './ui/utils';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/expenses', label: 'Transactions', icon: Receipt },
  { path: '/add', label: 'Add Transaction', icon: PlusCircle },
  { path: '/transfer', label: 'Transfer', icon: ArrowRightLeft },
  { path: '/analytics', label: 'Analytics', icon: PieChart },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { isDarkMode, setIsDarkMode } = useTheme();

  return (
    <aside className="shrink-0 w-64 bg-sidebar-bg border-r border-border-main h-screen sticky top-0 transition-colors duration-300">
      <div className="p-6">
        <h1 className="font-bold text-2xl text-blue-600">ClearSum</h1>
        <p className="text-sm text-text-secondary mt-1">Private, Offline Wealth & Budget Tracker for Windows</p>
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)} 
          className="p-2 rounded-xl border border-border-main bg-bg-input text-text-primary hover:scale-105 transition-all text-xs flex items-center gap-2 mt-3 w-full justify-center"
        >
          {isDarkMode ? <><Sun className="w-4 h-4" /> Light Mode</> : <><Moon className="w-4 h-4" /> Dark Mode</>}
        </button>
      </div>
      
      <nav className="px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" 
                  : "text-text-secondary hover:bg-bg-input"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
