import jsPDF from 'jspdf';
import { computeGoalDynamicBalance } from './goalBalanceEngine';

export function stripEmoji(s: string): string {
  return String(s).replace(/[\u{1F000}-\u{1FFFF}\u{200D}\u{FE0F}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
}

export function pdfMoney(cents: number, currencyCode: string): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  const formatted = dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currencyCode} ${formatted}`;
}

export function renderAuditSummaryNotes(doc: jsPDF, goals: any[], baseCurrency: string, allExpenses?: any[]) {
  const notesStartY = (doc as any).lastAutoTable.finalY + 15;
  const activeGoals = allExpenses
    ? goals.filter((g: any) => computeGoalDynamicBalance(g.name, allExpenses) > 0)
    : goals.filter((g: any) => (g.current_amount || 0) > 0);

  if (activeGoals.length === 0) return;

  const lineHeight = 12;
  const boxHeight = activeGoals.length * lineHeight + 10;

  doc.setFillColor(248, 250, 252);
  doc.rect(14, notesStartY - 3, 180, boxHeight, 'F');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  activeGoals.forEach((goal: any, index: number) => {
    const cleanName = stripEmoji(String(goal.name || ''));
    const balance = allExpenses ? computeGoalDynamicBalance(goal.name, allExpenses) : (goal.current_amount || 0);
    const amountText = pdfMoney(balance, baseCurrency);
    const pdfSummaryText = `Audit Summary Note & Project Review: This goal stays active with remaining balance of ${amountText} This money is saved for future expenses, next goals, or to move back into your available wallet balance.`;
    doc.text(pdfSummaryText, 16, notesStartY + (index * lineHeight) + 4, { maxWidth: 174 });
  });
}
