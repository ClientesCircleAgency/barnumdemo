import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, Clock, MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AppointmentRequest } from '@/hooks/useAppointmentRequests';
import { getRequestStage, getRequestStatusLabel, requestStageStyles, type RequestStage } from '@/utils/requestStages';
import { cn } from '@/lib/utils';

const stages = [
  { key: 'pending', title: 'Pendentes', description: 'Pedidos por analisar ou confirmar', icon: Clock },
  { key: 'suggested', title: 'Horário sugerido', description: 'À espera de resposta do paciente', icon: MessageCircle },
  { key: 'processed', title: 'Processados', description: 'Consulta confirmada', icon: Check },
] as const;

export function RequestsBoard({ requests, onSelect }: {
  requests: AppointmentRequest[];
  onSelect: (request: AppointmentRequest) => void;
}) {
  const [query, setQuery] = useState('');
  const [limits, setLimits] = useState<Record<RequestStage, number>>({ pending: 20, suggested: 20, processed: 20, closed: 20 });
  const filtered = requests.filter(request =>
    [request.name, request.nif, request.phone, request.email].some(value =>
      value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    ),
  );
  const group = (stage: RequestStage) => filtered.filter(request => getRequestStage(request.status) === stage);

  const renderCards = (stage: RequestStage) => {
    const rows = group(stage);
    return <>
      {rows.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum pedido nesta secção.</p>}
      {rows.slice(0, limits[stage]).map(request => (
        <button key={request.id} type="button" onClick={() => onSelect(request)}
          className={cn('w-full rounded-2xl border-l-4 border p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', requestStageStyles[stage])}>
          <p className="break-words font-semibold">{request.name}</p>
          <p className="mt-1 text-xs">NIF: {request.nif}</p>
          <p className="mt-2 text-sm">Preferência: {format(parseISO(request.preferred_date), 'd MMM', { locale: pt })} às {request.preferred_time.slice(0, 5)}</p>
          <Badge variant="outline" className={cn('mt-3 whitespace-normal text-left', requestStageStyles[stage])}>
            {getRequestStatusLabel(request.status)}
          </Badge>
          {stage === 'suggested' && <p className="mt-2 text-xs">{request.suggested_slots.length} horário(s) proposto(s) · abrir para ver</p>}
          <p className="mt-3 text-xs opacity-75">Recebido {format(parseISO(request.created_at), 'd MMM yyyy', { locale: pt })}</p>
        </button>
      ))}
      {rows.length > limits[stage] && <Button type="button" variant="outline" onClick={() => setLimits(current => ({ ...current, [stage]: current[stage] + 20 }))}>Mostrar mais</Button>}
    </>;
  };

  return <div className="space-y-5">
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Pesquisar pedidos" placeholder="Pesquisar por nome, NIF, telefone ou email..." value={query} onChange={event => setQuery(event.target.value)} className="h-11 rounded-2xl pl-10" />
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-3">
      {stages.map(({ key, title, description, icon: Icon }) => <section key={key} aria-label={title} className="min-w-0 space-y-3">
        <div className={cn('rounded-2xl border p-4', requestStageStyles[key])}>
          <h2 className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{title}<span className="ml-auto rounded-full bg-white/75 px-2 py-0.5 text-sm">{group(key).length}</span></h2>
          <p className="mt-1 text-xs">{description}</p>
        </div>
        {renderCards(key)}
      </section>)}
    </div>
    {group('closed').length > 0 && <details className="rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-medium text-slate-700">Encerrados sem consulta confirmada ({group('closed').length})</summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{renderCards('closed')}</div>
    </details>}
  </div>;
}
