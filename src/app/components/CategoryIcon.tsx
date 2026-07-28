import * as LucideIcons from 'lucide-react';
import React from 'react';

const iconCache = new Map<string, React.ComponentType<{ className?: string }>>();

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const cached = iconCache.get(name);
  if (cached) return cached;
  const icons = LucideIcons as Record<string, React.ComponentType<{ className?: string }> | undefined>;
  const Icon = icons[name] || icons.Circle || (() => null);
  iconCache.set(name, Icon);
  return Icon;
}

interface CategoryIconProps {
  name: string;
  className?: string;
}

const CategoryIcon = React.memo(({ name, className }: CategoryIconProps) => {
  const Icon = resolveIcon(name);
  return <Icon className={className ?? 'w-4 h-4'} />;
});

CategoryIcon.displayName = 'CategoryIcon';

export { CategoryIcon };
