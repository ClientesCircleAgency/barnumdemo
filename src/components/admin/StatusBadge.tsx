import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types/clinic';
import { appointmentStatusLabels } from '@/types/clinic';

interface StatusBadgeProps {
  status: AppointmentStatus;
  size?: 'sm' | 'default';
  className?: string;
}

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  pre_confirmed: 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-100',
  confirmed: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  waiting: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
  completed: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  cancelled: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  no_show: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100',
};

export function StatusBadge({ status, size = 'default', className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        statusStyles[status],
        size === 'sm' && 'text-xs px-1.5 py-0',
        className
      )}
    >
      {appointmentStatusLabels[status]}
    </Badge>
  );
}
