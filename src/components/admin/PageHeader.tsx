import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-serif italic text-foreground text-2xl lg:text-3xl tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="font-mono text-[10px] text-muted-foreground mt-1.5 uppercase tracking-widest">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
