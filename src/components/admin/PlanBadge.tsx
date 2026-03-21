import { Crown, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PlanType = 'basic' | 'advanced' | 'premium';

interface PlanBadgeProps {
  plan: PlanType;
  collapsed?: boolean;
}

const planConfig: Record<PlanType, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  basic: {
    label: 'Basic',
    icon: Star,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/20',
  },
  advanced: {
    label: 'Advanced',
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  premium: {
    label: 'Premium',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
};

export function PlanBadge({ plan, collapsed = false }: PlanBadgeProps) {
  const config = planConfig[plan];
  const Icon = config.icon;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/admin/plano"
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-xl border transition-all hover:scale-105',
              config.bgColor,
              config.borderColor,
              config.color
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Plano {config.label}</p>
          <p className="text-xs text-muted-foreground">Clique para ver opções</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to="/admin/plano"
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:scale-[1.02]',
        config.bgColor,
        config.borderColor
      )}
    >
      <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', config.color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Plano atual</p>
        <p className={cn('font-semibold text-sm', config.color)}>{config.label}</p>
      </div>
    </Link>
  );
}
