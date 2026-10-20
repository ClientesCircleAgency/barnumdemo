export type RequestStage = 'pending' | 'suggested' | 'processed' | 'closed';

// The conversion RPC creates a confirmed appointment before setting converted.
// Suggestions and pre-confirmations must remain in the active workflow.
export function getRequestStage(status: string): RequestStage {
  if (status === 'converted') return 'processed';
  if (status === 'suggested') return 'suggested';
  if (['cancelled', 'rejected', 'expired'].includes(status)) return 'closed';
  return 'pending';
}

export function isOpenRequest(status: string) {
  return ['pending', 'suggested'].includes(getRequestStage(status));
}

export function getRequestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    pre_confirmed: 'Aguarda confirmação',
    suggested: 'Aguarda resposta do paciente',
    converted: 'Processado · consulta confirmada',
    rejected: 'Rejeitado',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };
  return labels[status] || 'Pendente';
}

export const requestStageStyles: Record<RequestStage, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  suggested: 'border-blue-300 bg-blue-50 text-blue-900',
  processed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  closed: 'border-slate-300 bg-slate-50 text-slate-700',
};
