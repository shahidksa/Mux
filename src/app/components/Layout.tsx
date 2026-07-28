import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

export function Layout({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 flex overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 min-w-0 p-2 sm:p-3 md:p-4 lg:p-6 h-full overflow-y-auto browser-scroll">
        <div className="w-full max-w-[1780px] mx-auto flex flex-col justify-start space-y-3">
          <Outlet context={{ setActiveTab }} />
        </div>
      </main>
    </div>
  );
}
