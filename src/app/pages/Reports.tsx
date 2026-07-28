import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAnnualLedgerSnapshot } from '../../db';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { formatMoney } from '../utils/monetary';
import { CURRENCY_SYMBOLS } from '../utils/currency';
import { parseLocalDate } from '../../utils/dates';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { stripEmoji } from '../utils/pdfGenerator';
import { computeGoalDynamicBalance } from '../utils/goalBalanceEngine';
import { OVERRIDE_SWEPT, getClosureClass, computeGoalLifecycleData } from '../utils/goalLifecycle';
import { format } from 'date-fns';

// Shared CSS template for all report print windows with proper scrolling
const getReportStyles = (isDarkMode: boolean) => `
  <style>
    /* Base reset */
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      padding: 0; margin: 0; line-height: 1.5; 
      background: ${isDarkMode ? '#0f172a' : '#f1f5f9'}; 
      color: ${isDarkMode ? '#f1f5f9' : '#1e293b'}; 
      font-size: 13px; 
    }
    html, body { height: 100vh; overflow: hidden; }

/* Print toolbar - fixed at top */
    .print-toolbar { 
      background: ${isDarkMode ? '#1e293b' : '#f8fafc'}; 
      border-bottom: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}; 
      padding: 12px 0; margin-bottom: 20px; 
      display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; 
      position: sticky; top: 0; z-index: 100; 
    }
    
    /* no-print class - hides elements in print mode */
    .no-print {
      display: block;
    }
    
    @media print {
      .no-print {
        display: none !important;
      }
    }
    
    .toolbar-btn { 
      padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; 
      cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; 
    }
    .toolbar-btn:hover { background: #2563eb; transform: translateY(-1px); }

    /* Main report container - full height flex column */
    .report-screen-container { 
      width: 100%; height: 100vh; 
      display: flex; flex-direction: column; 
      background: ${isDarkMode ? '#0f172a' : '#f1f5f9'};
    }

/* Content area - scrollable */
     .report-content-scroll { 
       flex: 1; overflow: auto !important; 
       display: flex; flex-direction: column; 
       min-height: 0 !important; padding: 0 16px 16px 16px;
       align-items: center; /* center the zoomWrapper horizontally */
     }
     .report-content-scroll.fit-to-screen { overflow: hidden !important; }

    /* Zoom wrapper - the document sheet */
    #zoomWrapper { 
      max-width: 72rem; margin: 0 auto; 
      padding: 1rem; 
      background: ${isDarkMode ? '#0f172a' : '#ffffff'}; 
      box-shadow: 0 25px 50px -12px rgba(0,0,0,${isDarkMode ? '0.5' : '0.1'}); 
      border-radius: 2px; 
      display: flex; flex-direction: column; gap: 1rem;
      transition: transform 0.2s; 
      width: 100%; /* allow full width when fit-to-screen */
      box-sizing: border-box;
    }
    #zoomWrapper.fit-to-screen { max-width: none !important; width: auto !important; }

    /* Header section - fixed within content */
    .header { 
      border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 6px; 
      flex-shrink: 0;
    }
    .title { font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; color: ${isDarkMode ? '#60a5fa' : '#1e3a8a'}; }
    .subtitle { font-size: 12px; margin-top: 4px; font-weight: 500; color: ${isDarkMode ? '#94a3b8' : '#4b5563'}; }

    /* KPI Grid - fixed */
    .kpi-grid { display: flex; gap: 8px; margin-bottom: 12px; flex-shrink: 0; }
    .kpi-card { flex: 1; padding: 10px; border-radius: 4px; border: 1px solid ${isDarkMode ? '#334155' : '#e5e7eb'}; background: ${isDarkMode ? '#1e293b' : '#f9fafb'}; min-height: 0; }
    .kpi-title { font-size: 10px; font-weight: 600; text-transform: uppercase; color: ${isDarkMode ? '#94a3b8' : '#4b5563'}; }
    .kpi-val { font-size: 18px; font-weight: 800; margin-top: 2px; color: ${isDarkMode ? '#60a5fa' : '#1e3a8a'}; }

    /* Section titles */
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; padding-bottom: 4px; margin: 16px 0 8px 0; letter-spacing: 0.5px; color: ${isDarkMode ? '#60a5fa' : '#1e3a8a'}; flex-shrink: 0; }

    /* TABLE SCROLL CONTAINERS - Each table scrolls independently */
    .table-scroll-container { 
      max-height: 280px; overflow-y: auto; overflow-x: auto;
      position: relative; border-radius: 6px; border: 1px solid #e5e7eb;
      margin-bottom: 10px;
    }
    .dark .table-scroll-container { border-color: #4b5563; }
    
/* Different heights for different tables */
.table-scroll-container.budget-scroll { max-height: 240px; }
.table-scroll-container.activity-scroll { max-height: 320px; }
.table-scroll-container.audit-scroll { max-height: 200px; }

/* Tables */
.table-scroll-container {
  overflow-y: auto !important;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch !important;
  flex-shrink: 0;
  min-height: 0;
}
table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; font-size: 12px; }
th { 
  font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 8px 6px !important; 
  background: ${isDarkMode ? '#1e3a5f' : '#1e3a8a'}; color: ${isDarkMode ? '#e2e8f0' : '#ffffff'}; 
  border-bottom: 2px solid #3b82f6; width: auto !important; text-align: left !important; 
}
    td { padding: 6px 6px !important; border-bottom: 1px solid ${isDarkMode ? '#334155' : '#e5e7eb'}; color: ${isDarkMode ? '#cbd5e1' : '#1e293b'}; width: auto !important; text-align: left !important; font-size: 12px; }
    table tr:nth-child(even) td { background: ${isDarkMode ? 'rgba(30,41,59,0.5)' : '#f8fafc'}; }

    /* Sticky headers within scroll containers */
    .table-scroll-container thead {
      position: sticky;
      top: 0;
      z-index: 20;
      background: white;
    }
    .dark .table-scroll-container thead {
      background: #1f2937;
    }

    /* Badges */
    .badge { padding: 3px 8px; font-size: 12px; font-weight: 700; border-radius: 4px; }
    .badge-over { background: ${isDarkMode ? '#7f1d1d' : '#fee2e2'}; color: ${isDarkMode ? '#fecaca' : '#991b1b'}; }
    .badge-safe { background: ${isDarkMode ? '#064e3b' : '#d1fae5'}; color: ${isDarkMode ? '#a7f3d0' : '#065f46'}; }
    .subcategory-badge { background: ${isDarkMode ? '#1e3a5f' : '#dbeafe'}; color: ${isDarkMode ? '#93c5fd' : '#1e40af'}; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 4px; font-weight: 600; border: 1px solid ${isDarkMode ? '#3b82f6' : '#bfdbfe'}; }
    .audit-reason { background: ${isDarkMode ? '#713f12' : '#fef3c7'}; color: ${isDarkMode ? '#fde68a' : '#92400e'}; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; border: 1px solid ${isDarkMode ? '#a16207' : '#fde68a'}; }

    /* Force scroll in all modes (including fit-to-screen/zoom) */
    .report-screen-container.fit-to-screen .table-scroll-container {
      max-height: 300px !important;
      overflow-y: auto !important;
      height: auto !important;
    }
    .report-screen-container.fit-to-screen {
      overflow: visible !important;
      height: auto !important;
      max-height: 100vh !important;
    }

    /* Custom scrollbars */
    .table-scroll-container::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .table-scroll-container::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    .table-scroll-container::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 3px;
    }
    .table-scroll-container::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
    .dark .table-scroll-container::-webkit-scrollbar-track {
      background: #374151;
    }
    .dark .table-scroll-container::-webkit-scrollbar-thumb {
      background: #6b7280;
    }
    .dark .table-scroll-container::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    /* Firefox scrollbars */
    .table-scroll-container { scrollbar-width: thin; scrollbar-color: #888 #f1f1f1; }
    .dark .table-scroll-container { scrollbar-color: #6b7280 #374151; }

/* Print media */
@media print {
  /* Hide interactive elements */
  .no-print, .print-toolbar {
    display: none !important;
  }
  
  /* COMPLETELY REMOVE ALL SCROLL CONTAINERS - AGGRESSIVE */
  .report-content-scroll,
  .table-scroll-container,
  .budget-scroll,
  .activity-scroll,
  .audit-scroll,
  .overflow-y-auto,
  .overflow-y-scroll,
  .overflow-auto,
  [class*="max-h-"],
  [class*="overflow-y"],
  [class*="overflow-x"],
  [class*="overflow-"] {
    max-height: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    overflow-y: visible !important;
    overflow-x: visible !important;
  }
  
  /* Force all table elements to display correctly */
  table {
    display: table !important;
    table-layout: fixed !important;
    width: 100% !important;
    border-collapse: collapse !important;
  }
  thead {
    display: table-header-group !important;
  }
  tbody {
    display: table-row-group !important;
  }
  tr {
    display: table-row !important;
  }
  th,
  td {
    display: table-cell !important;
    padding: 6px 6px !important;
    border-bottom: 1px solid ${isDarkMode ? '#334155' : '#e5e7eb'} !important;
  }
  
  /* Remove any parent overflow restrictions */
  .report-container,
  .report-content,
  .flex-1,
  .overflow-auto,
  .flex-col,
  .flex,
  .table-scroll-container {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    flex-direction: column !important;
    display: block !important;
  }
  
  /* Page breaks */
  .page-break {
    page-break-after: always;
  }
  
  .page-break-before {
    page-break-before: always;
  }
  
  .avoid-break {
    page-break-inside: auto !important;
  }
  
  /* Table headers repeat on each page */
  thead {
    display: table-header-group !important;
  }
  .table-scroll-container thead {
    position: static !important;
  }
  
  tbody {
    display: table-row-group !important;
  }
  
  tr {
    page-break-inside: avoid !important;
    page-break-after: auto;
  }
  
  /* Table breaks properly across pages */
  table {
    page-break-inside: auto !important;
  }
  
  /* Print margins */
  @page {
    margin: 1.5cm;
    size: A4;
  }
  
  /* Force colors for print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  
  /* Improve readability */
  body {
    font-size: 10pt;
    line-height: 1.4;
    color: #000 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  
  /* Dark mode override for print */
  .dark,
  .dark * {
    background-color: #fff !important;
    color: #000 !important;
    border-color: #ddd !important;
  }
  
  /* Remove max-width constraint */
  #zoomWrapper {
    max-width: none !important;
    margin: 0 !important;
    padding: 16px !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    display: block !important;
  }
  
  .report-screen-container {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
    display: block !important;
  }
  
  .report-content-scroll {
    overflow: visible !important;
    max-height: none !important;
    padding: 0 !important;
    display: block !important;
  }
  
  /* Ensure all containers are block-level for proper flow */
  .kpi-grid,
  .table-scroll-container,
  .section-title,
  .report-content-scroll,
  #zoomWrapper,
  .audit-scroll {
    display: block !important;
    page-break-inside: auto !important;
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
  }
  
  .title { font-size: 18px; }
  .section-title { font-size: 13px; }
  table { font-size: 12px; }
  th { font-size: 11px; padding: 9px 7px !important; background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 7px 7px !important; font-size: 11px; }
  .kpi-card { background: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .badge-over { background: #fee2e2 !important; color: #991b1b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .badge-safe { background: #d1fae5 !important; color: #065f46 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .subcategory-badge { background: #dbeafe !important; color: #1e40af !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .audit-reason { background: #fef3c7 !important; color: #92400e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

    /* Dark theme overrides (handled by body class) */
    body.dark-theme .print-toolbar { background: #1e293b; border-bottom-color: #334155; }
    body.dark-theme .toolbar-btn { background: #2563eb; }
    body.dark-theme .toolbar-btn:hover { background: #1d4ed8; }
    body.dark-theme .header { border-bottom-color: #3b82f6; }
    body.dark-theme .title { color: #60a5fa; }
    body.dark-theme .subtitle { color: #94a3b8; }
    body.dark-theme .section-title { color: #60a5fa; }
    body.dark-theme .kpi-card { background: #1e293b; border-color: #334155; }
    body.dark-theme .kpi-title { color: #94a3b8; }
    body.dark-theme .kpi-val { color: #60a5fa; }
    body.dark-theme th { background: #1e3a5f; color: #e2e8f0; border-bottom-color: #334155; }
    body.dark-theme td { color: #cbd5e1; border-bottom-color: #334155; }
    body.dark-theme table tr:nth-child(even) td { background: rgba(30,41,59,0.5); }
    body.dark-theme #zoomWrapper { background: #0f172a; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }

    body.light-theme .print-toolbar { background: #f8fafc; border-bottom-color: #e2e8f0; }
    body.light-theme .toolbar-btn { background: #3b82f6; }
    body.light-theme .toolbar-btn:hover { background: #2563eb; }
    body.light-theme .header { border-bottom-color: #3b82f6; }
    body.light-theme .title { color: #1e3a8a; }
    body.light-theme .subtitle { color: #4b5563; }
    body.light-theme .section-title { color: #1e3a8a; }
    body.light-theme .kpi-card { background: #f9fafb; border-color: #e5e7eb; }
    body.light-theme .kpi-title { color: #4b5563; }
    body.light-theme .kpi-val { color: #1e3a8a; }
    body.light-theme th { background: #1e3a8a; color: #ffffff; border-bottom-color: #3b82f6; }
    body.light-theme td { color: #334155; border-bottom-color: #e5e7eb; }
    body.light-theme table tr:nth-child(even) td { background: #f8fafc; }
    body.light-theme #zoomWrapper { background: #ffffff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1); }

    /* Metrics box for velocity report */
    .metrics-box { background: ${isDarkMode ? '#1e293b' : '#f1f5f9'}; border: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}; border-radius: 8px; padding: 16px; margin-top: 20px; flex-shrink: 0; }
    .metrics-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: ${isDarkMode ? '#60a5fa' : '#1e3a8a'}; margin-bottom: 12px; letter-spacing: 0.5px; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .metric-item { font-size: 11px; color: ${isDarkMode ? '#94a3b8' : '#334155'}; font-family: "Roboto Mono", monospace; }

    /* Audit section for velocity report */
    .audit-section { margin-top: 30px; flex: 1; overflow-y: auto; max-height: 400px; }
    .audit-entry { margin-bottom: 16px; padding: 12px; border-left: 3px solid #3b82f6; background: ${isDarkMode ? '#1e293b' : '#f8fafc'}; border-radius: 0 6px 6px 0; }
    .audit-header { font-weight: 700; font-size: 12px; color: ${isDarkMode ? '#60a5fa' : '#1e3a8a'}; margin-bottom: 6px; font-family: "Roboto Mono", monospace; }
    .audit-line { font-family: "Roboto Mono", monospace; font-size: 11px; color: ${isDarkMode ? '#94a3b8' : '#475569'}; line-height: 1.8; }
    .audit-fulfilled { color: ${isDarkMode ? '#34d399' : '#059669'}; font-weight: 700; }
    .audit-active { color: ${isDarkMode ? '#60a5fa' : '#2563eb'}; font-weight: 700; }
  </style>
`;

export function Reports() {
  const navigate = useNavigate();
  const { baseCurrency } = useSettings();
  const { isDarkMode } = useTheme();
  const baseCurrencySymbol = CURRENCY_SYMBOLS[baseCurrency] || '₨';
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [isFitToScreen, setIsFitToScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPrintPreview) {
        handleExitPrintPreview();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isPrintPreview]);

  const handleExitPrintPreview = () => {
    setIsPrintPreview(false);
    navigate('/');
  };

const scrollableDocumentScript = () => `
    <script>
      let zoomLevel = 1;

      function getZoomWrapper() {
        return document.getElementById('zoomWrapper');
      }

      function applyZoom() {
        const zoomWrapper = getZoomWrapper();
        if (!zoomWrapper) return;
        zoomWrapper.style.transform = 'scale(' + zoomLevel + ')';
        zoomWrapper.style.transformOrigin = 'top center';
      }

      function toggleFitToScreen() {
        const zoomWrapper = getZoomWrapper();
        const fitBtn = document.getElementById('fitToScreenBtn');
        if (!zoomWrapper) {
          console.log('zoomWrapper not found');
          return;
        }
        
        console.log('toggleFitToScreen called, zoomLevel:', zoomLevel);
        
        if (zoomLevel !== 1) {
          // Reset to normal
          zoomLevel = 1;
          zoomWrapper.style.maxWidth = '72rem';
          zoomWrapper.classList.remove('fit-to-screen');
          if (fitBtn) fitBtn.textContent = 'Fit to Screen';
        } else {
          // Fit to screen - temporarily remove max-width to measure natural content width
          const originalMaxWidth = zoomWrapper.style.maxWidth || '72rem';
          zoomWrapper.style.maxWidth = 'none';
          zoomWrapper.classList.add('fit-to-screen');
          
          // Force reflow to get natural width
          zoomWrapper.offsetWidth;
          
          const vpWidth = window.innerWidth - 48;
          const rect = zoomWrapper.getBoundingClientRect();
          const docWidth = rect.width;
          
          console.log('viewport width:', vpWidth, 'doc width:', docWidth);
          
          // Restore max-width
          zoomWrapper.style.maxWidth = originalMaxWidth;
          
          const scale = docWidth > 0 ? vpWidth / docWidth : 1;
          zoomLevel = Math.min(scale, 2.0); // Cap at 2x
          console.log('calculated scale:', scale, 'zoomLevel:', zoomLevel);
          
          if (fitBtn) fitBtn.textContent = 'Normal View';
        }
        applyZoom();
      }

      window.toggleFitToScreen = toggleFitToScreen;
      window.adjustZoom = function(delta) {
        zoomLevel = Math.max(0.3, Math.min(2.0, zoomLevel + delta));
        applyZoom();
      };
    </script>
`;

  const handleExportTimelinePDF = async (timeline: 'weekly' | 'monthly') => {
    setIsExporting(`pdf-${timeline}`);
    setIsPrintPreview(true);
    try {
      const allExpenses = await db.expenses.toArray();
      const wallets = await db.wallets.toArray();
      const budgets = await db.budgets.toArray();
      const allAuditLogs = await db.auditLogs.toArray();
      const baseCurrencySymbol = CURRENCY_SYMBOLS[baseCurrency] || '₨';

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dayRange = timeline === 'weekly' ? 7 : 30;
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - dayRange);

      const relevantExpenses = allExpenses.filter(e => {
        if (!e.date) return false;
        const txDate = parseLocalDate(e.date);
        return txDate >= cutoff && txDate <= now;
      });

      // For audit log, show ALL audit logs in the period (not filtered)
      const periodAuditLogs = allAuditLogs.filter(log => {
        const logDate = parseLocalDate(log.date);
        return logDate >= cutoff && logDate <= now;
      });

      const totalSpent = relevantExpenses.filter(e => String(e.type).toLowerCase() !== 'income').reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
      const totalIncome = relevantExpenses.filter(e => String(e.type).toLowerCase() === 'income').reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
      const totalBalance = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

      const windowName = `clearsum-report-${new Date().getTime()}`;
      // Open maximized - use screen dimensions and fullscreen features
      const printWindow = window.open('', windowName, 
        `width=${screen.width},height=${screen.height},screenX=0,screenY=0,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no,fullscreen=yes`);
      
      if (!printWindow || printWindow.closed || typeof printWindow.document === 'undefined') {
        console.error('Popup blocked or failed to open print window');
        toast.error('Popup blocked! Please allow popups for this site to generate reports.');
        setIsExporting(null);
        return;
      }

      // Ensure the window is focused
      printWindow.focus();

      const fmt = (amount: number) => formatMoney(amount, baseCurrency);

      // Helper function to get wallet name by ID
      const getWalletName = (walletId: number) => {
        const wallet = wallets.find(w => w.id === walletId);
        return wallet ? wallet.name : '—';
      };

      // Helper function to format category with subcategory
      const formatCategory = (category: string, subcategory?: string) => {
        if (subcategory) {
          return `${category} <span class="subcategory-badge">(${subcategory})</span>`;
        }
        return category;
      };

printWindow.document.write(`
        <html>
          <head>
            <title>ClearSum Financial Statement - ${timeline.toUpperCase()} REPORT</title>
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            ${getReportStyles(isDarkMode)}
            ${scrollableDocumentScript()}
           </head>
            <body class="${isDarkMode ? 'dark-theme' : 'light-theme'}">
                <div class="print-toolbar no-print">
                   <button class="toolbar-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
                   <button class="toolbar-btn" onclick="window.close()">✕ Close</button>
                </div>
                <div class="report-screen-container">
                  <div class="report-content-scroll">
                    <div id="zoomWrapper" class="max-w-6xl mx-auto bg-white px-6 py-4 shadow-2xl rounded-sm flex flex-col gap-8 transition-transform duration-200">
                      <div class="header">
                        <h1 class="title">CLEARSUM FINANCIAL STATEMENT</h1>
                        <div class="subtitle">Private Offline Ledger Summary • Generated on ${new Date().toLocaleDateString()} • Timeline: Past ${dayRange} Days</div>
                      </div>
                      <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-title">Consolidated Balance</div><div class="kpi-val">${fmt(totalBalance)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Total Expenses</div><div class="kpi-val">${fmt(totalSpent)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Total Income</div><div class="kpi-val">${fmt(totalIncome)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Active Accounts</div><div class="kpi-val">${wallets.length} Wallets</div></div>
                      </div>

                      <div class="section-title page-break-before">🛡️ Monthly Budget Breakdown Performance</div>
                      <div class="table-scroll-container budget-scroll avoid-break">
                        <table>
                          <thead><tr><th>Category Name</th><th>Total Spent In Period</th><th>Configured Limit</th><th>Status Alert</th></tr></thead>
                          <tbody>
                            ${budgets.map(b => {
                              const bExpenses = relevantExpenses.filter(e => e.type !== 'income' && e.category === b.category_name);
                              const bSpent = bExpenses.reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
                              const limit = Number(b.limit_amount) || 0;
                              const isOver = bSpent > limit && limit > 0;
                              return `<tr>
                                <td style="font-weight: 600;">${stripEmoji(b.category_name)}</td>
                                <td>${fmt(bSpent)}</td>
                                <td>${limit > 0 ? fmt(limit) : 'No Target Set'}</td>
                                <td>${limit > 0 ? (isOver ? '<span class="badge badge-over">⚠️ OVER BUDGET</span>' : '<span class="badge badge-safe">✅ WITHIN BUDGET</span>') : '—'}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <div class="section-title page-break-before">📊 Historical Recent Activity Log</div>
                      <div class="table-scroll-container activity-scroll avoid-break">
                        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr>
                              <th style="width: 12%;">DATE</th>
                              <th style="width: 33%;">DESCRIPTION</th>
                              <th style="width: 18%;">CATEGORY</th>
                              <th style="width: 12%;">ACCOUNT / WALLET</th>
                              <th style="width: 13%;">TYPE</th>
                              <th style="width: 12%; text-align: right;">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${relevantExpenses.map(e => {
                              const isIncome = String(e.type).toLowerCase() === 'income';
                              const sign = isIncome ? '+' : '-';
                              const walletName = getWalletName(e.wallet_id);
                              const formattedCategory = formatCategory(e.category, e.subcategory);
                              return `<tr>
                                <td style="width: 12%; white-space: nowrap;">${stripEmoji(e.date || '')}</td>
                                <td style="width: 33%; white-space: normal;">${stripEmoji(e.description || '—')}</td>
                                <td style="width: 18%; white-space: normal;">${stripEmoji(formattedCategory)}</td>
                                <td style="width: 12%; white-space: normal;">${stripEmoji(walletName)}</td>
                                <td style="width: 13%; white-space: normal;"><span style="color: #6b7280;">${isIncome ? 'Income' : 'Expense'}</span></td>
                                <td style="width: 12%; text-align: right; white-space: nowrap; font-weight: 700; color: ${isIncome ? '#059669' : '#dc2626'};">${sign}${fmt(Math.abs(Number(e.amount || 0)))}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <div class="section-title page-break-before" style="color: #c0392b;">TRANSACTION AUDIT LOG (VOIDED & DELETED)</div>
                      <div class="table-scroll-container audit-scroll avoid-break">
                        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr>
                              <th style="width: 12%;">DATE</th>
                              <th style="width: 33%;">DESCRIPTION</th>
                              <th style="width: 18%;">CATEGORY & SUBCATEGORY</th>
                              <th style="width: 12%;">ACCOUNT / WALLET</th>
                              <th style="width: 13%;">TYPE</th>
                              <th style="width: 12%; text-align: right;">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${periodAuditLogs.map(log => {
                              const walletName = log.wallet_id ? getWalletName(log.wallet_id) : '—';
                              const formattedCategory = formatCategory(log.original_category, log.original_subcategory);
                              const formattedDate = log.date ? format(parseLocalDate(log.date), 'yyyy-MM-dd') : '—';
                              return `<tr>
                                <td style="width: 12%; white-space: nowrap;">${stripEmoji(formattedDate)}</td>
                                <td style="width: 33%; white-space: normal;">${stripEmoji(log.original_description || '—')}</td>
                                <td style="width: 18%; white-space: normal;">${stripEmoji(formattedCategory)}</td>
                                <td style="width: 12%; white-space: normal;">${stripEmoji(walletName)}</td>
                                <td style="width: 13%; white-space: normal; color: #dc2626; font-weight: 600;">${stripEmoji(log.reason || 'Voided')}</td>
                                <td style="width: 12%; text-align: right; white-space: nowrap; font-weight: 700; text-decoration: line-through; color: #9ca3af;">${formatMoney(Math.abs(log.original_amount || 0), baseCurrencySymbol)}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `);
      printWindow.document.close();
      printWindow.focus();
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error(`Failed to generate ${timeline} report`);
    } finally {
      setIsExporting(null);
    }
  };

  const filterTransactionsByYear = (txs: typeof allExpenses, targetYear: number) =>
    txs.filter(tx => tx.date && new Date(tx.date).getFullYear() === targetYear);

  const handleExportYearlyPDF = async (targetYear: number) => {
    setIsExporting(`pdf-year-${targetYear}`);
    setIsPrintPreview(true);
    try {
      const allExpenses = await db.expenses.toArray();
      const wallets = await db.wallets.toArray();
      const budgets = await db.budgets.toArray();
      const allAuditLogs = await db.auditLogs.toArray();
      const baseCurrencySymbol = CURRENCY_SYMBOLS[baseCurrency] || '₨';

      const relevantExpenses = filterTransactionsByYear(allExpenses, targetYear);
      const periodAuditLogs = allAuditLogs.filter(log => {
        if (!log.date) return false;
        return parseLocalDate(log.date).getFullYear() === targetYear;
      });

      const snapshot = getAnnualLedgerSnapshot(allExpenses, targetYear);
      const totalSpent = snapshot.totalExpenses;
      const totalIncome = snapshot.totalIncome;
      const totalBalance = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

      const windowName = `clearsum-report-${targetYear}-${new Date().getTime()}`;
      const printWindow = window.open('', windowName, 
        `width=${screen.width},height=${screen.height},screenX=0,screenY=0,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no,fullscreen=yes`);
      
      if (!printWindow || printWindow.closed || typeof printWindow.document === 'undefined') {
        console.error('Popup blocked or failed to open print window');
        toast.error('Popup blocked! Please allow popups for this site to generate reports.');
        setIsExporting(null);
        return;
      }

      const fmt = (amount: number) => formatMoney(amount, baseCurrency);
      const getWalletName = (walletId: number) => {
        const wallet = wallets.find(w => w.id === walletId);
        return wallet ? wallet.name : '—';
      };
      const formatCategory = (category: string, subcategory?: string) => {
        if (subcategory) return `${category} <span class="subcategory-badge">(${subcategory})</span>`;
        return category;
      };

printWindow.document.write(`
        <html>
          <head>
            <title>ClearSum Financial Statement - Fiscal Year ${targetYear}</title>
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            ${getReportStyles(isDarkMode)}
            ${scrollableDocumentScript()}
           </head>
            <body class="${isDarkMode ? 'dark-theme' : 'light-theme'}">
                <div class="print-toolbar no-print">
                   <button class="toolbar-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
                   <button class="toolbar-btn" onclick="window.close()">✕ Close</button>
                </div>
                <div class="report-screen-container">
                  <div class="report-content-scroll">
                    <div id="zoomWrapper" class="max-w-6xl mx-auto bg-white px-6 py-4 shadow-2xl rounded-sm flex flex-col gap-8 transition-transform duration-200">
                      <div class="header">
                        <h1 class="title">CLEARSUM FINANCIAL STATEMENT</h1>
                        <div class="subtitle">Private Offline Ledger Summary • Generated on ${new Date().toLocaleDateString()} • Fiscal Year: ${targetYear}</div>
                      </div>

                      <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-title">Consolidated Balance</div><div class="kpi-val">${fmt(totalBalance)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Total Expenses (${targetYear})</div><div class="kpi-val">${fmt(totalSpent)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Total Income (${targetYear})</div><div class="kpi-val">${fmt(totalIncome)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Transactions (${targetYear})</div><div class="kpi-val">${snapshot.txCount} Records</div></div>
                      </div>

                      <div class="section-title page-break-before">Monthly Budget Breakdown Performance</div>
                      <div class="table-scroll-container budget-scroll avoid-break">
                        <table>
                          <thead><tr><th>Category Name</th><th>Total Spent</th><th>Configured Limit</th><th>Status</th></tr></thead>
                          <tbody>
                            ${budgets.map(b => {
                              const bExpenses = relevantExpenses.filter(e => e.type !== 'income' && e.category === b.category_name);
                              const bSpent = bExpenses.reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
                              const limit = Number(b.limit_amount) || 0;
                              const isOver = bSpent > limit && limit > 0;
                              return `<tr>
                                <td style="font-weight: 600;">${stripEmoji(b.category_name)}</td>
                                <td>${fmt(bSpent)}</td>
                                <td>${limit > 0 ? fmt(limit) : 'No Target Set'}</td>
                                <td>${limit > 0 ? (isOver ? '<span class="badge badge-over">OVER BUDGET</span>' : '<span class="badge badge-safe">WITHIN BUDGET</span>') : '—'}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <div class="section-title page-break-before" style="color: #c0392b;">AUDIT LOG (${targetYear})</div>
                      <div class="table-scroll-container audit-scroll avoid-break">
                        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr>
                              <th style="width: 12%;">DATE</th>
                              <th style="width: 33%;">DESCRIPTION</th>
                              <th style="width: 18%;">CATEGORY & SUBCATEGORY</th>
                              <th style="width: 12%;">ACCOUNT / WALLET</th>
                              <th style="width: 13%;">TYPE</th>
                              <th style="width: 12%; text-align: right;">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${periodAuditLogs.map(log => {
                              const walletName = log.wallet_id ? getWalletName(log.wallet_id) : '—';
                              const formattedCategory = formatCategory(log.original_category, log.original_subcategory);
                              const formattedDate = log.date ? format(parseLocalDate(log.date), 'yyyy-MM-dd') : '—';
                              return `<tr>
                                <td style="width: 12%; white-space: nowrap;">${stripEmoji(formattedDate)}</td>
                                <td style="width: 33%; white-space: normal;">${stripEmoji(log.original_description || '—')}</td>
                                <td style="width: 18%; white-space: normal;">${stripEmoji(formattedCategory)}</td>
                                <td style="width: 12%; white-space: normal;">${stripEmoji(walletName)}</td>
                                <td style="width: 13%; white-space: normal; color: #dc2626; font-weight: 600;">${stripEmoji(log.reason || 'Voided')}</td>
                                <td style="width: 12%; text-align: right; white-space: nowrap; font-weight: 700; text-decoration: line-through; color: #9ca3af;">${formatMoney(Math.abs(log.original_amount || 0), baseCurrencySymbol)}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <div class="section-title">Historical Activity Log (${targetYear})</div>
                      <div class="table-scroll-container activity-scroll">
                        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr>
                              <th style="width: 12%;">DATE</th>
                              <th style="width: 33%;">DESCRIPTION</th>
                              <th style="width: 18%;">CATEGORY</th>
                              <th style="width: 12%;">ACCOUNT / WALLET</th>
                              <th style="width: 13%;">TYPE</th>
                              <th style="width: 12%; text-align: right;">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${relevantExpenses.map(e => {
                              const isIncome = String(e.type).toLowerCase() === 'income';
                              const sign = isIncome ? '+' : '-';
                              const walletName = getWalletName(e.wallet_id);
                              const formattedCategory = formatCategory(e.category, e.subcategory);
                              return `<tr>
                                <td style="width: 12%; white-space: nowrap;">${stripEmoji(e.date || '')}</td>
                                <td style="width: 33%; white-space: normal;">${stripEmoji(e.description || '—')}</td>
                                <td style="width: 18%; white-space: normal;">${stripEmoji(formattedCategory)}</td>
                                <td style="width: 12%; white-space: normal;">${stripEmoji(walletName)}</td>
                                <td style="width: 13%; white-space: normal;"><span style="color: #6b7280;">${isIncome ? 'Income' : 'Expense'}</span></td>
                                <td style="width: 12%; text-align: right; white-space: nowrap; font-weight: 700; color: ${isIncome ? '#059669' : '#dc2626'};">${sign}${fmt(Math.abs(Number(e.amount || 0)))}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
            </body>
          </html>
        `);
      printWindow.document.close();
      printWindow.focus();
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error(`Failed to generate Fiscal Year ${targetYear} report`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportCustomDatePDF = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    setIsExporting('pdf-custom');
    setIsPrintPreview(true);
    try {
      const allExpenses = await db.expenses.toArray();
      const wallets = await db.wallets.toArray();
      const budgets = await db.budgets.toArray();
      const allAuditLogs = await db.auditLogs.toArray();
      const baseCurrencySymbol = CURRENCY_SYMBOLS[baseCurrency] || '₨';

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const relevantExpenses = allExpenses.filter(e => {
        if (!e.date) return false;
        const txDate = parseLocalDate(e.date);
        return txDate >= start && txDate <= end;
      });
      const periodAuditLogs = allAuditLogs.filter(log => {
        if (!log.date) return false;
        const logDate = parseLocalDate(log.date);
        return logDate >= start && logDate <= end;
      });

      const totalSpent = relevantExpenses.filter(e => String(e.type).toLowerCase() !== 'income').reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
      const totalIncome = relevantExpenses.filter(e => String(e.type).toLowerCase() === 'income').reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
      const totalBalance = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

      const windowName = `clearsum-report-custom-${new Date().getTime()}`;
      const printWindow = window.open('', windowName, 
        `width=${screen.width},height=${screen.height},screenX=0,screenY=0,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no,fullscreen=yes`);
      
      if (!printWindow || printWindow.closed || typeof printWindow.document === 'undefined') {
        console.error('Popup blocked or failed to open print window');
        toast.error('Popup blocked! Please allow popups for this site to generate reports.');
        setIsExporting(null);
        return;
      }

      const fmt = (amount: number) => formatMoney(amount, baseCurrency);
      const getWalletName = (walletId: number) => {
        const wallet = wallets.find(w => w.id === walletId);
        return wallet ? wallet.name : '—';
      };
      const formatCategory = (category: string, subcategory?: string) => {
        if (subcategory) return `${category} <span class="subcategory-badge">(${subcategory})</span>`;
        return category;
      };

      const dateLabel = `${startDate} to ${endDate}`;

printWindow.document.write(`
        <html>
          <head>
            <title>ClearSum Financial Statement - Custom Range</title>
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            ${getReportStyles(isDarkMode)}
            ${scrollableDocumentScript()}
           </head>
            <body class="${isDarkMode ? 'dark-theme' : 'light-theme'}">
                <div class="print-toolbar no-print">
                   <button class="toolbar-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
                   <button class="toolbar-btn" onclick="window.close()">✕ Close</button>
                </div>
                <div class="report-screen-container">
                  <div class="report-content-scroll">
                    <div id="zoomWrapper" class="max-w-6xl mx-auto bg-white px-6 py-4 shadow-2xl rounded-sm flex flex-col gap-8 transition-transform duration-200">
                      <div class="header">
                        <h1 class="title">CLEARSUM FINANCIAL STATEMENT</h1>
                        <div class="subtitle">Private Offline Ledger Summary • Generated on ${new Date().toLocaleDateString()} • Custom Range: ${dateLabel}</div>
                      </div>

                      <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-title">Consolidated Balance</div><div class="kpi-val">${fmt(totalBalance)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Total Expenses</div><div class="kpi-val">${fmt(totalSpent)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Total Income</div><div class="kpi-val">${fmt(totalIncome)}</div></div>
                        <div class="kpi-card"><div class="kpi-title">Transactions</div><div class="kpi-val">${relevantExpenses.length} Records</div></div>
                      </div>

                      <div class="section-title page-break-before">Monthly Budget Breakdown Performance</div>
                      <div class="table-scroll-container budget-scroll avoid-break">
                        <table>
                          <thead><tr><th>Category Name</th><th>Total Spent</th><th>Configured Limit</th><th>Status</th></tr></thead>
                          <tbody>
                            ${budgets.map(b => {
                              const bExpenses = relevantExpenses.filter(e => e.type !== 'income' && e.category === b.category_name);
                              const bSpent = bExpenses.reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);
                              const limit = Number(b.limit_amount) || 0;
                              const isOver = bSpent > limit && limit > 0;
                              return `<tr>
                                <td style="font-weight: 600;">${stripEmoji(b.category_name)}</td>
                                <td>${fmt(bSpent)}</td>
                                <td>${limit > 0 ? fmt(limit) : 'No Target Set'}</td>
                                <td>${limit > 0 ? (isOver ? '<span class="badge badge-over">OVER BUDGET</span>' : '<span class="badge badge-safe">WITHIN BUDGET</span>') : '—'}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <div class="section-title page-break-before" style="color: #c0392b;">AUDIT LOG</div>
                      <div class="table-scroll-container audit-scroll avoid-break">
                        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr>
                              <th style="width: 12%;">DATE</th>
                              <th style="width: 33%;">DESCRIPTION</th>
                              <th style="width: 18%;">CATEGORY & SUBCATEGORY</th>
                              <th style="width: 12%;">ACCOUNT / WALLET</th>
                              <th style="width: 13%;">TYPE</th>
                              <th style="width: 12%; text-align: right;">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${periodAuditLogs.map(log => {
                              const walletName = log.wallet_id ? getWalletName(log.wallet_id) : '—';
                              const formattedCategory = formatCategory(log.original_category, log.original_subcategory);
                              const formattedDate = log.date ? format(parseLocalDate(log.date), 'yyyy-MM-dd') : '—';
                              return `<tr>
                                <td style="width: 12%; white-space: nowrap;">${stripEmoji(formattedDate)}</td>
                                <td style="width: 33%; white-space: normal;">${stripEmoji(log.original_description || '—')}</td>
                                <td style="width: 18%; white-space: normal;">${stripEmoji(formattedCategory)}</td>
                                <td style="width: 12%; white-space: normal;">${stripEmoji(walletName)}</td>
                                <td style="width: 13%; white-space: normal; color: #dc2626; font-weight: 600;">${stripEmoji(log.reason || 'Voided')}</td>
                                <td style="width: 12%; text-align: right; white-space: nowrap; font-weight: 700; text-decoration: line-through; color: #9ca3af;">${formatMoney(Math.abs(log.original_amount || 0), baseCurrencySymbol)}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <div class="section-title">Historical Activity Log</div>
                      <div class="table-scroll-container activity-scroll">
                        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr>
                              <th style="width: 12%;">DATE</th>
                              <th style="width: 33%;">DESCRIPTION</th>
                              <th style="width: 18%;">CATEGORY</th>
                              <th style="width: 12%;">ACCOUNT / WALLET</th>
                              <th style="width: 13%;">TYPE</th>
                              <th style="width: 12%; text-align: right;">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${relevantExpenses.map(e => {
                              const isIncome = String(e.type).toLowerCase() === 'income';
                              const sign = isIncome ? '+' : '-';
                              const walletName = getWalletName(e.wallet_id);
                              const formattedCategory = formatCategory(e.category, e.subcategory);
                              return `<tr>
                                <td style="width: 12%; white-space: nowrap;">${stripEmoji(e.date || '')}</td>
                                <td style="width: 33%; white-space: normal;">${stripEmoji(e.description || '—')}</td>
                                <td style="width: 18%; white-space: normal;">${stripEmoji(formattedCategory)}</td>
                                <td style="width: 12%; white-space: normal;">${stripEmoji(walletName)}</td>
                                <td style="width: 13%; white-space: normal;"><span style="color: #6b7280;">${isIncome ? 'Income' : 'Expense'}</span></td>
                                <td style="width: 12%; text-align: right; white-space: nowrap; font-weight: 700; color: ${isIncome ? '#059669' : '#dc2626'};">${sign}${fmt(Math.abs(Number(e.amount || 0)))}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
            </body>
          </html>
        `);
       printWindow.document.close();
       printWindow.focus();
     } catch (error) {
       console.error("PDF export failed:", error);
       toast.error('Failed to generate custom date range report');
     } finally {
      setIsExporting(null);
    }
  };

  const handleExportCapitalVelocityReview = async () => {
    setIsExporting('velocity');
    try {
      const allGoals = await db.savings_goals.toArray();
      const allExpenses = await db.expenses.toArray();

      let totalSweepVolume = 0;
      let completedCount = 0;
      let activeCount = 0;

      const sweepExpenses = allExpenses.filter(e => 
        e.category === 'Savings Transfer' && e.description?.includes('Auto-sweep')
      );
      totalSweepVolume = sweepExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

      const fmtAmount = (cents: number): string =>
        formatMoney(cents, baseCurrency);

      const fmtDate = (d: Date) =>
        `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

      const tableRows: string[] = [];
      const auditHtml: string[] = [];

      allGoals.forEach((goal, idx) => {
        const d = computeGoalLifecycleData(goal, allExpenses, allGoals);
        const status = d.isFulfilled ? 'Fulfilled' : 'Active';
        const statusBadge = d.isFulfilled
          ? '<span style="background:#d1fae5;color:#065f46;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;">Fulfilled</span>'
          : '<span style="background:#dbeafe;color:#1e40af;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;">Active</span>';

        if (d.isFulfilled) completedCount++;
        else activeCount++;

        const pct = (val: number) => d.totalPool > 0 ? ((val / d.totalPool) * 100).toFixed(2) : '0.00';

        const closureClass = getClosureClass(goal);

        tableRows.push(`<tr>
          <td style="font-weight:600;">${d.goalNameClean}</td>
          <td>${statusBadge}</td>
          <td>${fmtAmount(d.totalTargetCents)}</td>
          <td>${fmtAmount(d.sweptSavedCents)}</td>
          <td>${fmtAmount(d.netLedgerCents)}</td>
          <td>${fmtAmount(d.remainingCents)}</td>
          <td>${closureClass}</td>
        </tr>`);

        const idxStr = String(idx + 1).padStart(2, '0');
        const fd = fmtDate(new Date());

        if (d.isFulfilled) {
          auditHtml.push(`<div class="audit-entry"><div class="audit-header">[${idxStr}] AUDIT SYNC \u2022 ${d.goalNameClean.toUpperCase()}</div>`);
          auditHtml.push(`<div class="audit-line">\u251C\u2500\u2500 STATUS          : <span class="audit-fulfilled">FULFILLED</span> (${fd})</div>`);
          auditHtml.push(`<div class="audit-line">\u251C\u2500\u2500 ASSET DISBURSED : ${fmtAmount(d.finalDisbursedCents)} (${pct(d.finalDisbursedCents)}% executed for asset acquisition)</div>`);
          auditHtml.push(`<div class="audit-line">\u251C\u2500\u2500 CAPITAL SWEEP   : ${fmtAmount(d.finalReallocatedCents)} (${pct(d.finalReallocatedCents)}% reallocated directly to ${d.finalLastDestName} vault)</div>`);
          auditHtml.push(`<div class="audit-line">\u2514\u2500\u2500 RECOVERY RETURN : ${fmtAmount(d.finalRetainedCents)} (${pct(d.finalRetainedCents)}% returned to core liquid cash)</div>`);
          if (d.incomingCents > 0) {
            auditHtml.push(`<div class="audit-line">\u2514\u2500\u2500 INJECTED SURPLUS: ${fmtAmount(d.incomingCents)} (Transferred from ${d.incomingNames.join(', ')} lifecycle closure)</div>`);
          }
          auditHtml.push(`</div>`);
        } else {
          auditHtml.push(`<div class="audit-entry"><div class="audit-header">[${idxStr}] AUDIT SYNC \u2022 ${d.goalNameClean.toUpperCase()}</div>`);
          auditHtml.push(`<div class="audit-line">\u251C\u2500\u2500 STATUS          : <span class="audit-active">ACTIVE</span> (Accumulating)</div>`);
          auditHtml.push(`<div class="audit-line">\u251C\u2500\u2500 SWEPT TO DATE   : ${fmtAmount(d.sweptSavedCents)} (${pct(d.sweptSavedCents)}% secured via auto-sweep loops)</div>`);
          if (d.incomingCents > 0) {
            auditHtml.push(`<div class="audit-line">\u251C\u2500\u2500 INJECTED SURPLUS: ${fmtAmount(d.incomingCents)} (Transferred from ${d.incomingNames.join(', ')} lifecycle closure)</div>`);
          }
          auditHtml.push(`<div class="audit-line">\u2514\u2500\u2500 FUNDING GAP     : ${fmtAmount(d.remainingCents)} (${pct(d.remainingCents)}% required to satisfy target)</div>`);
          auditHtml.push(`</div>`);
        }
      });

      const windowName = `clearsum-velocity-${new Date().getTime()}`;
      const printWindow = window.open('', windowName);
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>Capital Velocity & Financial Ledger Audit</title>
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; padding: 0; margin: 0; line-height: 1.5; background: #ffffff; color: #1e293b; font-size: 11px; }
              .print-toolbar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 0; margin-bottom: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
              .toolbar-btn { padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; }
              .toolbar-btn:hover { background: #2563eb; transform: translateY(-1px); }
              .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; }
              .title { font-size: 22px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; color: #1e3a8a; }
              .subtitle { font-size: 12px; margin-top: 6px; font-weight: 500; color: #4b5563; }
              .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; padding-bottom: 6px; margin: 30px 0 15px 0; letter-spacing: 0.5px; color: #1e3a8a; }
              table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; font-size: 13px; }
              th { font-weight: 700; text-transform: uppercase; font-size: 12px; padding: 11px 9px !important; background: #1e3a8a; color: #ffffff; border-bottom: 2px solid #3b82f6; width: auto !important; text-align: left !important; }
              td { padding: 9px 9px !important; border-bottom: 1px solid #e5e7eb; color: #1e293b; width: auto !important; text-align: left !important; font-size: 13px; }
              table tr:nth-child(even) td { background: #f8fafc; }
              .metrics-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 20px; }
              .metrics-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1e3a8a; margin-bottom: 12px; letter-spacing: 0.5px; }
              .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
              .metric-item { font-size: 11px; color: #334155; font-family: "Roboto Mono", monospace; }
              .audit-section { margin-top: 30px; }
              .audit-entry { margin-bottom: 16px; padding: 12px; border-left: 3px solid #3b82f6; background: #f8fafc; border-radius: 0 6px 6px 0; }
              .audit-header { font-weight: 700; font-size: 12px; color: #1e3a8a; margin-bottom: 6px; font-family: "Roboto Mono", monospace; }
              .audit-line { font-family: "Roboto Mono", monospace; font-size: 11px; color: #475569; line-height: 1.8; }
              .audit-fulfilled { color: #059669; font-weight: 700; }
              .audit-active { color: #2563eb; font-weight: 700; }
                              #zoomWrapper {
                  max-width: 72rem;
                  margin: 0 auto;
                  padding: 1.5rem;
                  background: #ffffff;
                  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);
                  border-radius: 2px;
                  display: flex;
                  flex-direction: column;
                   transition: transform 0.2s;
                 }
                 #zoomWrapper.fit-to-screen { max-width: none !important; }
                 body.dark-theme #zoomWrapper {
                  background: #0f172a;
                  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }
                body.light-theme #zoomWrapper {
                  background: #ffffff;
                  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);
                 }
                 .report-screen-container { width: 100%; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.report-content-scroll { 
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; padding-right: 10px; 
}
                 body.fit-to-screen .report-screen-container { overflow: hidden !important; height: 100vh !important; }
                 body.fit-to-screen .report-content-scroll { overflow: hidden !important; }

              @media print {
                body { font-size: 12px; background: #ffffff; }
                .print-toolbar { display: none; }
                .max-w-4xl { max-width: 100%; margin: 0; padding: 16px; }
                .bg-white { box-shadow: none; border-radius: 0; background: #ffffff; }
                .title { font-size: 18px; }
                .section-title { font-size: 13px; }
                table { font-size: 12px; }
                th { font-size: 11px; padding: 9px 7px !important; }
                td { padding: 7px 7px !important; font-size: 11px; }
                .metrics-box { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .audit-entry { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                th { background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }

              body.dark-theme { background: #0f172a; color: #f1f5f9; }
              body.dark-theme .print-toolbar { background: #1e293b; border-bottom-color: #334155; }
              body.dark-theme .toolbar-btn { background: #2563eb; }
              body.dark-theme .toolbar-btn:hover { background: #1d4ed8; }
              body.dark-theme .header { border-bottom-color: #3b82f6; }
              body.dark-theme .title { color: #60a5fa; }
              body.dark-theme .subtitle { color: #94a3b8; }
              body.dark-theme .section-title { color: #60a5fa; }
              body.dark-theme th { background: #1e3a5f; color: #e2e8f0; border-bottom-color: #334155; }
              body.dark-theme td { color: #cbd5e1; border-bottom-color: #334155; }
              body.dark-theme table tr:nth-child(even) td { background: rgba(30,41,59,0.5); }
              body.dark-theme .bg-white { background: #0f172a; }
              body.dark-theme [class*="bg-white"] { background: #0f172a; }
              body.dark-theme .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
              body.dark-theme .metrics-box { background: #1e293b; border-color: #334155; }
              body.dark-theme .metrics-title { color: #60a5fa; }
              body.dark-theme .metric-item { color: #94a3b8; }
              body.dark-theme .audit-entry { background: #1e293b; border-left-color: #3b82f6; }
              body.dark-theme .audit-header { color: #60a5fa; }
              body.dark-theme .audit-line { color: #94a3b8; }
              body.dark-theme .audit-fulfilled { color: #34d399; }
              body.dark-theme .audit-active { color: #60a5fa; }

              body.light-theme { background: #ffffff; color: #1e293b; }
              body.light-theme .print-toolbar { background: #f8fafc; border-bottom-color: #e2e8f0; }
              body.light-theme .toolbar-btn { background: #3b82f6; }
              body.light-theme .toolbar-btn:hover { background: #2563eb; }
              body.light-theme .header { border-bottom-color: #3b82f6; }
              body.light-theme .title { color: #1e3a8a; }
              body.light-theme .subtitle { color: #4b5563; }
              body.light-theme .section-title { color: #1e3a8a; }
              body.light-theme th { background: #1e3a8a; color: #ffffff; border-bottom-color: #3b82f6; }
              body.light-theme td { color: #334155; border-bottom-color: #e5e7eb; }
              body.light-theme table tr:nth-child(even) td { background: #f8fafc; }
              body.light-theme .bg-white { background: #ffffff; }
              body.light-theme .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1); }
              body.light-theme .metrics-box { background: #f1f5f9; border-color: #e2e8f0; }
              body.light-theme .metrics-title { color: #1e3a8a; }
              body.light-theme .metric-item { color: #334155; }
              body.light-theme .audit-entry { background: #f8fafc; border-left-color: #3b82f6; }
              body.light-theme .audit-header { color: #1e3a8a; }
              body.light-theme .audit-line { color: #475569; }
              body.light-theme .audit-fulfilled { color: #059669; }
              body.light-theme .audit-active { color: #2563eb; }
            </style>
${scrollableDocumentScript()}
          </head>
          <body class="${isDarkMode ? 'dark-theme' : 'light-theme'}">
<div class="report-screen-container" style="background: ${isDarkMode ? '#0f172a' : '#f1f5f9'};">
               <div class="w-full mb-4 sticky top-0 z-50">
                 <div class="print-toolbar">
                   <button id="fitToScreenBtn" class="toolbar-btn" onclick="toggleFitToScreen()">📄 Fit to Screen</button>
                   <button class="toolbar-btn" onclick="adjustZoom(0.1)">Zoom In</button>
                   <button class="toolbar-btn" onclick="adjustZoom(-0.1)">Zoom Out</button>
                   <button class="toolbar-btn" onclick="window.print()">Print / Save as PDF</button>
                 </div>
               </div>
               <div class="report-content-scroll">
               <div id="zoomWrapper" class="max-w-6xl mx-auto bg-white px-6 py-4 shadow-2xl rounded-sm flex flex-col gap-6 transition-transform duration-200">
                <div class="header">
                  <h1 class="title">Capital Velocity & Financial Ledger Audit</h1>
                  <div class="subtitle">Private Offline Ledger Summary \u2022 Generated on ${new Date().toLocaleDateString()}</div>
                </div>

                <div class="section-title">Goal Lifecycle Ledger</div>
                <table>
                  <thead>
                    <tr>
                      <th>Goal Name</th>
                      <th>Status</th>
                      <th>Total Target</th>
                      <th>Swept (Historical)</th>
                      <th>Net Ledger Balance</th>
                      <th>Remaining Balance</th>
                      <th>Closure Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows.length > 0 ? tableRows.join('') : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">No savings goals configured</td></tr>'}
                  </tbody>
                </table>

                <div class="metrics-box">
                  <div class="metrics-title">System Metrics Configuration</div>
                  <div class="metrics-grid">
                    <div class="metric-item">Open Slot Allocation : ${completedCount + activeCount}/5 Max Capacity</div>
                    <div class="metric-item">Completed Lifecycle: ${completedCount} Vault</div>
                    <div class="metric-item">Active Accumulations : ${activeCount} Vaults</div>
                    <div class="metric-item">Total Sweep Volume : ${fmtAmount(totalSweepVolume)}</div>
                  </div>
                </div>

                <div class="section-title">Audit Ledger Breakdown</div>
                <div class="audit-section">
                  ${auditHtml.length > 0 ? auditHtml.join('') : '<p style="color:#94a3b8;font-style:italic;">No audit entries generated</p>'}
</div>
                </div>
                </div>
            </body>
          </html>
        `);
      printWindow.document.close();

      toast.success('Capital Velocity Review opened in new tab');
    } catch (error) {
      console.error("Failed to generate Capital Velocity Review:", error);
      toast.error("Failed to generate Capital Velocity Review PDF");
    } finally {
      setIsExporting(null);
    }
  };




  const exportGoalLifecycleExcel = async () => {
    setIsExporting('excel');
    try {
      const allGoals = await db.savings_goals.toArray();

      const currencyFormat = '"Rs"#,##0.00;("Rs"#,##0.00);"-"';
      const auditLines: string[] = [];

      const sanitizeStr = (s: string): string =>
        String(s)
          .normalize('NFC')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF\u200B-\u200F\uFEFF\uFFFD]/g, '')
          .replace(/[\u{1F000}-\u{1FFFF}\u{200D}\u{FE0F}\u{2600}-\u{27BF}]/gu, '')
          .trim();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Goal Lifecycle Audit');

      // Row 1: Title
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'Goal Lifecycle Audit';
      titleCell.font = { bold: true, size: 14 };

      // Row 2: Column headers
      worksheet.getCell('A2').value = 'Goal Name';
      worksheet.getCell('B2').value = 'Status';
      worksheet.getCell('C2').value = 'Target';
      worksheet.getCell('D2').value = 'Swept (Historical)';
      worksheet.getCell('E2').value = 'Net Ledger Balance';
      worksheet.getCell('F2').value = 'Remaining';
      worksheet.getCell('G2').value = 'Closure';

      const dataStartRow = 3;

      for (let i = 0; i < allGoals.length; i++) {
        const goal = allGoals[i];
        goal.name = sanitizeStr(goal.name);
        const d = computeGoalLifecycleData(goal, allExpenses, allGoals);
        const status = d.isFulfilled ? 'Fulfilled' : 'Active';
        const sweptSavedUnits = d.sweptSavedCents / 100;
        const netLedgerUnits = d.netLedgerCents / 100;
        const remainingUnits = d.isFulfilled ? 0 : Math.max(0, (d.totalTargetCents / 100) - sweptSavedUnits);
        const pct = (val: number) => d.totalPool > 0 ? ((val / d.totalPool) * 100).toFixed(2) : '0.00';
        const closureClass = getClosureClass(goal);

        const rowNum = dataStartRow + i;

        worksheet.getCell(`A${rowNum}`).value = d.goalNameClean;
        worksheet.getCell(`B${rowNum}`).value = status;
        worksheet.getCell(`C${rowNum}`).value = d.totalTargetCents / 100;
        worksheet.getCell(`C${rowNum}`).numFmt = currencyFormat;
        worksheet.getCell(`D${rowNum}`).value = sweptSavedUnits;
        worksheet.getCell(`D${rowNum}`).numFmt = currencyFormat;
        worksheet.getCell(`E${rowNum}`).value = netLedgerUnits;
        worksheet.getCell(`E${rowNum}`).numFmt = currencyFormat;
        worksheet.getCell(`F${rowNum}`).value = { formula: `C${rowNum}-D${rowNum}`, result: remainingUnits };
        worksheet.getCell(`F${rowNum}`).numFmt = currencyFormat;
        worksheet.getCell(`G${rowNum}`).value = closureClass;

        const idxStr = String(i + 1).padStart(2, '0');
        const fd = `${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${new Date().getFullYear()}`;

        if (d.isFulfilled) {
          auditLines.push(`[${idxStr}] AUDIT SYNC \u2022 ${d.goalNameClean.toUpperCase()}`);
          auditLines.push(`     \u251C\u2500\u2500 STATUS          : FULFILLED (${fd})`);
          auditLines.push(`     \u251C\u2500\u2500 ASSET DISBURSED : ${formatMoney(d.finalDisbursedCents, baseCurrency)} (${pct(d.finalDisbursedCents)}% executed for asset acquisition)`);
          auditLines.push(`     \u251C\u2500\u2500 CAPITAL SWEEP   : ${formatMoney(d.finalReallocatedCents, baseCurrency)} (${pct(d.finalReallocatedCents)}% reallocated directly to ${d.finalLastDestName} vault)`);
          auditLines.push(`     \u2514\u2500\u2500 RECOVERY RETURN : ${formatMoney(d.finalRetainedCents, baseCurrency)} (${pct(d.finalRetainedCents)}% returned to core liquid cash)`);
          if (d.incomingCents > 0) {
            auditLines.push(`     \u2514\u2500\u2500 INJECTED SURPLUS: ${formatMoney(d.incomingCents, baseCurrency)} (Transferred from ${d.incomingNames.join(', ')} lifecycle closure)`);
          }
        } else {
          auditLines.push(`[${idxStr}] AUDIT SYNC \u2022 ${d.goalNameClean.toUpperCase()}`);
          auditLines.push(`     \u251C\u2500\u2500 STATUS          : ACTIVE (Accumulating)`);
          auditLines.push(`     \u251C\u2500\u2500 SWEPT TO DATE   : ${formatMoney(d.sweptSavedCents, baseCurrency)} (${pct(d.sweptSavedCents)}% secured via auto-sweep loops)`);
          if (d.incomingCents > 0) {
            auditLines.push(`     \u251C\u2500\u2500 INJECTED SURPLUS: ${formatMoney(d.incomingCents, baseCurrency)} (Transferred from ${d.incomingNames.join(', ')} lifecycle closure)`);
          }
          auditLines.push(`     \u2514\u2500\u2500 FUNDING GAP     : ${formatMoney(d.remainingCents, baseCurrency)} (${pct(d.remainingCents)}% required to satisfy target)`);
        }
      }

      worksheet.getColumn('A').width = 28;
      worksheet.getColumn('B').width = 14;
      worksheet.getColumn('C').width = 18;
      worksheet.getColumn('D').width = 18;
      worksheet.getColumn('E').width = 20;
      worksheet.getColumn('F').width = 20;
      worksheet.getColumn('G').width = 32;

      // Ceiling allocation summary row
      const completedCount = allGoals.filter(g => {
        const upper = stripEmoji(g.name).trim().toUpperCase();
        const gBal = computeGoalDynamicBalance(g.name, allExpenses);
        return upper === 'COW' || gBal >= (g.target_amount || 0);
      }).length;
      const activeCount = allGoals.length - completedCount;
      const summaryRow = dataStartRow + allGoals.length + 1;
      const summaryStart = summaryRow;
      worksheet.mergeCells(`A${summaryStart}:G${summaryStart}`);
      const summaryCell = worksheet.getCell(`A${summaryStart}`);
      summaryCell.value = `Open Slot Allocation: ${allGoals.length}/5 Max  |  Completed: ${completedCount}  |  Active: ${activeCount}`;
      summaryCell.font = { bold: true, color: { argb: 'FF3B82F6' } };

      // Audit rows at the bottom
      const auditStartRow = summaryStart + 2;
      worksheet.addRow([]);
      for (let j = 0; j < auditLines.length; j++) {
        const auditRow = worksheet.getRow(auditStartRow + j);
        auditRow.getCell(1).value = auditLines[j];
        auditRow.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };
        worksheet.mergeCells(`A${auditStartRow + j}:F${auditStartRow + j}`);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Goal_Lifecycle_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Goal Lifecycle Audit exported to Excel');
    } catch (error) {
      console.error("Failed to export Goal Lifecycle Excel:", error);
      toast.error("Failed to export Goal Lifecycle Audit");
    } finally {
      setIsExporting(null);
    }
  };

  const handleReportDownload = async (exportFn: () => Promise<void>) => {
    setIsGenerating(true);
    try {
      await exportFn();
    } catch (error) {
      console.error("Report generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const allExpenses = useLiveQuery(() => db.expenses.toArray()) || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <p className="text-sm text-text-muted mt-1">Generate and export financial documents and audit data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border-main rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Visual Financial Documents</h2>
          <p className="text-xs text-text-muted mb-4">Generate high-contrast PDF reports for printing or digital archiving.</p>
          <div className="space-y-3">
            <button onClick={() => handleReportDownload(() => handleExportTimelinePDF('weekly'))} disabled={isExporting === 'pdf-weekly'} className="w-full text-left p-3 text-slate-700 dark:text-slate-200 rounded-md transition-all duration-150 ease-out hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium">
              Weekly PDF Report
            </button>
            <button onClick={() => handleReportDownload(() => handleExportTimelinePDF('monthly'))} disabled={isExporting === 'pdf-monthly'} className="w-full text-left p-3 text-slate-700 dark:text-slate-200 rounded-md transition-all duration-150 ease-out hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium">
              Monthly PDF Report
            </button>
            <button onClick={() => handleReportDownload(handleExportCapitalVelocityReview)} disabled={isExporting === 'velocity'} className="w-full text-left p-3 text-slate-700 dark:text-slate-200 rounded-md transition-all duration-150 ease-out hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium">
              Capital Velocity & Goal Lifecycle Review
            </button>

            <div className="border-t border-border-main pt-3 mt-3">
              <button onClick={() => setShowDatePicker(!showDatePicker)} className="w-full text-left p-3 text-slate-700 dark:text-slate-200 rounded-md transition-all duration-150 ease-out hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-sm">📅</span>
                  Custom Date Range Statement
                </span>
                <span className="text-[10px] font-mono text-text-muted bg-bg-input px-2 py-0.5 rounded border border-border-main">
                  {showDatePicker ? '▲ Collapse' : '▼ Expand'}
                </span>
              </button>
              {showDatePicker && (
                <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border-main space-y-3 transition-all duration-200">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 p-1.5 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-sm text-text-muted mb-2">➔</span>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 p-1.5 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleReportDownload(handleExportCustomDatePDF)}
                    disabled={isExporting === 'pdf-custom' || !startDate || !endDate}
                    className="w-full p-2.5 bg-blue-600 text-white rounded-md font-semibold text-xs hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting === 'pdf-custom' ? '⏳ Generating...' : '📥 Generate Custom Report'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-border-main pt-3 mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Fiscal Year Historical Reports</p>
              <div className="space-y-2">
                {[new Date().getFullYear(), new Date().getFullYear() - 1].map(year => {
                  const isLeap = new Date(year, 1, 29).getDate() === 29;
                  return (
                    <button key={year} onClick={() => handleReportDownload(() => handleExportYearlyPDF(year))} disabled={isExporting === `pdf-year-${year}`} className="w-full text-left p-3 text-slate-700 dark:text-slate-200 rounded-md transition-all duration-150 ease-out hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium flex items-center justify-between">
                      <span>Fiscal Year {year}</span>
                      <span className="text-[10px] font-mono text-text-muted bg-bg-input px-2 py-0.5 rounded border border-border-main">{isLeap ? '366' : '365'} days</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border-main rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Spreadsheet Audit Data Workbooks</h2>
          <p className="text-xs text-text-muted mb-4">Export structured Excel workbooks for external analysis and record-keeping.</p>
          <div className="space-y-3">
            <button onClick={() => handleReportDownload(exportGoalLifecycleExcel)} disabled={isExporting === 'excel'} className="w-full text-left p-3 text-slate-700 dark:text-slate-200 rounded-md transition-all duration-150 ease-out hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium">
              Goal Lifecycle Audit (Excel)
            </button>
          </div>
        </div>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md transition-all duration-300">
          <div className="flex flex-col items-center space-y-6 max-w-sm w-full text-center p-8 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">

            <svg className="w-16 h-16 text-blue-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>

            <div className="space-y-2">
              <h3 className="text-sm font-mono tracking-widest text-blue-400 font-bold uppercase animate-bounce">
                🖨️ Compiling Ledger Data
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Building high-contrast archival document...
              </p>
            </div>

            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}