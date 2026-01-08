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
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
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
            "h-10 w-10 rounded-xl flex items-center justify-center",
            iconColor || "bg-primary/10"
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
