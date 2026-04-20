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
    <div className={cn('min-h-screen bg-background pb-10', className)}>
      <section className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_80px_rgba(146,94,18,0.10)]">
        <div className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-secondary/70 to-card px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  {eyebrow}
                </Badge>
                {badge}
              </div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              {subtitle && <p className="mt-2 max-w-3xl text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
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
    <div className={cn('rounded-[1.75rem] border border-primary/10 bg-card shadow-sm', className)}>
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
        'rounded-[1.35rem] border border-primary/10 bg-secondary/60 p-4 transition-all hover:border-primary/20 hover:bg-secondary/80',
        accent && 'bg-primary-gradient text-primary-foreground shadow-lg shadow-primary/15',
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className={cn('text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground', accent && 'text-white/70')}>
          {title}
        </p>
        {Icon && (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary', accent && 'bg-white/15 text-white')}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className={cn('text-3xl font-semibold tracking-tight text-foreground', accent && 'text-white')}>{value}</p>
      <p className={cn('mt-1 text-sm text-muted-foreground', accent && 'text-white/70')}>{caption}</p>
    </div>
  );
}
