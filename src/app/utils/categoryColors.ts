const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  "Food & Dining": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-300/40" },
  "Transportation": { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-400", ring: "ring-sky-300/40" },
  "Shopping": { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400", ring: "ring-pink-300/40" },
  "Entertainment": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", ring: "ring-purple-300/40" },
  "Healthcare": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-300/40" },
  "Bills & Utilities": { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-400", ring: "ring-slate-300/40" },
  "Housing & Utilities": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-400", ring: "ring-cyan-300/40" },
  "Financial Expenses": { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400", ring: "ring-indigo-300/40" },
  "Fixed Assets": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", ring: "ring-purple-300/40" },
  "Savings Transfer": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", ring: "ring-blue-300/40" },
  "Salary": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-300/40" },
  "Freelance": { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", ring: "ring-violet-300/40" },
  "Business": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-300/40" },
  "Investment": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-400", ring: "ring-cyan-300/40" },
  "Gift": { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400", ring: "ring-pink-300/40" },
  "Refund": { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-400", ring: "ring-teal-300/40" },
  "Other": { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-400", ring: "ring-slate-300/40" },
};

const DEFAULT_COLOR = { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-400", ring: "ring-slate-300/40" };

export function getCategoryColor(categoryName: string): { bg: string; text: string; ring: string } {
  return CATEGORY_COLORS[categoryName] || DEFAULT_COLOR;
}

export function getSubCategoryColor(parentName: string): { bg: string; text: string; ring: string } {
  const parent = CATEGORY_COLORS[parentName] || DEFAULT_COLOR;
  return {
    bg: parent.bg.replace("100", "50").replace("900/30", "900/15"),
    text: parent.text,
    ring: parent.ring,
  };
}
