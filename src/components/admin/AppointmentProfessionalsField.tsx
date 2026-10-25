import { useId } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  primaryProfessionalId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  professionals: { id: string; name: string }[];
  availableIds: string[];
  disabled?: boolean;
}

export function AppointmentProfessionalsField({ primaryProfessionalId, value, onChange, professionals, availableIds, disabled }: Props) {
  const prefix = useId();
  return <div className="space-y-3">
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
