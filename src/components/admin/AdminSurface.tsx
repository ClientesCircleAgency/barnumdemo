import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface AdminPageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AdminPageShell({
  eyebrow = 'Barnun Gestão',
  title,
  subtitle,
  badge,
  actions,
  children,
  className,
}: AdminPageShellProps) {
  return (
    <div className={cn('min-h-screen bg-transparent pb-4 lg:bg-background lg:pb-10', className)}>
      <section className="mx-auto w-full max-w-7xl overflow-hidden rounded-[1.8rem] border border-primary/10 bg-card shadow-[0_18px_48px_rgba(146,94,18,0.08)] lg:rounded-[2rem] lg:shadow-[0_24px_80px_rgba(146,94,18,0.10)]">
        <div className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-secondary/70 to-card px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary hover:bg-primary/10 lg:text-xs">
                  {eyebrow}
                </Badge>
                {badge}
              </div>
              <h1 className="break-words font-display text-[1.45rem] font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {title}
              </h1>
              {subtitle && <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-muted-foreground lg:text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">{actions}</div>}
          </div>
        </div>
        <div className="p-4 sm:p-5 lg:p-7">{children}</div>
      </section>
    </div>
  );
}

export function AdminSectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[1.35rem] border border-primary/10 bg-card shadow-sm lg:rounded-[1.75rem]', className)}>
      {children}
    </div>
  );
}

export function AdminMetricCard({
  icon: Icon,
  title,
  value,
  caption,
  accent = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  value: number | string;
  caption: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[1.2rem] border border-primary/10 bg-secondary/60 p-4 transition-all hover:border-primary/20 hover:bg-secondary/80 lg:rounded-[1.35rem]',
        accent && 'bg-primary-gradient text-primary-foreground shadow-lg shadow-primary/15',
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:text-xs lg:tracking-[0.18em]', accent && 'text-white/70')}>
          {title}
        </p>
        {Icon && (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary', accent && 'bg-white/15 text-white')}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className={cn('break-words text-[1.5rem] font-semibold tracking-tight text-foreground sm:text-[1.7rem] lg:text-3xl', accent && 'text-white')}>{value}</p>
      <p className={cn('mt-1 break-words text-xs leading-5 text-muted-foreground lg:text-sm', accent && 'text-white/70')}>{caption}</p>
    </div>
  );
}
