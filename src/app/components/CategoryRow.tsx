import React from 'react';
import { Pencil, Trash2, Lock, Plus } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { formatMoney } from '../utils/monetary';
import { getCategoryColor, getSubCategoryColor } from '../utils/categoryColors';
import type { Category } from '../types/wallet';
import type { Budget } from '../types/budget';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface CategoryRowProps {
  category: Category;
  subcategories: Category[];
  isExpanded: boolean;
  isEditing: boolean;
  editingName: string;
  editingBudget: number;
  budget: Budget | undefined;
  parentSpent: number;
  subSpents: Record<number, number>;
  baseCurrency: string;
  hasMainCategoryTransactions: boolean;
  onToggle: (id: number) => void;
  onStartInlineEdit: (id: number) => void;
  onSaveInlineEdit: (id: number) => void;
  onCancelInlineEdit: () => void;
  onEditingNameChange: (id: number, name: string) => void;
  onEditingBudgetChange: (id: number, budget: number) => void;
  onDeleteCategory: (id: number) => void;
  onEditSubcategory: (sub: Category) => void;
  onDeleteSubcategory: (id: number) => void;
  onAddSubcategory: (parentId: number) => void;
  parentCategory?: Category; // Add parent category for icon fallback
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  category,
  subcategories,
  isExpanded,
  isEditing,
  editingName,
  editingBudget,
  budget,
  parentSpent,
  subSpents,
  baseCurrency,
  hasMainCategoryTransactions,
  onToggle,
  onStartInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
  onEditingNameChange,
  onEditingBudgetChange,
  onDeleteCategory,
  onEditSubcategory,
  onDeleteSubcategory,
  onAddSubcategory,
  parentCategory,
}) => {
  const hasBudget = budget && budget.limit_amount > 0;
  const isOverBudget = hasBudget && parentSpent > budget!.limit_amount;
  const type = category.type;

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors duration-150 ${
          isEditing
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
            : 'bg-bg-input border-border-main hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-blue-500/20'
        }`}
        onClick={() => !isEditing && onToggle(category.id!)}
      >
        {isEditing ? (
          <>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-text-muted text-[10px] font-mono w-3 shrink-0">
                {isExpanded ? '▼' : '▶'}
              </span>
              {hasMainCategoryTransactions ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        value={editingName}
                        readOnly
                        className="w-full px-2 py-1 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-200 dark:border-neutral-700 rounded pr-7"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Lock className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-center">
                    🔒 This category name cannot be modified because it contains active transaction history.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => onEditingNameChange(category.id!, e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-border-main rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              )}
              <span className="text-[10px] text-text-muted shrink-0">({subcategories.length})</span>
            </div>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              {type !== 'income' && (
                <input
                  type="number"
                  min="0"
                  placeholder="Limit"
                  value={editingBudget || ''}
                  onChange={(e) => onEditingBudgetChange(category.id!, parseFloat(e.target.value) || 0)}
                  className="w-20 h-7 text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-border-main rounded text-text-primary placeholder:text-text-muted text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <button
                onClick={() => onSaveInlineEdit(category.id!)}
                className="px-1 text-sm cursor-pointer transition-colors text-emerald-500 font-bold hover:text-emerald-400"
              >
                ✓
              </button>
              <button
                onClick={onCancelInlineEdit}
                className="text-text-muted text-sm px-1 cursor-pointer hover:text-text-primary"
              >
                ×
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-text-muted text-[10px] font-mono w-3 shrink-0">
                {isExpanded ? '▼' : '▶'}
              </span>
              <div className={`p-1.5 rounded-md flex items-center justify-center shrink-0 ${getCategoryColor(category.name).bg}`}>
                <CategoryIcon name={category.icon || 'Circle'} className={`w-4 h-4 ${getCategoryColor(category.name).text}`} />
              </div>
              <span className="text-text-primary font-semibold truncate">
                {category.name}
              </span>
              <span className="text-[10px] text-text-muted shrink-0">({subcategories.length})</span>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              {type !== 'income' && (
                hasBudget ? (
                  <span className={`text-xs px-2 py-1 rounded font-semibold border ${
                    isOverBudget
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                      : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/30'
                  }`}>
                    {formatMoney(parentSpent, baseCurrency)} / {formatMoney(budget!.limit_amount, baseCurrency)}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded font-semibold border bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                    No Budget
                  </span>
                )
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-emerald-600 font-semibold">{formatMoney(parentSpent, baseCurrency)}</span>
        {type !== 'income' && !hasBudget && (
          <button
            className="text-xs px-2 py-1 rounded bg-bg-input text-text-muted hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
            onClick={() => onStartInlineEdit(category.id!)}
          >
            Budget
          </button>
        )}
        <button
          onClick={() => onStartInlineEdit(category.id!)}
          className="p-1 text-text-muted hover:text-text-primary cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteCategory(category.id!); }}
          className="p-1 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        </button>
      </div>
      {isExpanded && subcategories.length > 0 && (
        <div className="ml-4 mt-1 mb-1 flex flex-col gap-1 border-l-2 border-border-main pl-3">
          {subcategories.map(sub => {
            const subSpent = subSpents[sub.id!] ?? 0;
            
            // Determine which icon to use: subcategory's own icon or fallback to parent category's icon
            const displayIcon = sub.icon && sub.icon !== 'HelpCircle' && sub.icon !== '' ? sub.icon : (parentCategory?.icon || 'Circle');
            const isUsingParentIcon = !sub.icon || sub.icon === 'HelpCircle' || sub.icon === '';
            
            return (
              <div key={sub.id} className="flex items-center justify-between p-2 rounded-md bg-bg-input/50 border border-border-main/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-text-muted font-mono text-[9px]">└</span>
                  <div className={`p-1 rounded-md flex items-center justify-center shrink-0 ${getSubCategoryColor(category.name).bg}`}>
                    <CategoryIcon name={displayIcon} className={`w-3.5 h-3.5 ${getSubCategoryColor(category.name).text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                      onClick={() => onEditSubcategory(sub)}
                    >
                      {sub.name}
                    </span>
                    {isUsingParentIcon && (
                      <span className="text-xs text-text-muted ml-1">
                        (using {parentCategory?.name || 'parent'} icon)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-100 dark:border-neutral-700">
                    {formatMoney(subSpent, baseCurrency)}
                  </span>
                  <button onClick={() => onEditSubcategory(sub)} className="p-1 text-text-muted hover:text-text-primary cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDeleteSubcategory(sub.id!)} className="p-1 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* Add Subcategory Button - Only show for main categories and when not editing */}
          {category.parent_id == null && !isEditing && (
            <div className="ml-4 mt-1 mb-1">
              <button
                onClick={() => onAddSubcategory(category.id!)}
                className="text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3 mr-1 inline" /> Add Sub
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

CategoryRow.displayName = 'CategoryRow';

function areCategoryRowPropsEqual(prev: CategoryRowProps, next: CategoryRowProps) {
  if (prev.category.id !== next.category.id) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.editingName !== next.editingName) return false;
  if (prev.editingBudget !== next.editingBudget) return false;
  if (prev.parentSpent !== next.parentSpent) return false;
  if (prev.baseCurrency !== next.baseCurrency) return false;
  if (prev.subcategories !== next.subcategories) return false;
  if (prev.budget !== next.budget) return false;
  const prevSpents = prev.subSpents;
  const nextSpents = next.subSpents;
  const pKeys = Object.keys(prevSpents);
  const nKeys = Object.keys(nextSpents);
  if (pKeys.length !== nKeys.length) return false;
  for (let i = 0; i < pKeys.length; i++) {
    const k = pKeys[i];
    if (prevSpents[k] !== nextSpents[k]) return false;
  }
  return true;
}

export default React.memo(CategoryRow, areCategoryRowPropsEqual);
