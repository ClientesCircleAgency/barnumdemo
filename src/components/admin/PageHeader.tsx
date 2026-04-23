import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 rounded-[1.6rem] border border-primary/10 bg-gradient-to-r from-primary/10 via-secondary/70 to-card p-4 shadow-sm sm:mb-6 sm:rounded-[1.75rem] sm:p-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Barnun Gestão
          </span>
          {badge}
        </div>
        <h1 className="break-words font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl break-words text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}
