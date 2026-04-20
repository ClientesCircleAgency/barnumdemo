import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function StatCard({ label, value, icon: Icon, iconColor, trend }: StatCardProps) {
  return (
    <div className="rounded-[1.35rem] border border-primary/10 bg-secondary/60 p-5 shadow-sm transition-all hover:border-primary/20 hover:bg-secondary/80">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs mt-2",
              trend.value >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            iconColor || "bg-primary/10 text-primary"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              iconColor ? "text-current" : "text-primary"
            )} />
          </div>
        )}
      </div>
    </div>
  );
}
