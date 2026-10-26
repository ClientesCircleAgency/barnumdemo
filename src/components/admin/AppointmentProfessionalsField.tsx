import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { AppointmentTeamList } from './AppointmentTeamList';

interface Props {
  primaryProfessionalId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  professionals: { id: string; name: string; color?: string | null }[];
  availableIds: string[];
  disabled?: boolean;
  showSummary?: boolean;
}

export function AppointmentProfessionalsField({ primaryProfessionalId, value, onChange, professionals, availableIds, disabled, showSummary = true }: Props) {
  const prefix = useId();
  return <div className="space-y-3">
    {showSummary && value.some(Boolean) && <div className="rounded-xl border bg-secondary/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Equipa da consulta</p>
      <AppointmentTeamList appointment={{professionalId:primaryProfessionalId,additionalProfessionalIds:value.filter(Boolean)}} getProfessional={id=>professionals.find(p=>p.id===id)} className="text-sm" />
    </div>}
    {value.map((id,index) => <div key={index} className="space-y-1">
      <label className="text-sm font-medium" htmlFor={`${prefix}-${index}`}>Profissional adicional {index+1}</label>
      <div className="flex items-center gap-2">
        <select id={`${prefix}-${index}`} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={id} disabled={disabled}
          onChange={event => onChange(value.map((current,i) => i===index ? event.target.value : current))}>
          <option value="">Selecionar profissional</option>
          {professionals.filter(p => p.id===id || (p.id!==primaryProfessionalId && !value.includes(p.id) && availableIds.includes(p.id))).map(p =>
            <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(value.filter((_,i) => i!==index))}>Remover</Button>
      </div>
      {id && (!availableIds.includes(id) || id===primaryProfessionalId) && <p role="alert" className="text-sm text-destructive">Este profissional não está disponível para esta consulta.</p>}
    </div>)}
    <Button type="button" variant="outline" disabled={disabled || !primaryProfessionalId || value.includes('')} onClick={() => onChange([...value,''])}>Adicionar profissional</Button>
  </div>;
}
